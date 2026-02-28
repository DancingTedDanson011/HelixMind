/**
 * Control Protocol — shared types and serializers for CLI ↔ Web communication.
 * Used by both local WebSocket (Brain Server) and remote Relay connections.
 */
import type { Session, SessionStatus } from '../sessions/session.js';

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export interface InstanceMeta {
  instanceId: string;
  projectName: string;
  projectPath: string;
  model: string;
  provider: string;
  uptime: number;
  version: string;
}

export interface SessionInfo {
  id: string;
  name: string;
  icon: string;
  status: SessionStatus;
  startTime: number;
  endTime: number;
  elapsed: number;
  outputLineCount: number;
  recentOutput: string[];
  result: { text: string; stepsCount: number; errorsCount: number } | null;
}

export interface Finding {
  sessionName: string;
  finding: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  file: string;
  timestamp: number;
}

export type BugStatus = 'open' | 'investigating' | 'fixed' | 'verified';

export interface BugInfo {
  id: number;
  description: string;
  file?: string;
  line?: number;
  status: BugStatus;
  createdAt: number;
  updatedAt: number;
  fixedAt?: number;
  fixDescription?: string;
}

export interface BrowserScreenshotInfo {
  url: string;
  title?: string;
  timestamp: number;
  /** Base64-encoded PNG screenshot (may be absent if too large) */
  imageBase64?: string;
  analysis?: string;
}

// ---------------------------------------------------------------------------
// WS message envelope
// ---------------------------------------------------------------------------

export interface WSMessage {
  type: string;
  requestId?: string;
  timestamp: number;
}

// --- Auth ---
export interface AuthMessage extends WSMessage { type: 'auth'; token: string }
export interface AuthOkMessage extends WSMessage { type: 'auth_ok' }
export interface AuthFailMessage extends WSMessage { type: 'auth_fail'; reason: string }

// --- CLI → Relay auth ---
export interface CliAuthMessage extends WSMessage { type: 'cli_auth'; apiKey: string }
export interface CliAuthOkMessage extends WSMessage { type: 'cli_auth_ok'; userId: string; instanceId: string }

// --- Requests (Browser → CLI) ---
export interface ListSessionsRequest extends WSMessage { type: 'list_sessions' }
export interface StartAutoRequest extends WSMessage { type: 'start_auto'; goal?: string }
export interface StartSecurityRequest extends WSMessage { type: 'start_security' }
export interface AbortSessionRequest extends WSMessage { type: 'abort_session'; sessionId: string }
export interface SubscribeOutputRequest extends WSMessage { type: 'subscribe_output'; sessionId: string }
export interface UnsubscribeOutputRequest extends WSMessage { type: 'unsubscribe_output'; sessionId: string }
export interface SendChatRequest extends WSMessage { type: 'send_chat'; text: string; chatId?: string; mode?: 'normal' | 'skip-permissions' }
export interface GetFindingsRequest extends WSMessage { type: 'get_findings' }
export interface GetBugsRequest extends WSMessage { type: 'get_bugs' }
export interface PingRequest extends WSMessage { type: 'ping' }

// --- Responses (CLI → Browser) ---
export interface SessionsListResponse extends WSMessage { type: 'sessions_list'; sessions: SessionInfo[] }
export interface AutoStartedResponse extends WSMessage { type: 'auto_started'; sessionId: string }
export interface SecurityStartedResponse extends WSMessage { type: 'security_started'; sessionId: string }
export interface SessionAbortedResponse extends WSMessage { type: 'session_aborted'; sessionId: string }
export interface OutputSubscribedResponse extends WSMessage { type: 'output_subscribed' }
export interface ChatReceivedResponse extends WSMessage { type: 'chat_received' }
export interface FindingsListResponse extends WSMessage { type: 'findings_list'; findings: Finding[] }
export interface BugsListResponse extends WSMessage { type: 'bugs_list'; bugs: BugInfo[] }
export interface PongResponse extends WSMessage { type: 'pong' }

