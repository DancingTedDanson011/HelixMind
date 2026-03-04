import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import type { BrainExport } from './exporter.js';
import { generateBrainHTML } from './template.js';
import {
  CONTROL_REQUEST_TYPES,
} from './control-protocol.js';
import type {
  ControlHandlers,
  ControlRequest,
  InstanceMeta,
  WSMessage,
} from './control-protocol.js';
import { VERSION } from '../version.js';

export type VoiceInputHandler = (text: string) => void;
export type ScopeSwitchHandler = (scope: 'project' | 'global') => void;
export type ModelActivateHandler = (model: string) => void;

export type BrainServerEventType = 'event' | 'control';
export type BrainServerEventHandler = (event: Record<string, unknown>) => void;

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
  /** Subscribe to pushed events (for relay forwarding) */
  on(event: BrainServerEventType, handler: BrainServerEventHandler): void;
  /** Unsubscribe from pushed events */
  off(event: BrainServerEventType, handler: BrainServerEventHandler): void;
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
const OLLAMA_PROXY_TIMEOUT_MS = 5000;
const BRAIN_PORT_START = 9420;
const BRAIN_PORT_END = 9440;
const AUTH_TIMEOUT_MS = 5000;

/** Proxy a request to the Ollama API and return the response */
async function ollamaProxy(
  path: string,
  res: ServerResponse,
  corsOrigin: string,
  method = 'GET',
  body?: string,
): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OLLAMA_PROXY_TIMEOUT_MS);
    const opts: RequestInit = { method, signal: controller.signal };
    if (body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = body;
    }
    const upstream = await fetch(`${OLLAMA_BASE}${path}`, opts);
    clearTimeout(timer);
    res.writeHead(upstream.ok ? 200 : upstream.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': corsOrigin,
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
  corsOrigin: string,
): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': corsOrigin,
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

