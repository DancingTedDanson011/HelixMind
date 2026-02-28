/**
 * Web Chat Handler — dedicated handler for web-originated chat requests.
 *
 * Each web chat gets its own session (history, buffer, controller, undo stack)
 * so it runs independently of the interactive terminal session.
 * Agent responses are streamed back via callbacks that the caller wires to
 * pushControlEvent() for delivery over WebSocket.
 */
import { runAgentLoop, AgentController, AgentAbortError } from '../agent/loop.js';
import type { AgentLoopResult } from '../agent/loop.js';
import { PermissionManager } from '../agent/permissions.js';
import { UndoStack } from '../agent/undo.js';
import { SessionBuffer } from '../context/session-buffer.js';
import { assembleSystemPrompt } from '../context/assembler.js';
import { getAllToolDefinitions, initializeTools } from '../agent/tools/registry.js';
import { trimConversation, estimateTokens } from '../context/trimmer.js';
import type { LLMProvider, ToolMessage } from '../providers/types.js';
import type { SpiralQueryResult } from '../../types.js';
import type { CheckpointStore } from '../checkpoints/store.js';
import type { BugJournal } from '../bugs/journal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebChatCallbacks {
  onStarted: (chatId: string) => void;
  onTextChunk: (chatId: string, text: string) => void;
  onToolStart: (chatId: string, stepNum: number, toolName: string, toolInput: Record<string, unknown>) => void;
  onToolEnd: (chatId: string, stepNum: number, toolName: string, status: 'done' | 'error', result?: string) => void;
  onComplete: (chatId: string, text: string, steps: number, tokensUsed: { input: number; output: number }) => void;
  onError: (chatId: string, error: string) => void;
}

export interface WebChatDeps {
  provider: LLMProvider;
  spiralEngine: any;
  project: any;
  config: any;
  checkpointStore: CheckpointStore;
  bugJournal?: BugJournal;
}

interface WebChatSession {
  history: ToolMessage[];
  buffer: SessionBuffer;
  controller: AgentController;
  undoStack: UndoStack;
}

// ---------------------------------------------------------------------------
// Session registry (keyed by chatId)
// ---------------------------------------------------------------------------

const sessions = new Map<string, WebChatSession>();

function getOrCreateSession(chatId: string): WebChatSession {
  let session = sessions.get(chatId);
  if (!session) {
    session = {
      history: [],
      buffer: new SessionBuffer(),
      controller: new AgentController(),
      undoStack: new UndoStack(),
    };
    sessions.set(chatId, session);
  }
  return session;
}

/** Abort a running web chat session */
export function abortWebChat(chatId: string): boolean {
  const session = sessions.get(chatId);
  if (session) {
    session.controller.abort();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleWebChat(
  text: string,
  chatId: string,
  deps: WebChatDeps,
  callbacks: WebChatCallbacks,
): Promise<void> {
  const session = getOrCreateSession(chatId);
  const { provider, spiralEngine, project, config, checkpointStore, bugJournal } = deps;

  // Reset controller for new turn
  session.controller.reset();

  // Permissions: skip-permissions for web (no terminal for prompts)
  const permissions = new PermissionManager();
  permissions.setSkipPermissions(true);

  // Signal start
  callbacks.onStarted(chatId);

  try {
    // Query spiral context
    let spiralContext: SpiralQueryResult = {
      level_1: [], level_2: [], level_3: [], level_4: [], level_5: [],
      total_tokens: 0, node_count: 0,
    };

    if (spiralEngine) {
      try {
        spiralContext = await spiralEngine.query(text, config.spiral?.maxTokensBudget);
      } catch { /* continue without spiral */ }
    }

    // Assemble system prompt
    const sessionContext = session.buffer.buildContext();
    const bugSummary = bugJournal?.getSummaryForPrompt() ?? null;
    const systemPrompt = assembleSystemPrompt(
      project.name !== 'unknown' ? project : null,
      spiralContext,
      sessionContext || undefined,
      { provider: provider.name, model: provider.model },
      bugSummary,
    );

    // Track tokens
    let totalInput = 0;
    let totalOutput = 0;

    // Run agent loop with streaming callbacks
    const result: AgentLoopResult = await runAgentLoop(
      text,
      session.history,
      {
        provider,
        systemPrompt,
        permissions,
        toolContext: {
          projectRoot: process.cwd(),
          undoStack: session.undoStack,
          spiralEngine,
          bugJournal,
        },
        checkpointStore,
        sessionBuffer: session.buffer,
        onTextBlock: (chunk) => {
          callbacks.onTextChunk(chatId, chunk);
        },
        onToolCallDetail: (stepNum, name, input) => {
          callbacks.onToolStart(chatId, stepNum, name, input);
        },
        onStepEnd: (stepNum, toolName, status, error) => {
          callbacks.onToolEnd(chatId, stepNum, toolName, status, error);
        },
        onTokensUsed: (inp, out) => {
          totalInput += inp;
          totalOutput += out;
        },
        // No terminal rendering for web chat
        onThinking: () => {},
        onBeforeAnswer: () => {},
      },
      session.controller,
    );

    // Adopt updated history
    session.history.length = 0;
    session.history.push(...result.updatedHistory);

    // Update session buffer
    session.buffer.addUserMessage(text);
    if (result.text) {
      session.buffer.addAssistantSummary(result.text.slice(0, 500));
    }

    // Signal completion
    callbacks.onComplete(chatId, result.text, result.toolCalls, {
      input: totalInput,
      output: totalOutput,
    });

    // Store in spiral (fire-and-forget)
    if (spiralEngine && result.text) {
      spiralEngine.store(
        `Web chat: ${text.slice(0, 100)} → ${result.text.slice(0, 200)}`,
        'conversation',
        { tags: ['web_chat'] },
      ).catch(() => {});
    }
  } catch (err) {
    if (err instanceof AgentAbortError) {
      callbacks.onError(chatId, 'Agent aborted');
    } else {
      const errMsg = err instanceof Error ? err.message : String(err);
      callbacks.onError(chatId, errMsg);
    }
  }
}
