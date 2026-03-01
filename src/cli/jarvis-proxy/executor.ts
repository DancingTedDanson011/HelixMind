/**
 * Jarvis Proxy Executor — Receives remote tool calls from the server,
 * executes them locally, and sends results back.
 *
 * "Remote brain, local hands" — server runs Jarvis LLM logic,
 * CLI executes filesystem/git/browser tools on the user's machine.
 */

import type { RemoteToolCallResult } from '../brain/control-protocol.js';

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

/** Check if a WS message is a remote tool call from the server */
export function isRemoteToolCall(msg: unknown): boolean {
  if (!msg || typeof msg !== 'object') return false;
  return (msg as any).type === 'remote_tool_call';
}

// ---------------------------------------------------------------------------
// Result Factory
// ---------------------------------------------------------------------------

/** Create a remote tool result message to send back to the server */
export function createToolResult(
  callId: string,
  jarvisSessionId: string,
  success: boolean,
  result?: string,
  error?: string,
): RemoteToolCallResult {
  return {
    type: 'remote_tool_result',
    callId,
    jarvisSessionId,
    success,
    result,
    error,
    timestamp: Date.now(),
  };
}
