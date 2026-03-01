import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { BrainExport } from './exporter.js';
import { generateBrainHTML } from './template.js';
import type {
  ControlHandlers,
  ControlRequest,
  InstanceMeta,
  WSMessage,
} from './control-protocol.js';

export type VoiceInputHandler = (text: string) => void;
export type ScopeSwitchHandler = (scope: 'project' | 'global') => void;
export type ModelActivateHandler = (model: string) => void;

export interface BrainServer {
  port: number;
  url: string;
  connectionToken: string;
  /** Push incremental update to all connected browsers */
  pushUpdate(data: BrainExport): void;
  /** Push an arbitrary event to all connected browsers */
  pushEvent(event: Record<string, unknown>): void;
  /** Push event only to authenticated control clients */
  pushControlEvent(event: Record<string, unknown>): void;
  /** Register handler for voice input from browser */
  onVoiceInput(handler: VoiceInputHandler): void;
  /** Register handler for scope switch from browser */
  onScopeSwitch(handler: ScopeSwitchHandler): void;
  /** Register handler for model activation from browser */
  onModelActivate(handler: ModelActivateHandler): void;
  /** Register control message handlers for CLI ↔ Web protocol */
  registerControlHandlers(handlers: ControlHandlers): void;
  /** Set instance metadata for discovery endpoint */
  setInstanceMeta(meta: InstanceMeta): void;
  /** Shut down server */
  close(): void;
}

const OLLAMA_BASE = 'http://localhost:11434';

/** Proxy a request to the Ollama API and return the response */
async function ollamaProxy(
  path: string,
  res: ServerResponse,
  method = 'GET',
  body?: string,
): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const opts: RequestInit = { method, signal: controller.signal };
    if (body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = body;
    }
    const upstream = await fetch(`${OLLAMA_BASE}${path}`, opts);
    clearTimeout(timer);
    res.writeHead(upstream.ok ? 200 : upstream.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(await upstream.text());
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ollama not reachable' }));
  }
}