// --- Server-Push Events (CLI → Browser, async) ---
export interface SessionUpdatedEvent extends WSMessage { type: 'session_updated'; session: SessionInfo }
export interface SessionCreatedEvent extends WSMessage { type: 'session_created'; session: SessionInfo }
export interface SessionRemovedEvent extends WSMessage { type: 'session_removed'; sessionId: string }
export interface OutputLineEvent extends WSMessage { type: 'output_line'; sessionId: string; line: string; lineIndex: number }
export interface InstanceMetaEvent extends WSMessage { type: 'instance_meta'; instance: InstanceMeta }
export interface BugCreatedEvent extends WSMessage { type: 'bug_created'; bug: BugInfo }
export interface BugUpdatedEvent extends WSMessage { type: 'bug_updated'; bug: BugInfo }
export interface BrowserScreenshotEvent extends WSMessage { type: 'browser_screenshot'; screenshot: BrowserScreenshotInfo }

// --- Web Chat Events (CLI → Browser, streamed) ---
export interface ChatStartedEvent extends WSMessage { type: 'chat_started'; chatId: string }
export interface ChatTextChunkEvent extends WSMessage { type: 'chat_text_chunk'; chatId: string; text: string }
export interface ChatToolStartEvent extends WSMessage { type: 'chat_tool_start'; chatId: string; stepNum: number; toolName: string; toolInput: Record<string, unknown> }
export interface ChatToolEndEvent extends WSMessage { type: 'chat_tool_end'; chatId: string; stepNum: number; toolName: string; status: 'done' | 'error'; result?: string }
export interface ChatCompleteEvent extends WSMessage { type: 'chat_complete'; chatId: string; text: string; steps: number; tokensUsed: { input: number; output: number } }
export interface ChatErrorEvent extends WSMessage { type: 'chat_error'; chatId: string; error: string }

// Union of all control request types
export type ControlRequest =
  | ListSessionsRequest
  | StartAutoRequest
  | StartSecurityRequest
  | AbortSessionRequest
  | SubscribeOutputRequest
  | UnsubscribeOutputRequest
  | SendChatRequest
  | GetFindingsRequest
  | GetBugsRequest
  | PingRequest;

// ---------------------------------------------------------------------------
// Control handler callbacks — registered from chat.ts
// ---------------------------------------------------------------------------

export interface ControlHandlers {
  listSessions(): SessionInfo[];
  startAuto(goal?: string): string;          // returns sessionId
  startSecurity(): string;                    // returns sessionId
  abortSession(sessionId: string): boolean;
  sendChat(text: string, chatId?: string, mode?: 'normal' | 'skip-permissions'): void;
  getFindings(): Finding[];
  getBugs(): BugInfo[];
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

export function serializeSession(session: Session): SessionInfo {
  const recentOutput = session.output.slice(-20);
  return {
    id: session.id,
    name: session.name,
    icon: session.icon,
    status: session.status,
    startTime: session.startTime,
    endTime: session.endTime,
    elapsed: session.elapsed,
    outputLineCount: session.output.length,
    recentOutput,
    result: session.result
      ? {
          text: session.result.text.slice(0, 2000),
          stepsCount: session.result.steps.length,
          errorsCount: session.result.errors.length,
        }
      : null,
  };
}

let instanceStartTime = Date.now();

export function buildInstanceMeta(
  projectName: string,
  projectPath: string,
  model: string,
  provider: string,
  version: string,
  instanceId: string,
): InstanceMeta {
  return {
    instanceId,
    projectName,
    projectPath,
    model,
    provider,
    uptime: Math.floor((Date.now() - instanceStartTime) / 1000),
    version,
  };
}

/** Reset instance start time (called once on CLI startup) */
export function resetInstanceStartTime(): void {
  instanceStartTime = Date.now();
}
