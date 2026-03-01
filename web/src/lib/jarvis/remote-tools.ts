/**
 * Remote Tools — Bridges Jarvis server-side LLM loop with CLI-side tool execution.
 *
 * Architecture: "Remote brain, local hands"
 * 1. Jarvis worker (server) decides to call a tool (e.g. read_file)
 * 2. Server sends `remote_tool_call` to CLI via relay WebSocket
 * 3. CLI executes tool locally on user's machine
 * 4. CLI sends `remote_tool_result` back via relay WebSocket
 * 5. Server feeds result back to Jarvis LLM loop
 *
 * This module manages the pending tool call queue and resolution.
 */
import { randomUUID } from 'crypto';
import type { RemoteToolCall, RemoteToolResult } from './types';

// ---------------------------------------------------------------------------
// Pending Tool Calls
// ---------------------------------------------------------------------------

interface PendingCall {
  call: RemoteToolCall;
  resolve: (result: RemoteToolResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingCalls = new Map<string, PendingCall>();

const DEFAULT_TIMEOUT_MS = 60000; // 1 minute for tool execution

// ---------------------------------------------------------------------------
// Create & Send Tool Call
// ---------------------------------------------------------------------------

/**
 * Create a remote tool call and wait for the result from CLI.
 * The caller must arrange for the call to be sent to the CLI via relay.
 *
 * @returns Promise that resolves when CLI sends the result back
 */
export function createRemoteToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  jarvisSessionId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): { call: RemoteToolCall; resultPromise: Promise<RemoteToolResult> } {
  const callId = `rtc_${randomUUID().slice(0, 12)}`;

  const call: RemoteToolCall = {
    callId,
    toolName,
    toolInput,
    jarvisSessionId,
    timestamp: Date.now(),
  };

  const resultPromise = new Promise<RemoteToolResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCalls.delete(callId);
      reject(new Error(`Remote tool call timed out after ${timeoutMs}ms: ${toolName}`));
    }, timeoutMs);

    pendingCalls.set(callId, { call, resolve, reject, timeout });
  });

  return { call, resultPromise };
}

/**
 * Resolve a pending tool call with the result from CLI.
 * Called when the relay receives a `remote_tool_result` message.
 */
export function resolveToolCall(result: RemoteToolResult): boolean {
  const pending = pendingCalls.get(result.callId);
  if (!pending) return false;

  clearTimeout(pending.timeout);
  pendingCalls.delete(result.callId);
  pending.resolve(result);
  return true;
}

/**
 * Cancel all pending tool calls for a session (e.g. when worker stops).
 */
export function cancelSessionCalls(jarvisSessionId: string): number {
  let cancelled = 0;
  for (const [callId, pending] of pendingCalls) {
    if (pending.call.jarvisSessionId === jarvisSessionId) {
      clearTimeout(pending.timeout);
      pendingCalls.delete(callId);
      pending.reject(new Error('Session cancelled'));
      cancelled++;
    }
  }
  return cancelled;
}

/**
 * Get count of pending tool calls (for monitoring).
 */
export function getPendingCallCount(): number {
  return pendingCalls.size;
}

/**
 * Get all pending calls for a session.
 */
export function getSessionPendingCalls(jarvisSessionId: string): RemoteToolCall[] {
  const calls: RemoteToolCall[] = [];
  for (const pending of pendingCalls.values()) {
    if (pending.call.jarvisSessionId === jarvisSessionId) {
      calls.push(pending.call);
    }
  }
  return calls;
}
