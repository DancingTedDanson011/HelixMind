/**
 * Relay Client — outbound WebSocket connection from CLI to the Web Server relay.
 * Forwards brain events and handles control messages from remote browsers.
 */
import WebSocket from 'ws';
import type { ControlHandlers, ControlRequest, InstanceMeta } from './control-protocol.js';
import type { BrainServer } from './server.js';

interface RelayClient {
  close(): void;
}

export function createRelayClient(
  relayUrl: string,
  apiKey: string,
  handlers: ControlHandlers,
  getInstanceMeta: () => InstanceMeta,
  brainServer: BrainServer | null,
): RelayClient {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let backoff = 1000;
  let closed = false;
  let authenticated = false;

  function connect(): void {
    if (closed) return;

    // Normalize URL: ensure it ends with /api/relay/cli
    let url = relayUrl.replace(/\/+$/, '');
    if (!url.includes('/api/relay')) {
      url += '/api/relay/cli';
    }
    // Convert http(s) to ws(s)
    url = url.replace(/^http/, 'ws');

    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.on('open', () => {
      backoff = 1000;
      // Send auth
      ws!.send(JSON.stringify({
        type: 'cli_auth',
        apiKey,
        timestamp: Date.now(),
      }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));

        if (msg.type === 'cli_auth_ok') {
          authenticated = true;
          // Send instance meta
          const meta = getInstanceMeta();
          ws!.send(JSON.stringify({
            type: 'instance_meta',
            instance: meta,
            timestamp: Date.now(),
          }));

          // Start heartbeat
          pingTimer = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            }
          }, 30000);

          return;
        }

        if (msg.type === 'cli_auth_fail') {
          // Don't reconnect on auth failure
          closed = true;
          ws?.close();
          return;
        }

        // Handle control messages from relay (forwarded from browser)
        if (authenticated && isControlRequest(msg.type)) {
          handleControlMessage(msg as ControlRequest);
        }
      } catch { /* ignore malformed */ }
    });

    ws.on('close', () => {
      authenticated = false;
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      scheduleReconnect();
    });

    ws.on('error', () => {
      // Error triggers close event, which handles reconnect
    });
  }

  function handleControlMessage(msg: ControlRequest): void {
    const requestId = msg.requestId;

    switch (msg.type) {
      case 'ping':
        sendRelay({ type: 'pong', requestId, timestamp: Date.now() });
        break;

      case 'list_sessions': {
        const sessions = handlers.listSessions();
        sendRelay({ type: 'sessions_list', sessions, requestId, timestamp: Date.now() });
        break;
      }

      case 'start_auto': {
        const sessionId = handlers.startAuto(msg.goal);
        sendRelay({ type: 'auto_started', sessionId, requestId, timestamp: Date.now() });
        break;
      }

      case 'start_security': {
        const sessionId = handlers.startSecurity();
        sendRelay({ type: 'security_started', sessionId, requestId, timestamp: Date.now() });
        break;
      }

      case 'abort_session': {
        const success = handlers.abortSession(msg.sessionId);
        sendRelay({ type: 'session_aborted', sessionId: msg.sessionId, success, requestId, timestamp: Date.now() });
        break;
      }

      case 'send_chat': {
        const chatMsg = msg as { text: string; chatId?: string; mode?: 'normal' | 'skip-permissions' };
        handlers.sendChat(chatMsg.text, chatMsg.chatId, chatMsg.mode);
        sendRelay({ type: 'chat_received', requestId, timestamp: Date.now() });
        break;
      }

      case 'get_findings': {
        const findings = handlers.getFindings();
        sendRelay({ type: 'findings_list', findings, requestId, timestamp: Date.now() });
        break;
      }

      case 'get_bugs': {
        const bugs = handlers.getBugs();
        sendRelay({ type: 'bugs_list', bugs, requestId, timestamp: Date.now() });
        break;
      }
    }
  }

  function sendRelay(msg: Record<string, unknown>): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  /** Forward brain events to the relay */
  function forwardEvent(event: Record<string, unknown>): void {
    sendRelay(event);
  }

  function scheduleReconnect(): void {
    if (closed) return;
    reconnectTimer = setTimeout(() => {
      backoff = Math.min(backoff * 2, 30000);
      connect();
    }, backoff);
  }

  // Start connection
  connect();

  // Hook into brain server push events if available
  if (brainServer) {
    const origPushEvent = brainServer.pushEvent.bind(brainServer);
    const origPushControlEvent = brainServer.pushControlEvent.bind(brainServer);

    // Monkey-patch to also forward to relay
    brainServer.pushEvent = (event) => {
      origPushEvent(event);
      forwardEvent(event);
    };
    brainServer.pushControlEvent = (event) => {
      origPushControlEvent(event);
      forwardEvent(event);
    };
  }

  return {
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      ws?.close();
    },
  };
}

function isControlRequest(type: string): boolean {
  return [
    'list_sessions', 'start_auto', 'start_security',
    'abort_session', 'subscribe_output', 'unsubscribe_output',
    'send_chat', 'get_findings', 'get_bugs', 'ping',
  ].includes(type);
}