/** Stream an Ollama pull to the browser via SSE */
async function ollamaPullStream(
  modelName: string,
  res: ServerResponse,
): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  let hadError = false;
  try {
    const upstream = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });
    if (!upstream.ok || !upstream.body) {
      res.write(`data: ${JSON.stringify({ error: `Pull failed (HTTP ${upstream.status}). Model "${modelName}" may not exist in Ollama registry.` })}\n\n`);
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        // Check if Ollama returned an error in the stream
        try {
          const parsed = JSON.parse(line);
          if (parsed.error) hadError = true;
        } catch { /* not JSON, relay as-is */ }
        res.write(`data: ${line}\n\n`);
      }
    }
    // Only send success if no error occurred in the stream
    if (!hadError) {
      res.write(`data: ${JSON.stringify({ status: 'success' })}\n\n`);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: `Connection to Ollama failed: ${err instanceof Error ? err.message : String(err)}` })}\n\n`);
  }
  res.end();
}

/** Read body from an incoming request */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
  });
}

/**
 * Start an HTTP + WebSocket server that serves the brain visualization
 * and pushes live updates to all connected browsers.
 */
export function startBrainServer(initialData: BrainExport): Promise<BrainServer> {
  let latestData = initialData;
  let html = generateBrainHTML(initialData);

  // Unique connection token for this CLI session (required for WS auth)
  const connectionToken = randomUUID();
  let instanceMeta: InstanceMeta | null = null;
  let controlHandlers: ControlHandlers | null = null;

  const httpServer = createServer(async (req, res) => {
    const url = req.url || '/';

    // CORS headers for all JSON endpoints
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);

    // --- Discovery endpoints (no auth required) ---
    } else if (url === '/api/instance') {
      const meta = instanceMeta ?? {
        instanceId: 'unknown',
        projectName: 'HelixMind',
        projectPath: process.cwd(),
        model: 'unknown',
        provider: 'unknown',
        uptime: 0,
        version: '0.1.0',
      };
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify(meta));

    } else if (url === '/api/token') {
      // Full token — safe because server only listens on 127.0.0.1
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ token: connectionToken }));

    } else if (url === '/api/token-hint') {
      const hint = connectionToken.slice(-4);
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ hint }));

    } else if (url === '/api/data') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(latestData));

    // --- Ollama proxy endpoints ---
    } else if (url === '/api/ollama/status') {
      await ollamaProxy('/api/version', res);
    } else if (url === '/api/ollama/models') {
      await ollamaProxy('/api/tags', res);
    } else if (url === '/api/ollama/running') {
      await ollamaProxy('/api/ps', res);
    } else if (url === '/api/ollama/pull' && req.method === 'POST') {
      const body = await readBody(req);
      try {
        const { name } = JSON.parse(body) as { name: string };
        await ollamaPullStream(name, res);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    } else if (url === '/api/ollama/delete' && req.method === 'POST') {
      const body = await readBody(req);
      await ollamaProxy('/api/delete', res, 'DELETE', body);
    } else if (url === '/api/cloud/models') {
      // Return cloud models from known providers
      const cloudModels = [
        { name: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', size: 'cloud' },
        { name: 'anthropic/claude-opus-4-6', provider: 'anthropic', size: 'cloud' },
        { name: 'openai/gpt-4o', provider: 'openai', size: 'cloud' },
        { name: 'openai/gpt-4o-mini', provider: 'openai', size: 'cloud' },
        { name: 'deepseek/deepseek-chat', provider: 'deepseek', size: 'cloud' },
        { name: 'deepseek/deepseek-reasoner', provider: 'deepseek', size: 'cloud' },
        { name: 'groq/llama-3.3-70b-versatile', provider: 'groq', size: 'cloud' },
        { name: 'together/meta-llama/Llama-3.3-70B-Instruct-Turbo', provider: 'together', size: 'cloud' },
      ];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: cloudModels }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve, reject) => {
    // Find a free port starting from 9420 (try up to 20 ports)
    let port = 9420;
    const maxPort = 9440;

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && port < maxPort) {
        port++;
        httpServer.listen(port, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    httpServer.listen(port, '127.0.0.1', () => {
      // Create WebSocket server AFTER HTTP server is successfully listening
      const wss = new WebSocketServer({ server: httpServer });

      // Brain visualization clients (legacy — no auth required)
      const brainClients = new Set<WebSocket>();

      // Authenticated control clients (CLI ↔ Web protocol)
      const controlClients = new Set<WebSocket>();

      // Output subscriptions: sessionId → set of subscribed clients
      const outputSubscriptions = new Map<string, Set<WebSocket>>();

      let voiceHandler: VoiceInputHandler | null = null;
      let scopeSwitchHandler: ScopeSwitchHandler | null = null;
      let modelActivateHandler: ModelActivateHandler | null = null;

      /** Send a JSON message to a specific WebSocket */
      function sendTo(ws: WebSocket, msg: Record<string, unknown>): void {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        }
      }

      /** Dispatch a control request and send the response */
      function handleControlMessage(ws: WebSocket, msg: ControlRequest): void {
        if (!controlHandlers) {
          sendTo(ws, { type: 'error', message: 'Control handlers not registered', requestId: msg.requestId, timestamp: Date.now() });
          return;
        }

        const requestId = msg.requestId;

        switch (msg.type) {
          case 'ping':
            sendTo(ws, { type: 'pong', requestId, timestamp: Date.now() });
            break;

          case 'list_sessions': {
            const sessions = controlHandlers.listSessions();
            sendTo(ws, { type: 'sessions_list', sessions, requestId, timestamp: Date.now() });
            break;
          }

          case 'start_auto': {
            const sessionId = controlHandlers.startAuto(msg.goal);
            sendTo(ws, { type: 'auto_started', sessionId, requestId, timestamp: Date.now() });
            break;
          }

          case 'start_security': {
            const sessionId = controlHandlers.startSecurity();
            sendTo(ws, { type: 'security_started', sessionId, requestId, timestamp: Date.now() });
            break;
          }

          case 'abort_session': {
            const success = controlHandlers.abortSession(msg.sessionId);
            sendTo(ws, { type: 'session_aborted', sessionId: msg.sessionId, success, requestId, timestamp: Date.now() });
            break;
          }

          case 'subscribe_output': {
            const sessionId = msg.sessionId;
            if (!outputSubscriptions.has(sessionId)) {
              outputSubscriptions.set(sessionId, new Set());
            }
            outputSubscriptions.get(sessionId)!.add(ws);
            sendTo(ws, { type: 'output_subscribed', requestId, timestamp: Date.now() });
            break;
          }

          case 'unsubscribe_output': {
            const subs = outputSubscriptions.get(msg.sessionId);
            if (subs) subs.delete(ws);
            break;
          }

          case 'send_chat': {
            controlHandlers.sendChat(msg.text, msg.chatId, msg.mode);
            sendTo(ws, { type: 'chat_received', requestId, timestamp: Date.now() });
            break;
          }

          case 'get_findings': {
            const findings = controlHandlers.getFindings();
            sendTo(ws, { type: 'findings_list', findings, requestId, timestamp: Date.now() });
            break;
          }

          case 'get_bugs': {
            const bugs = controlHandlers.getBugs();
            sendTo(ws, { type: 'bugs_list', bugs, requestId, timestamp: Date.now() });
            break;
          }

          // --- Jarvis ---
          case 'start_jarvis': {
            const sessionId = controlHandlers.startJarvis();
            sendTo(ws, { type: 'jarvis_started', sessionId, requestId, timestamp: Date.now() });
            break;
          }

          case 'stop_jarvis': {
            const success = controlHandlers.stopJarvis();
            sendTo(ws, { type: 'jarvis_stopped', success, requestId, timestamp: Date.now() });
            break;
          }

          case 'pause_jarvis': {
            const success = controlHandlers.pauseJarvis();
            sendTo(ws, { type: 'jarvis_paused', success, requestId, timestamp: Date.now() });
            break;
          }

          case 'resume_jarvis': {
            const success = controlHandlers.resumeJarvis();
            sendTo(ws, { type: 'jarvis_resumed', success, requestId, timestamp: Date.now() });
            break;
          }

          case 'add_jarvis_task': {
            const task = controlHandlers.addJarvisTask(
              (msg as any).title,
              (msg as any).description,
              { priority: (msg as any).priority, dependencies: (msg as any).dependencies, tags: (msg as any).tags },
            );
            sendTo(ws, { type: 'jarvis_task_added', task, requestId, timestamp: Date.now() });
            break;
          }

          case 'list_jarvis_tasks': {
            const tasks = controlHandlers.listJarvisTasks();
            sendTo(ws, { type: 'jarvis_tasks_list', tasks, requestId, timestamp: Date.now() });
            break;
          }

          case 'get_jarvis_status': {
            const status = controlHandlers.getJarvisStatus();
            sendTo(ws, { type: 'jarvis_status', status, requestId, timestamp: Date.now() });
            break;
          }
        }
      }

      wss.on('connection', (ws) => {
        let authenticated = false;
        let authTimeout: ReturnType<typeof setTimeout> | null = null;

        // Give client 5 seconds to authenticate; if no auth message arrives,
        // treat as legacy brain client (backward-compatible)
        authTimeout = setTimeout(() => {
          if (!authenticated) {
            // Legacy brain client — add to brain clients without auth
            brainClients.add(ws);
            ws.send(JSON.stringify({ type: 'full_sync', data: latestData }));
          }
        }, 5000);

        ws.on('close', () => {
          brainClients.delete(ws);
          controlClients.delete(ws);
          // Clean up output subscriptions
          for (const subs of outputSubscriptions.values()) {
            subs.delete(ws);
          }
        });

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(String(raw));

            // Auth handshake
            if (msg.type === 'auth') {
              if (authTimeout) { clearTimeout(authTimeout); authTimeout = null; }

              if (msg.token === connectionToken) {
                authenticated = true;
                controlClients.add(ws);
                // Also add to brain clients so they get brain events too
                brainClients.add(ws);
                sendTo(ws, { type: 'auth_ok', timestamp: Date.now() });
                // Send full sync after auth
                ws.send(JSON.stringify({ type: 'full_sync', data: latestData }));
                // Send instance meta if available
                if (instanceMeta) {
                  sendTo(ws, { type: 'instance_meta', instance: instanceMeta, timestamp: Date.now() });
                }
                // Auto-push sessions list so clients don't need to request it
                if (controlHandlers) {
                  const sessions = controlHandlers.listSessions();
                  for (const session of sessions) {
                    sendTo(ws, { type: 'session_created', session, timestamp: Date.now() });
                  }
                }
              } else {
                sendTo(ws, { type: 'auth_fail', reason: 'Invalid token', timestamp: Date.now() });
                ws.close(4001, 'Invalid token');
              }
              return;
            }

            // Control messages (only from authenticated clients)
            if (authenticated && isControlRequest(msg.type)) {
              handleControlMessage(ws, msg as ControlRequest);
              return;
            }

            // Legacy brain messages (voice, scope, model)
            if (msg.type === 'voice_input' && typeof msg.text === 'string' && voiceHandler) {
              voiceHandler(msg.text);
            }
            if (msg.type === 'scope_switch' && (msg.scope === 'project' || msg.scope === 'global') && scopeSwitchHandler) {
              scopeSwitchHandler(msg.scope);
            }
            if (msg.type === 'activate_model' && typeof msg.model === 'string' && modelActivateHandler) {
              modelActivateHandler(msg.model);
            }
          } catch { /* ignore malformed */ }
        });
      });

      const addr = httpServer.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;

      resolve({
        port: actualPort,
        url: `http://127.0.0.1:${actualPort}`,
        connectionToken,
        pushUpdate(data: BrainExport) {
          latestData = data;
          html = generateBrainHTML(data);
          const msg = JSON.stringify({ type: 'full_sync', data });
          for (const ws of brainClients) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(msg);
            }
          }
        },
        pushEvent(event: Record<string, unknown>) {
          const msg = JSON.stringify(event);
          for (const ws of brainClients) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(msg);
            }
          }
        },
        pushControlEvent(event: Record<string, unknown>) {
          const msg = JSON.stringify(event);
          for (const ws of controlClients) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(msg);
            }
          }
          // Also forward output_line events to subscribed clients
          if (event.type === 'output_line' && typeof event.sessionId === 'string') {
            const subs = outputSubscriptions.get(event.sessionId);
            if (subs) {
              for (const ws of subs) {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(msg);
                }
              }
            }
          }
        },
        onVoiceInput(handler: VoiceInputHandler) {
          voiceHandler = handler;
        },
        onScopeSwitch(handler: ScopeSwitchHandler) {
          scopeSwitchHandler = handler;
        },
        onModelActivate(handler: ModelActivateHandler) {
          modelActivateHandler = handler;
        },
        registerControlHandlers(handlers: ControlHandlers) {
          controlHandlers = handlers;
        },
        setInstanceMeta(meta: InstanceMeta) {
          instanceMeta = meta;
        },
        close() {
          voiceHandler = null;
          scopeSwitchHandler = null;
          modelActivateHandler = null;
          controlHandlers = null;
          for (const ws of brainClients) ws.close();
          for (const ws of controlClients) ws.close();
          wss.close();
          httpServer.close();
        },
      });
    });
  });
}

/** Check if a message type is a control request */
function isControlRequest(type: string): boolean {
  return [
    'list_sessions', 'start_auto', 'start_security',
    'abort_session', 'subscribe_output', 'unsubscribe_output',
    'send_chat', 'get_findings', 'get_bugs', 'ping',
  ].includes(type);
}
