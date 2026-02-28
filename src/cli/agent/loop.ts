import type {
  LLMProvider,
  ToolMessage,
  ToolDefinition,
  ContentBlock,
  ToolUseBlock,
} from '../providers/types.js';
import { getTool, getAllToolDefinitions, type ToolContext } from './tools/registry.js';
import { PermissionManager } from './permissions.js';
import { renderToolCall, renderToolResult, renderToolDenied, resetToolCounter, renderToolBlockStart, renderToolBlockEnd } from '../ui/tool-output.js';
import { renderAssistantEnd } from '../ui/chat-view.js';
import type { CheckpointStore } from '../checkpoints/store.js';
import { captureFileSnapshots, fillSnapshotAfter } from '../checkpoints/revert.js';
import type { TaskStep } from '../ui/activity.js';
import type { SessionBuffer } from '../context/session-buffer.js';
import { isRateLimitError, handleRateLimitError, detectCreditsExhausted } from '../providers/rate-limiter.js';
import { trimConversation, estimateTokens } from '../context/trimmer.js';

export class AgentAbortError extends Error {
  constructor(message: string = 'Agent aborted') {
    super(message);
    this.name = 'AgentAbortError';
  }
}

export interface AgentLoopOptions {
  provider: LLMProvider;
  systemPrompt: string;
  permissions: PermissionManager;
  toolContext: ToolContext;
  checkpointStore?: CheckpointStore;
  sessionBuffer?: SessionBuffer;
  onTokensUsed?: (input: number, output: number) => void;
  onToolCall?: (name: string) => void;
  onStepStart?: (num: number, tool: string, label: string) => void;
  onStepEnd?: (num: number, tool: string, status: 'done' | 'error', error?: string) => void;
  /** Called before each LLM API call — use to restart activity indicator */
  onThinking?: () => void;
  /** Called before rendering the final answer — use to stop activity */
  onBeforeAnswer?: () => void;
  maxIterations?: number;
}

export interface AgentLoopResult {
  text: string;
  toolCalls: number;
  tokensUsed: { input: number; output: number };
  aborted: boolean;
  steps: TaskStep[];
  errors: string[];
  /** The full conversation history after this loop — caller must adopt this */
  updatedHistory: ToolMessage[];
}

/**
 * The agent loop: sends messages to the LLM, executes tool calls,
 * feeds results back, and repeats until the model is done.
 *
 * Supports pause/resume/abort via the AgentController.
 * AbortController cancels in-flight HTTP requests on emergency stop.
 */
