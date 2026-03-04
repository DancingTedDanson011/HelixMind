import type {
  LLMProvider,
  ToolMessage,
  ToolDefinition,
  ContentBlock,
  ToolUseBlock,
} from '../providers/types.js';
import { resolve } from 'node:path';
import { getTool, getAllToolDefinitions, type ToolContext } from './tools/registry.js';
import { PermissionManager } from './permissions.js';
import { validatePathEx } from './sandbox.js';
import { renderToolCall, renderToolResult, renderToolDenied, resetToolCounter, renderToolBlockStart, renderToolBlockEnd } from '../ui/tool-output.js';
import { renderAssistantEnd } from '../ui/chat-view.js';
import type { CheckpointStore } from '../checkpoints/store.js';
import { captureFileSnapshots, fillSnapshotAfter } from '../checkpoints/revert.js';
import type { TaskStep } from '../ui/activity.js';
import type { SessionBuffer } from '../context/session-buffer.js';
import { isRateLimitError, handleRateLimitError, detectCreditsExhausted } from '../providers/rate-limiter.js';
import { trimConversation, estimateTokens } from '../context/trimmer.js';

/** Produce a targeted recovery hint based on the error content. */
function getErrorHint(errorResult: string): string {
  const lower = errorResult.toLowerCase();
  if (lower.includes('enoent') || lower.includes('no such file') || lower.includes('not found') || lower.includes('does not exist')) {
    return 'The file or path does not exist. Verify the path using list_directory or find_files before retrying.';
  }
  if (lower.includes('eperm') || lower.includes('permission denied') || lower.includes('access denied')) {
    return 'Permission denied. Try a different approach or ask the user for guidance.';
  }
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('etimedout')) {
    return 'The operation timed out. Consider breaking it into smaller, faster operations.';
  }
  if (lower.includes('ebusy') || lower.includes('resource busy') || lower.includes('locked')) {
    return 'The file is locked by another process. Wait a moment or use a different file path.';
  }
  if (lower.includes('enospc') || lower.includes('no space')) {
    return 'Disk space exhausted. Cannot write more data.';
  }
  if (lower.includes('syntax error') || lower.includes('syntaxerror') || lower.includes('unexpected token')) {
    return 'Syntax error in the code or command. Review the syntax carefully and fix the structure.';
  }
  return 'The above tool call failed. Analyze the error, adjust your approach, and try again. Do not repeat the exact same failing call.';
}

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
  /** Called when the LLM produces a text block — used by web chat to stream text */
  onTextBlock?: (text: string) => void;
  /** Called when the LLM produces a thinking/reasoning text BEFORE tool calls in the same response */
  onThinkingText?: (text: string) => void;
  /** Called when a tool call is about to execute — used by web chat to stream tool details */
  onToolCallDetail?: (stepNum: number, name: string, input: Record<string, unknown>) => void;
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
    onTextBlock,
    onThinkingText,
    onToolCallDetail,
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
    const textBlocks: string[] = [];

    // First pass: separate text and tool_use blocks
    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        textBlocks.push(block.text);
      }
      if (block.type === 'tool_use') {
        hasToolUse = true;
        toolUseBlocks.push(block);
      }
    }

    // Handle text: if tool calls follow in the same response, show text as "thinking"
    // (intermediate reasoning). Only the final answer text (no tool calls) gets rendered formatted.
    for (const text of textBlocks) {
      if (hasToolUse) {
        // This is intermediate thinking — show inline before tools execute
        onThinkingText?.(text);
      } else {
        // This is the final answer — collect for formatted rendering
        totalText += text;
      }
      onTextBlock?.(text);
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
        onToolCallDetail?.(stepNum, block.name, block.input);
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
          // Check for external path access (outside project root)
          const pathInput = (block.input.path as string | undefined);
          if (pathInput && FILE_DIR_TOOLS.has(block.name)) {
            try {
              const { external } = validatePathEx(pathInput, toolContext.projectRoot);
              if (external) {
                const absPath = resolve(toolContext.projectRoot, pathInput);
                const extAllowed = await permissions.checkExternalAccess(
                  block.name,
                  absPath,
                  block.input,
                  (msg) => process.stdout.write(msg),
                );
                if (!extAllowed) {
                  renderToolDenied(block.name);
                  steps.push({ num: stepNum, tool: block.name, label: stepLabel, status: 'error', error: 'external access denied' });
                  onStepEnd?.(stepNum, block.name, 'error', 'external access denied by user');
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: 'Access denied: External path access was denied by the user.',
                    is_error: true,
                  });
                  continue;
                }
              }
            } catch {
              // SecurityError from validatePathEx (sensitive files, symlinks) — let the tool handle it
            }
          }

          const snapshots = checkpointStore
            ? captureFileSnapshots(block.name, block.input, toolContext.projectRoot)
            : undefined;

          // Check file locks for write operations
          if (toolContext.lockFile && (block.name === 'write_file' || block.name === 'edit_file')) {
            const filePath = block.input.path as string | undefined;
            if (filePath && !toolContext.lockFile(filePath)) {
              renderToolResult(block.name, 'File locked by another agent. Try a different file or wait.');
              steps.push({ num: stepNum, tool: block.name, label: stepLabel, status: 'error', error: 'file locked' });
              onStepEnd?.(stepNum, block.name, 'error', 'file locked');
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: 'File locked by another agent. Try a different file or wait.',
                is_error: true,
              });
              continue;
            }
          }

          const tool = getTool(block.name);
          let result: string;
          let stepStatus: 'done' | 'error' = 'done';
          let stepError: string | undefined;

          // Query learning journal for hints
          let learningHintIds: number[] = [];
          if (toolContext.learningJournal) {
            const hints = toolContext.learningJournal.getPromptSection(block.name, block.input);
            if (hints) {
              learningHintIds = toolContext.learningJournal
                .queryRelevant(block.name, block.input)
                .map(e => e.id);
            }
          }

          if (tool) {
            try {
              result = await tool.execute(block.input, toolContext);

              // Reinforce successful learnings that were relevant
              if (toolContext.learningJournal && learningHintIds.length > 0) {
                for (const hintId of learningHintIds) {
                  toolContext.learningJournal.reinforceSuccess(hintId);
                }
              }
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              result = `Error: ${errMsg}`;
              stepStatus = 'error';
              stepError = errMsg;
              errors.push(`${block.name}: ${errMsg}`);
              consecutiveErrors++;
              sessionBuffer?.addToolError(block.name, errMsg);

              // Track error for potential learning (error→success detection)
              if (toolContext.learningJournal) {
                (toolContext as any).__lastToolError = {
                  toolName: block.name,
                  error: errMsg,
                  input: block.input,
                };
              }
            }
          } else {
            result = `Error: Unknown tool "${block.name}"`;
            stepStatus = 'error';
            stepError = `Unknown tool "${block.name}"`;
          }

          // Error→Success detection: if previous tool errored and this one succeeded on same tool type
          if (stepStatus === 'done' && toolContext.learningJournal) {
            const lastErr = (toolContext as any).__lastToolError;
            if (lastErr && lastErr.toolName === block.name) {
              toolContext.learningJournal.recordLearning(
                lastErr.error,
                `Succeeded with input: ${JSON.stringify(block.input).slice(0, 150)}`,
                'tool_error',
                `${block.name} ${(block.input.path as string || '').split('.').pop() || ''}`.trim(),
                [block.name],
              );
              delete (toolContext as any).__lastToolError;
            }
          }

          // Release file lock after write operation
          if (toolContext.unlockFile && (block.name === 'write_file' || block.name === 'edit_file')) {
            const filePath = block.input.path as string | undefined;
            if (filePath) toolContext.unlockFile(filePath);
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
              content: `${result}\n\n[Auto-recovery hint: ${getErrorHint(result)}]`,
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

          // Store in spiral (fire-and-forget) — skip read-only tools to reduce noise
          const readOnlyTools = new Set([
            'read_file', 'search_files', 'find_files', 'list_directory',
            'git_status', 'git_log', 'git_diff', 'spiral_query',
            'bug_list', 'browser_screenshot',
          ]);
          if (toolContext.spiralEngine && !readOnlyTools.has(block.name)) {
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

/** Tools that operate on file/directory paths and need external access checks */
const FILE_DIR_TOOLS = new Set([
  'read_file', 'write_file', 'edit_file', 'list_directory', 'search_files', 'find_files',
]);

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