/** Read body from an incoming request (with size limit to prevent OOM) */
function readBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      data += chunk.toString();
    });
    req.on('end', () => resolve(data));
    req.on('error', (err) => reject(err));
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

  // Mutable port reference — updated after listen() resolves the actual port
  let resolvedPort = BRAIN_PORT_START;

  const httpServer = createServer(async (req, res) => {
    const url = req.url || '/';

    // CORS headers — restrict to localhost origins only (prevents cross-site abuse)
    // EXCEPTION: Allow production web app for discovery endpoints
    const requestOrigin = req.headers.origin || '';
    const isLocalhostOrigin = requestOrigin.startsWith('http://127.0.0.1:') || requestOrigin.startsWith('http://localhost:');
    const isProductionOrigin = requestOrigin === 'https://helix-mind.ai';
    const isDiscoveryEndpoint = url === '/api/instance' || url === '/api/token' || url === '/api/token-hint';
    // For discovery endpoints, allow production web app to discover CLI instances
    const allowedOrigin = (isLocalhostOrigin || (isDiscoveryEndpoint && isProductionOrigin))
      ? requestOrigin
      : `http://127.0.0.1:${resolvedPort}`;
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
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
        version: VERSION,
      };
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify(meta));

    } else if (url === '/api/token') {
      // Full token — CORS allowed for localhost origins only (discovery from web dashboard)

      // Token can be fetched multiple times (needed for both web dashboard and brain HTML)
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ token: connectionToken }));

    } else if (url === '/api/token-hint') {
      const hint = connectionToken.slice(-4);
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ hint }));

    } else if (url?.startsWith('/api/data')) {
      // SECURITY: require connection token to prevent cross-site brain data theft
      const dataUrl = new URL(url, `http://127.0.0.1:${resolvedPort}`);
      const tok = dataUrl.searchParams.get('token');
      if (tok !== connectionToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(latestData));

    // --- Ollama proxy endpoints ---
    } else if (url === '/api/ollama/status') {
      await ollamaProxy('/api/version', res, allowedOrigin);
    } else if (url === '/api/ollama/models') {
      await ollamaProxy('/api/tags', res, allowedOrigin);
    } else if (url === '/api/ollama/running') {
      await ollamaProxy('/api/ps', res, allowedOrigin);
    } else if (url === '/api/ollama/pull' && req.method === 'POST') {
      const body = await readBody(req);
      try {
        const { name } = JSON.parse(body) as { name: string };
        await ollamaPullStream(name, res, allowedOrigin);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    } else if (url === '/api/ollama/delete' && req.method === 'POST') {
      const body = await readBody(req);
      await ollamaProxy('/api/delete', res, allowedOrigin, 'DELETE', body);
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
    let port = BRAIN_PORT_START;
    const maxPort = BRAIN_PORT_END;

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
      const wss = new WebSocketServer({ server: httpServer, maxPayload: 1 * 1024 * 1024 });

      // Brain visualization clients (legacy — no auth required)
      const brainClients = new Set<WebSocket>();

      // Authenticated control clients (CLI ↔ Web protocol)
      const controlClients = new Set<WebSocket>();

      // Output subscriptions: sessionId → set of subscribed clients
      const outputSubscriptions = new Map<string, Set<WebSocket>>();

      let lastOllamaSpawn = 0;
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
      async function handleControlMessage(ws: WebSocket, msg: ControlRequest): Promise<void> {
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
            controlHandlers.sendChat(msg.text, msg.chatId, msg.mode, msg.files);
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

          case 'delete_bug': {
            const success = await controlHandlers.deleteBug(msg.bugId);
            sendTo(ws, { type: 'bug_deleted', success, bugId: msg.bugId, requestId, timestamp: Date.now() });
            break;
          }

          // --- Monitor ---
          case 'start_monitor': {
            const sessionId = controlHandlers.startMonitor(msg.mode);
            sendTo(ws, { type: 'monitor_started', sessionId, mode: msg.mode, requestId, timestamp: Date.now() });
            break;
          }

          case 'stop_monitor': {
            const success = controlHandlers.stopMonitor();
            sendTo(ws, { type: 'monitor_stopped', success, requestId, timestamp: Date.now() });
            break;
          }

          case 'monitor_command': {
            controlHandlers.handleMonitorCommand(msg.command, msg.params);
            sendTo(ws, { type: 'monitor_command_ack', requestId, timestamp: Date.now() });
            break;
          }

          case 'approval_response': {
            controlHandlers.handleApprovalResponse(msg.requestId, msg.approved);
            sendTo(ws, { type: 'approval_response_ack', requestId, timestamp: Date.now() });
            break;
          }

          // --- Jarvis ---
          case 'start_jarvis': {
            const sessionId = controlHandlers.startJarvis();
            if (sessionId) {
              sendTo(ws, { type: 'jarvis_started', sessionId, requestId, timestamp: Date.now() });
            } else {
              sendTo(ws, { type: 'error', error: 'Jarvis instance limit reached. Upgrade your plan or stop an existing instance.', requestId, timestamp: Date.now() });
            }
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
              msg.title,
              msg.description,
              { priority: msg.priority, dependencies: msg.dependencies, tags: msg.tags },
            );
            sendTo(ws, { type: 'jarvis_task_added', task, requestId, timestamp: Date.now() });
            break;
          }

          case 'list_jarvis_tasks': {
            const tasks = controlHandlers.listJarvisTasks();
            sendTo(ws, { type: 'jarvis_tasks_list', tasks, requestId, timestamp: Date.now() });
            break;
          }

          case 'delete_jarvis_task': {
            const success = controlHandlers.deleteJarvisTask(msg.taskId);
            sendTo(ws, { type: 'jarvis_task_deleted', success, taskId: msg.taskId, requestId, timestamp: Date.now() });
            break;
          }

          case 'get_jarvis_status': {
            const status = controlHandlers.getJarvisStatus();
            sendTo(ws, { type: 'jarvis_status', status, requestId, timestamp: Date.now() });
            break;
          }

          case 'clear_jarvis_completed': {
            controlHandlers.clearJarvisCompleted();
            sendTo(ws, { type: 'jarvis_cleared', requestId, timestamp: Date.now() });
            break;
          }

          // --- Jarvis AGI ---
          case 'list_proposals': {
            const proposals = controlHandlers.listProposals();
            sendTo(ws, { type: 'proposals_list', proposals, requestId, timestamp: Date.now() });
            break;
          }

          case 'approve_proposal': {
            const success = controlHandlers.approveProposal(msg.proposalId);
            sendTo(ws, { type: 'proposal_approved', proposalId: msg.proposalId, success, requestId, timestamp: Date.now() });
            break;
          }

          case 'deny_proposal': {
            const success = controlHandlers.denyProposal(msg.proposalId, msg.reason);
            sendTo(ws, { type: 'proposal_denied', proposalId: msg.proposalId, success, requestId, timestamp: Date.now() });
            break;
          }

          case 'set_autonomy_level': {
            const success = controlHandlers.setAutonomyLevel(msg.level);
            sendTo(ws, { type: 'autonomy_level_set', level: msg.level, success, requestId, timestamp: Date.now() });
            break;
          }

          case 'get_identity': {
            const identity = controlHandlers.getIdentity();
            sendTo(ws, { type: 'identity_info', identity, requestId, timestamp: Date.now() });
            break;
          }

          case 'trigger_deep_think': {
            controlHandlers.triggerDeepThink();
            sendTo(ws, { type: 'deep_think_triggered', requestId, timestamp: Date.now() });
            break;
          }

          case 'add_schedule': {
            const schedule = controlHandlers.addSchedule(msg.expression, msg.taskTitle, msg.scheduleType);
            sendTo(ws, { type: 'schedule_added', schedule, requestId, timestamp: Date.now() });
            break;
          }

          case 'remove_schedule': {
            const success = controlHandlers.removeSchedule(msg.scheduleId);
            sendTo(ws, { type: 'schedule_removed', success, requestId, timestamp: Date.now() });
            break;
          }

          case 'list_schedules': {
            const schedules = controlHandlers.listSchedules();
            sendTo(ws, { type: 'schedules_list', schedules, requestId, timestamp: Date.now() });
            break;
          }

          case 'add_trigger': {
            const trigger = controlHandlers.addTrigger(msg.source, msg.pattern, msg.action);
            sendTo(ws, { type: 'trigger_added', trigger, requestId, timestamp: Date.now() });
            break;
          }

          case 'remove_trigger': {
            const success = controlHandlers.removeTrigger(msg.triggerId);
            sendTo(ws, { type: 'trigger_removed', success, requestId, timestamp: Date.now() });
            break;
          }

          case 'list_triggers': {
            const triggers = controlHandlers.listTriggers();
            sendTo(ws, { type: 'triggers_list', triggers, requestId, timestamp: Date.now() });
            break;
          }

          case 'list_projects': {
            const projects = controlHandlers.listProjects();
            sendTo(ws, { type: 'projects_list', projects, requestId, timestamp: Date.now() });
            break;
          }

          case 'register_project': {
            // SECURITY: Validate path to prevent path traversal / null byte injection
            if (typeof msg.path !== 'string' || msg.path.length > 500 || msg.path.includes('\0') || msg.path.includes('..')) {
              sendTo(ws, { type: 'error', message: 'Invalid project path', requestId, timestamp: Date.now() });
              break;
            }
            const project = controlHandlers.registerProject(msg.path, msg.name);
            sendTo(ws, { type: 'project_registered', project, requestId, timestamp: Date.now() });
            break;
          }

          case 'get_workers': {
            const workers = controlHandlers.getWorkers();
            sendTo(ws, { type: 'workers_list', workers, requestId, timestamp: Date.now() });
            break;
          }

          case 'get_config': {
            const cfg = controlHandlers.getConfig();
            sendTo(ws, { type: 'config_response', provider: cfg.provider, apiKey: cfg.apiKey ? cfg.apiKey.slice(0, 4) + '****' : '', model: cfg.model, requestId, timestamp: Date.now() });
            break;
          }

          case 'switch_model': {
            const success = controlHandlers.switchModel(msg.provider, msg.model);
            sendTo(ws, { type: 'model_switched', success, requestId, timestamp: Date.now() });
            break;
          }

          // --- Status Bar & Checkpoints ---
          case 'get_status_bar': {
            const data = controlHandlers.getStatusBar();
            sendTo(ws, { type: 'status_bar_update', data, requestId, timestamp: Date.now() });
            break;
          }

          case 'list_checkpoints': {
            const checkpoints = controlHandlers.listCheckpoints();
            sendTo(ws, { type: 'checkpoints_list', checkpoints, requestId, timestamp: Date.now() });
            break;
          }

          case 'revert_to_checkpoint': {
            const result = controlHandlers.revertToCheckpoint(
              msg.checkpointId,
              msg.mode || 'both',
            );
            sendTo(ws, { type: 'checkpoint_reverted', checkpointId: msg.checkpointId, mode: msg.mode || 'both', ...result, requestId, timestamp: Date.now() });
            break;
          }

          // --- Brain Management ---
          case 'get_brain_list': {
            const { brains, limits } = controlHandlers.getBrainList();
            sendTo(ws, { type: 'brain_list', brains, limits, requestId, timestamp: Date.now() });
            break;
          }

          case 'rename_brain': {
            const success = controlHandlers.renameBrain(msg.brainId, msg.newName);
            if (success) {
              sendTo(ws, { type: 'brain_renamed', brainId: msg.brainId, newName: msg.newName, requestId, timestamp: Date.now() });
              // Broadcast to all control clients
              for (const client of controlClients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  sendTo(client, { type: 'brain_renamed', brainId: msg.brainId, newName: msg.newName, timestamp: Date.now() });
                }
              }
            } else {
              sendTo(ws, { type: 'error', message: 'Brain not found or rename failed', requestId, timestamp: Date.now() });
            }
            break;
          }

          case 'switch_brain': {
            const success = controlHandlers.switchBrain(msg.brainId);
            if (success) {
              sendTo(ws, { type: 'brain_switched', brainId: msg.brainId, requestId, timestamp: Date.now() });
            } else {
              sendTo(ws, { type: 'error', message: 'Brain not found or switch failed', requestId, timestamp: Date.now() });
            }
            break;
          }

          case 'create_brain': {
            // SECURITY: Validate projectPath to prevent path traversal / null byte injection
            if (msg.projectPath && (typeof msg.projectPath !== 'string' || msg.projectPath.length > 500 || msg.projectPath.includes('\0') || msg.projectPath.includes('..'))) {
              sendTo(ws, { type: 'error', message: 'Invalid project path', requestId, timestamp: Date.now() });
              break;
            }
            if (typeof msg.name !== 'string' || msg.name.length > 200) {
              sendTo(ws, { type: 'error', message: 'Invalid brain name', requestId, timestamp: Date.now() });
              break;
            }
            const brain = controlHandlers.createBrain(msg.name, msg.brainType, msg.projectPath);
            if (brain) {
              sendTo(ws, { type: 'brain_created', brain, requestId, timestamp: Date.now() });
              // Broadcast to all control clients
              for (const client of controlClients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  sendTo(client, { type: 'brain_created', brain, timestamp: Date.now() });
                }
              }
            } else {
              // Limit reached — send limit event
              sendTo(ws, { type: 'brain_limit_reached', limitType: msg.brainType, current: 0, max: 0, requestId, timestamp: Date.now() });
            }
            break;
          }

          // --- Remote Tool Execution (Jarvis Server → CLI) ---
          case 'remote_tool_result': {
            // Forward to relay for server-side Jarvis
            // This is handled by the relay client, not the local server
            break;
          }

          // --- Tool Permission Approval ---
          case 'tool_permission_response': {
            // SECURITY: mode intentionally not forwarded — remote clients cannot escalate permissions
            controlHandlers.handleToolPermissionResponse(
              msg.requestId,
              msg.approved,
            );
            // ACK back to the sender
            sendTo(ws, { type: 'tool_permission_response_ack', requestId: msg.requestId, timestamp: Date.now() });
            break;
          }

          // --- Brain Sync (stub — no real sync backend yet) ---
          case 'brain_sync_push': {
            sendTo(ws, { type: 'brain_sync_status', brainId: msg.brainId, synced: true, version: msg.version, lastSyncedAt: Date.now(), requestId, timestamp: Date.now() });
            break;
          }

          case 'brain_sync_pull': {
            sendTo(ws, { type: 'brain_sync_data', brainId: msg.brainId, version: 0, nodesJson: '[]', requestId, timestamp: Date.now() });
            break;
          }

          // --- License (stub) ---
          case 'license_validate': {
            sendTo(ws, { type: 'license_status', valid: false, plan: 'FREE', features: [], expiresAt: '', requestId, timestamp: Date.now() });
            break;
          }

          // --- Swarm ---
          case 'start_swarm': {
            const swarmId = controlHandlers.startSwarm(msg.message);
            sendTo(ws, { type: 'swarm_started', swarmId, requestId, timestamp: Date.now() });
            break;
          }

          case 'abort_swarm': {
            const success = controlHandlers.abortSwarm(msg.swarmId);
            sendTo(ws, { type: 'swarm_aborted', swarmId: msg.swarmId, success, requestId, timestamp: Date.now() });
            break;
          }

          case 'get_swarm_status': {
            const swarm = controlHandlers.getSwarmStatus();
            sendTo(ws, { type: 'swarm_status', swarm, requestId, timestamp: Date.now() });
            break;
          }
        }
      }

      // Rate limiting: max messages per second per client
      const WS_MAX_MSG_PER_SEC = 60;
      const wsMessageCounters = new Map<WebSocket, { count: number; resetAt: number }>();
      function wsCheckRateLimit(ws: WebSocket): boolean {
        const now = Date.now();
        let ctr = wsMessageCounters.get(ws);
        if (!ctr || now > ctr.resetAt) {
          ctr = { count: 0, resetAt: now + 1000 };
          wsMessageCounters.set(ws, ctr);
        }
        ctr.count++;
        return ctr.count <= WS_MAX_MSG_PER_SEC;
      }

      // Connection limit to prevent resource exhaustion
      const MAX_CONNECTIONS = 50;

      wss.on('connection', (ws) => {
        // Reject if too many connections
        if (brainClients.size + controlClients.size >= MAX_CONNECTIONS) {
          ws.close(4002, 'Too many connections');
          return;
        }

        let authenticated = false;
        let authTimeout: ReturnType<typeof setTimeout> | null = null;

        // Give client time to authenticate; close if no auth message arrives
        authTimeout = setTimeout(() => {
          if (!authenticated) {
            ws.send(JSON.stringify({ type: 'auth_fail', reason: 'Auth timeout', timestamp: Date.now() }));
            ws.close(4001, 'Auth timeout');
          }
        }, AUTH_TIMEOUT_MS);

        ws.on('close', () => {
          brainClients.delete(ws);
          controlClients.delete(ws);
          wsMessageCounters.delete(ws);
          // Clean up output subscriptions + prune empty sets to prevent memory leak
          for (const [sessionId, subs] of outputSubscriptions) {
            subs.delete(ws);
            if (subs.size === 0) outputSubscriptions.delete(sessionId);
          }
        });

        ws.on('message', (raw) => {
          if (!wsCheckRateLimit(ws)) return;

          try {
            const msg = JSON.parse(String(raw));

            // Auth handshake — guard against late auth after timeout already fired
            if (msg.type === 'auth') {
              if (authTimeout) { clearTimeout(authTimeout); authTimeout = null; }
              if (authenticated) return; // Already authenticated (timeout or previous auth)

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
              handleControlMessage(ws, msg as ControlRequest).catch((err) => {
                if (process.env.DEBUG) {
                  console.error('[brain] Control message handler error:', err instanceof Error ? err.message : String(err));
                }
                sendTo(ws, { type: 'error', message: 'Internal error processing request', requestId: (msg as any).requestId, timestamp: Date.now() });
              });
              return;
            }

            // All action messages require authentication to prevent CORS-based attacks
            if (!authenticated) {
              sendTo(ws, { type: 'error', message: 'Authentication required', timestamp: Date.now() });
              return;
            }

            // Legacy brain messages (voice, scope, model) — NOW REQUIRE AUTH
            if (msg.type === 'voice_input' && typeof msg.text === 'string' && voiceHandler) {
              voiceHandler(msg.text);
            }
            if (msg.type === 'scope_switch' && (msg.scope === 'project' || msg.scope === 'global') && scopeSwitchHandler) {
              scopeSwitchHandler(msg.scope);
            }
            if (msg.type === 'activate_model' && typeof msg.model === 'string' && modelActivateHandler) {
              modelActivateHandler(msg.model);
            }
            if (msg.type === 'start_ollama') {
              // SECURITY: Debounce ollama spawns — max once per 30s to prevent process exhaustion
              const now = Date.now();
              if (now - lastOllamaSpawn < 30_000) {
                sendTo(ws, { type: 'ollama_starting', timestamp: Date.now(), throttled: true });
              } else {
                lastOllamaSpawn = now;
                try {
                  const child = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
                  child.unref();
                  sendTo(ws, { type: 'ollama_starting', timestamp: Date.now() });
                } catch { /* ignore spawn errors */ }
              }
            }
          } catch { /* ignore malformed */ }
        });
      });

      const addr = httpServer.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolvedPort = actualPort;

      // Event listener registry for relay forwarding
      const eventListeners = new Set<BrainServerEventHandler>();
      const controlListeners = new Set<BrainServerEventHandler>();

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
          // Notify subscribers (e.g. relay client)
          for (const handler of eventListeners) {
            try { handler(event); } catch { /* non-fatal */ }
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
          // Notify subscribers (e.g. relay client)
          for (const handler of controlListeners) {
            try { handler(event); } catch { /* non-fatal */ }
          }
        },
        on(type: BrainServerEventType, handler: BrainServerEventHandler) {
          if (type === 'event') eventListeners.add(handler);
          else if (type === 'control') controlListeners.add(handler);
        },
        off(type: BrainServerEventType, handler: BrainServerEventHandler) {
          if (type === 'event') eventListeners.delete(handler);
          else if (type === 'control') controlListeners.delete(handler);
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
          eventListeners.clear();
          controlListeners.clear();
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
  return CONTROL_REQUEST_TYPES.has(type);
}