export async function runAgentLoop(
  userMessage: string,
  conversationHistory: ToolMessage[],
  options: AgentLoopOptions,
  controller?: AgentController,
): Promise<AgentLoopResult> {
  const {
    provider,
    systemPrompt,
    permissions,
    toolContext,
    checkpointStore,
    sessionBuffer,
    onTokensUsed,
    onToolCall,
    onStepStart,
    onStepEnd,
    onThinking,
    onBeforeAnswer,
    maxIterations = 200,
  } = options;

  const tools = getAllToolDefinitions();
  resetToolCounter();
  const messages: ToolMessage[] = [...conversationHistory];

  // Add user message
  messages.push({ role: 'user', content: userMessage });

  let totalText = '';
  let totalToolCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let iterations = 0;
  const steps: TaskStep[] = [];
  const errors: string[] = [];
  let consecutiveErrors = 0;
  let toolBlockStarted = false;
  let toolBlockStartTime = 0;

  while (iterations < maxIterations) {
    iterations++;

    // Check for abort before LLM call
    if (controller?.isAborted) {
      throw new AgentAbortError();
    }

    // Signal activity indicator: we're about to call the LLM
    onThinking?.();

    // Auto-trim before each LLM call to prevent context overflow
    const systemTokens = estimateTokens([{ role: 'user', content: systemPrompt }]);
    const availableBudget = Math.floor(provider.maxContextLength * 0.85) - systemTokens;
    trimConversation(messages, availableBudget, sessionBuffer);

    // Call the LLM with tools — pass abort signal for hard cancellation
    let response;
    try {
      const signal = controller?.signal;
      response = await provider.chatWithTools(messages, systemPrompt, tools, signal);
    } catch (apiErr) {
      // If aborted, throw clean error
      if (controller?.isAborted) {
        throw new AgentAbortError();
      }
      // Check if it's an abort error from the SDK
      if (apiErr instanceof Error && apiErr.name === 'AbortError') {
        throw new AgentAbortError();
      }

      const errMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);

      // Credits exhausted — don't retry, give clear message with free model hint
      const creditsReason = detectCreditsExhausted(apiErr);
      if (creditsReason) {
        sessionBuffer?.addToolError('credits_exhausted', creditsReason);
        const freeHint = provider.name === 'zai'
          ? ' Switch to a free model: /model → glm-4.7-flash or glm-4.5-flash'
          : '';
        throw new Error(`\u274C ${creditsReason}.${freeHint}`);
      }

      // Rate limit errors — smart backoff (provider already retried, but handle edge cases)
      if (isRateLimitError(apiErr) && iterations < maxIterations && consecutiveErrors < 4) {
        const waitMs = handleRateLimitError(apiErr);
        consecutiveErrors++;
        errors.push(`Rate limited (waiting ${Math.ceil(waitMs / 1000)}s)`);
        sessionBuffer?.addToolError('rate_limit', errMsg);

        process.stdout.write(`\r\x1b[K  \u23F3 Rate limited \u2014 waiting ${Math.ceil(waitMs / 1000)}s...\n`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      // Other API errors — brief retry
      if (iterations < maxIterations && consecutiveErrors < 2) {
        consecutiveErrors++;
        errors.push(`API error (retrying): ${errMsg}`);
        sessionBuffer?.addToolError('api_call', errMsg);

        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw apiErr;
    }

    consecutiveErrors = 0;

    if (response.usage) {
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
      onTokensUsed?.(response.usage.input_tokens, response.usage.output_tokens);
    }

    // Process response content blocks
    // IMPORTANT: Collect ALL tool_use blocks first, execute them, then push
    // ONE assistant message + ONE user message with ALL tool_results.
    // This is required by the Anthropic API format.
    const assistantContent: ContentBlock[] = [...response.content];
    let hasToolUse = false;
    const toolUseBlocks: ToolUseBlock[] = [];

    // Buffer all text — rendered formatted at the end (no inline streaming)
    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        totalText += block.text;
      }
      if (block.type === 'tool_use') {
        hasToolUse = true;
        toolUseBlocks.push(block);
      }
    }

    // Execute all tool calls and collect results
    if (toolUseBlocks.length > 0) {
      // Start visual tool block on first tool execution
      if (!toolBlockStarted) {
        renderToolBlockStart();
        toolBlockStarted = true;
        toolBlockStartTime = Date.now();
      }
      const toolResults: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }> = [];

      for (const block of toolUseBlocks) {
        // Check abort between tools
        if (controller?.isAborted) {
          throw new AgentAbortError();
        }

        totalToolCalls++;
        const stepNum = totalToolCalls;
        const stepLabel = summarizeToolForStep(block.name, block.input);

        onToolCall?.(block.name);
        onStepStart?.(stepNum, block.name, stepLabel);
        sessionBuffer?.addToolCall(block.name, block.input);

        renderToolCall(block.name, block.input);

        // Check permission
        const allowed = await permissions.check(
          block.name,
          block.input,
          (msg) => process.stdout.write(msg),
        );

        if (allowed) {
          const snapshots = checkpointStore
            ? captureFileSnapshots(block.name, block.input, toolContext.projectRoot)
            : undefined;

          const tool = getTool(block.name);
          let result: string;
          let stepStatus: 'done' | 'error' = 'done';
          let stepError: string | undefined;

          if (tool) {
            try {
              result = await tool.execute(block.input, toolContext);
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              result = `Error: ${errMsg}`;
              stepStatus = 'error';
              stepError = errMsg;
              errors.push(`${block.name}: ${errMsg}`);
              consecutiveErrors++;
              sessionBuffer?.addToolError(block.name, errMsg);
            }
          } else {
            result = `Error: Unknown tool "${block.name}"`;
            stepStatus = 'error';
            stepError = `Unknown tool "${block.name}"`;
          }

          steps.push({ num: stepNum, tool: block.name, label: stepLabel, status: stepStatus, error: stepError });
          onStepEnd?.(stepNum, block.name, stepStatus, stepError);

          if (snapshots) fillSnapshotAfter(snapshots);

          if (checkpointStore) {
            checkpointStore.createForTool(block.name, block.input, result, messages.length, snapshots);
          }

          renderToolResult(block.name, result);

          // Build tool_result entry
          if (stepStatus === 'error' && consecutiveErrors < 3) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `${result}\n\n[Auto-recovery hint: The above tool call failed. Analyze the error, adjust your approach, and try again. Do not repeat the exact same failing call.]`,
              is_error: true,
            });
          } else {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
              is_error: stepStatus === 'error',
            });
          }

          if (stepStatus === 'done') consecutiveErrors = 0;

          // Store in spiral (fire-and-forget)
          if (toolContext.spiralEngine) {
            const insight = `Tool ${block.name}: ${JSON.stringify(block.input).slice(0, 200)}`;
            toolContext.spiralEngine.store(insight, 'code', { tags: ['tool_use', block.name] }).catch(() => {});
          }
        } else {
          // User denied
          renderToolDenied(block.name);
          steps.push({ num: stepNum, tool: block.name, label: stepLabel, status: 'error', error: 'denied' });
          onStepEnd?.(stepNum, block.name, 'error', 'denied by user');

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: 'User denied this action.',
            is_error: true,
          });
        }
      }

      // Push ONE assistant message with ALL content blocks,
      // then ONE user message with ALL tool_results
      messages.push({ role: 'assistant', content: assistantContent });
      messages.push({ role: 'user', content: toolResults });
    }

    // If no tool use, the model is done
    if (!hasToolUse || response.stop_reason !== 'tool_use') {
      // Stop activity indicator (writes colorful "Done" line)
      onBeforeAnswer?.();
      // Close tool block if open
      if (toolBlockStarted) {
        renderToolBlockEnd(totalToolCalls, Date.now() - toolBlockStartTime);
        toolBlockStarted = false;
      }
      // Render final formatted answer
      if (totalText) {
        renderAssistantEnd(totalText);
      }
      break;
    }
  }

  if (iterations >= maxIterations) {
    process.stdout.write(`\n  [Agent reached maximum iterations (${maxIterations}). Use --max-iterations to increase.]\n`);
  }

  return {
    text: totalText,
    toolCalls: totalToolCalls,
    tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
    aborted: false,
    steps,
    errors,
    updatedHistory: messages,
  };
}

/** Summarize a tool call for the step display */
function summarizeToolForStep(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'read_file': return `reading ${basename(String(input.path || ''))}`;
    case 'write_file': return `writing ${basename(String(input.path || ''))}`;
    case 'edit_file': return `editing ${basename(String(input.path || ''))}`;
    case 'list_directory': return `listing ${input.path || '.'}`;
    case 'search_files': return `searching "${input.pattern}"`;
    case 'find_files': return `finding "${input.pattern}"`;
    case 'run_command': return `running command`;
    case 'git_status': return 'git status';
    case 'git_diff': return 'git diff';
    case 'git_commit': return 'git commit';
    case 'git_log': return 'git log';
    case 'spiral_query': return 'querying spiral';
    case 'spiral_store': return 'storing in spiral';
    case 'bug_report': return `bug ${input.action || 'update'}`;
    case 'bug_list': return 'listing bugs';
    case 'browser_open': return `opening browser${input.url ? ': ' + String(input.url).slice(0, 30) : ''}`;
    case 'browser_navigate': return `navigating to ${String(input.url || '').slice(0, 40)}`;
    case 'browser_screenshot': return 'taking screenshot';
    case 'browser_click': return `clicking ${input.selector}`;
    case 'browser_type': return `typing in ${input.selector}`;
    case 'browser_close': return 'closing browser';
    default: return name;
  }
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

/**
 * Controller for pausing/resuming/aborting the agent loop.
 *
 * Uses an AbortController for hard cancellation of in-flight HTTP requests.
 * ESC → abort() → AbortController.abort() → HTTP request cancelled immediately.
 */
export class AgentController {
  private _paused = false;
  private _aborted = false;
  private _abortController: AbortController = new AbortController();
  private pauseResolve: (() => void) | null = null;

  get isPaused(): boolean {
    return this._paused;
  }

  get isAborted(): boolean {
    return this._aborted;
  }

  /** AbortSignal to pass to HTTP requests for hard cancellation */
  get signal(): AbortSignal {
    return this._abortController.signal;
  }

  pause(): void {
    this._paused = true;
  }

  resume(): void {
    this._paused = false;
    this._aborted = false;
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pauseResolve = null;
    }
  }

  /**
   * EMERGENCY STOP — aborts immediately:
   * 1. Sets abort flag (checked between steps)
   * 2. Cancels AbortController (kills in-flight HTTP requests)
   * 3. Resolves any pending pause promise
   */
  abort(): void {
    this._aborted = true;
    this._paused = false;
    this._abortController.abort();
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pauseResolve = null;
    }
  }

  async checkPause(): Promise<void> {
    if (this._aborted) {
      throw new AgentAbortError();
    }
    if (this._paused) {
      await new Promise<void>((resolve) => {
        this.pauseResolve = resolve;
      });
      if (this._aborted) {
        throw new AgentAbortError();
      }
    }
  }

  /** Reset state for a new round — creates fresh AbortController */
  reset(): void {
    this._paused = false;
    this._aborted = false;
    this._abortController = new AbortController();
    this.pauseResolve = null;
  }
}
