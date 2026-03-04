/**
 * Relay Client — outbound WebSocket connection from CLI to the Web Server relay.
 * Forwards brain events and handles control messages from remote browsers.
 */
import WebSocket from 'ws';
import { CONTROL_REQUEST_TYPES } from './control-protocol.js';
import type { ControlHandlers, ControlRequest, InstanceMeta } from './control-protocol.js';
import type { BrainServer } from './server.js';

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const PING_INTERVAL_MS = 30_000;

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
  // Refuse non-TLS remote connections to protect API key
  if (relayUrl.startsWith('ws://') && !relayUrl.includes('127.0.0.1') && !relayUrl.includes('localhost')) {
    return { close() {} };
  }

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let backoff = INITIAL_BACKOFF_MS;
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
      // WebSocket constructor failed (invalid URL or network issue)
      scheduleReconnect();
      return;
    }

    ws.on('open', () => {
      backoff = INITIAL_BACKOFF_MS;
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
          }, PING_INTERVAL_MS);

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
      } catch { /* Ignore malformed JSON from relay — non-fatal */ }
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

  async function handleControlMessage(msg: ControlRequest): Promise<void> {
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

      case 'subscribe_output':
      case 'unsubscribe_output':
        // Output subscriptions are handled locally by the brain server, not relayed
        break;

      case 'send_chat': {
        handlers.sendChat(msg.text, msg.chatId, msg.mode, msg.files);
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

      case 'delete_bug': {
        const success = await handlers.deleteBug(msg.bugId);
        sendRelay({ type: 'bug_deleted', success, bugId: msg.bugId, requestId, timestamp: Date.now() });
        break;
      }

      // --- Monitor ---
      case 'start_monitor': {
        const sessionId = handlers.startMonitor(msg.mode);
        sendRelay({ type: 'monitor_started', sessionId, mode: msg.mode, requestId, timestamp: Date.now() });
        break;
      }

      case 'stop_monitor': {
        const success = handlers.stopMonitor();
        sendRelay({ type: 'monitor_stopped', success, requestId, timestamp: Date.now() });
        break;
      }

      case 'monitor_command': {
        handlers.handleMonitorCommand(msg.command, msg.params);
        sendRelay({ type: 'monitor_command_ack', requestId, timestamp: Date.now() });
        break;
      }

      case 'approval_response': {
        handlers.handleApprovalResponse(msg.requestId, msg.approved);
        sendRelay({ type: 'approval_response_ack', requestId, timestamp: Date.now() });
        break;
      }

      // --- Jarvis ---
      case 'start_jarvis': {
        const sessionId = handlers.startJarvis();
        if (sessionId) {
          sendRelay({ type: 'jarvis_started', sessionId, requestId, timestamp: Date.now() });
        } else {
          sendRelay({ type: 'error', error: 'Jarvis instance limit reached. Upgrade your plan or stop an existing instance.', requestId, timestamp: Date.now() });
        }
        break;
      }

      case 'stop_jarvis': {
        const success = handlers.stopJarvis();
        sendRelay({ type: 'jarvis_stopped', success, requestId, timestamp: Date.now() });
        break;
      }

      case 'pause_jarvis': {
        const success = handlers.pauseJarvis();
        sendRelay({ type: 'jarvis_paused', success, requestId, timestamp: Date.now() });
        break;
      }

      case 'resume_jarvis': {
        const success = handlers.resumeJarvis();
        sendRelay({ type: 'jarvis_resumed', success, requestId, timestamp: Date.now() });
        break;
      }

      case 'add_jarvis_task': {
        const task = handlers.addJarvisTask(
          msg.title,
          msg.description,
          { priority: msg.priority, dependencies: msg.dependencies, tags: msg.tags },
        );
        sendRelay({ type: 'jarvis_task_added', task, requestId, timestamp: Date.now() });
        break;
      }

      case 'list_jarvis_tasks': {
        const tasks = handlers.listJarvisTasks();
        sendRelay({ type: 'jarvis_tasks_list', tasks, requestId, timestamp: Date.now() });
        break;
      }

      case 'delete_jarvis_task': {
        const success = handlers.deleteJarvisTask(msg.taskId);
        sendRelay({ type: 'jarvis_task_deleted', success, taskId: msg.taskId, requestId, timestamp: Date.now() });
        break;
      }

      case 'get_jarvis_status': {
        const status = handlers.getJarvisStatus();
        sendRelay({ type: 'jarvis_status', status, requestId, timestamp: Date.now() });
        break;
      }

      case 'clear_jarvis_completed': {
        handlers.clearJarvisCompleted();
        sendRelay({ type: 'jarvis_cleared', requestId, timestamp: Date.now() });
        break;
      }

      // --- Jarvis AGI ---
      case 'list_proposals': {
        const proposals = handlers.listProposals();
        sendRelay({ type: 'proposals_list', proposals, requestId, timestamp: Date.now() });
        break;
      }

      case 'approve_proposal': {
        const success = handlers.approveProposal(msg.proposalId);
        sendRelay({ type: 'proposal_approved', proposalId: msg.proposalId, success, requestId, timestamp: Date.now() });
        break;
      }

      case 'deny_proposal': {
        const success = handlers.denyProposal(msg.proposalId, msg.reason);
        sendRelay({ type: 'proposal_denied', proposalId: msg.proposalId, success, requestId, timestamp: Date.now() });
        break;
      }

      case 'set_autonomy_level': {
        const success = handlers.setAutonomyLevel(msg.level);
        sendRelay({ type: 'autonomy_level_set', level: msg.level, success, requestId, timestamp: Date.now() });
        break;
      }

      case 'get_identity': {
        const identity = handlers.getIdentity();
        sendRelay({ type: 'identity_info', identity, requestId, timestamp: Date.now() });
        break;
      }

      case 'trigger_deep_think': {
        handlers.triggerDeepThink();
        sendRelay({ type: 'deep_think_triggered', requestId, timestamp: Date.now() });
        break;
      }

      case 'add_schedule': {
        const schedule = handlers.addSchedule(msg.expression, msg.taskTitle, msg.scheduleType);
        sendRelay({ type: 'schedule_added', schedule, requestId, timestamp: Date.now() });
        break;
      }

      case 'remove_schedule': {
        const success = handlers.removeSchedule(msg.scheduleId);
        sendRelay({ type: 'schedule_removed', success, requestId, timestamp: Date.now() });
        break;
      }

      case 'list_schedules': {
        const schedules = handlers.listSchedules();
        sendRelay({ type: 'schedules_list', schedules, requestId, timestamp: Date.now() });
        break;
      }

      case 'add_trigger': {
        const trigger = handlers.addTrigger(msg.source, msg.pattern, msg.action);
        sendRelay({ type: 'trigger_added', trigger, requestId, timestamp: Date.now() });
        break;
      }

      case 'remove_trigger': {
        const success = handlers.removeTrigger(msg.triggerId);
        sendRelay({ type: 'trigger_removed', success, requestId, timestamp: Date.now() });
        break;
      }

      case 'list_triggers': {
        const triggers = handlers.listTriggers();
        sendRelay({ type: 'triggers_list', triggers, requestId, timestamp: Date.now() });
        break;
      }

      case 'list_projects': {
        const projects = handlers.listProjects();
        sendRelay({ type: 'projects_list', projects, requestId, timestamp: Date.now() });
        break;
      }

      case 'register_project': {
        // SECURITY: Validate path from remote to prevent path traversal / null byte injection
        if (typeof msg.path !== 'string' || msg.path.length > 500 || msg.path.includes('\0') || msg.path.includes('..')) {
          sendRelay({ type: 'error', message: 'Invalid project path', requestId, timestamp: Date.now() });
          break;
        }
        const project = handlers.registerProject(msg.path, msg.name);
        sendRelay({ type: 'project_registered', project, requestId, timestamp: Date.now() });
        break;
      }

      case 'get_workers': {
        const workers = handlers.getWorkers();
        sendRelay({ type: 'workers_list', workers, requestId, timestamp: Date.now() });
        break;
      }

      // --- Brain Management ---
      case 'get_brain_list': {
        const { brains, limits } = handlers.getBrainList();
        sendRelay({ type: 'brain_list', brains, limits, requestId, timestamp: Date.now() });
        break;
      }

      case 'rename_brain': {
        const success = handlers.renameBrain(msg.brainId, msg.newName);
        if (success) {
          sendRelay({ type: 'brain_renamed', brainId: msg.brainId, newName: msg.newName, requestId, timestamp: Date.now() });
        } else {
          sendRelay({ type: 'error', message: 'Brain not found or rename failed', requestId, timestamp: Date.now() });
        }
        break;
      }

      case 'switch_brain': {
        const success = handlers.switchBrain(msg.brainId);
        if (success) {
          sendRelay({ type: 'brain_switched', brainId: msg.brainId, requestId, timestamp: Date.now() });
        } else {
          sendRelay({ type: 'error', message: 'Brain not found or switch failed', requestId, timestamp: Date.now() });
        }
        break;
      }

      case 'create_brain': {
        // SECURITY: Validate projectPath from remote to prevent path traversal / null byte injection
        if (msg.projectPath && (typeof msg.projectPath !== 'string' || msg.projectPath.length > 500 || msg.projectPath.includes('\0') || msg.projectPath.includes('..'))) {
          sendRelay({ type: 'error', message: 'Invalid project path', requestId, timestamp: Date.now() });
          break;
        }
        if (typeof msg.name !== 'string' || msg.name.length > 200) {
          sendRelay({ type: 'error', message: 'Invalid brain name', requestId, timestamp: Date.now() });
          break;
        }
        const brain = handlers.createBrain(msg.name, msg.brainType, msg.projectPath);
        if (brain) {
          sendRelay({ type: 'brain_created', brain, requestId, timestamp: Date.now() });
        } else {
          sendRelay({ type: 'brain_limit_reached', limitType: msg.brainType, current: 0, max: 0, requestId, timestamp: Date.now() });
        }
        break;
      }

      // --- Config & Model ---
      case 'get_config': {
        const cfg = handlers.getConfig();
        sendRelay({ type: 'config_response', provider: cfg.provider, apiKey: cfg.apiKey ? cfg.apiKey.slice(0, 4) + '****' : '', model: cfg.model, requestId, timestamp: Date.now() });
        break;
      }

      case 'switch_model': {
        const success = handlers.switchModel(msg.provider, msg.model);
        sendRelay({ type: 'model_switched', success, requestId, timestamp: Date.now() });
        break;
      }

      // --- Status Bar & Checkpoints ---
      case 'get_status_bar': {
        const data = handlers.getStatusBar();
        sendRelay({ type: 'status_bar_update', data, requestId, timestamp: Date.now() });
        break;
      }

      case 'list_checkpoints': {
        const checkpoints = handlers.listCheckpoints();
        sendRelay({ type: 'checkpoints_list', checkpoints, requestId, timestamp: Date.now() });
        break;
      }

      case 'revert_to_checkpoint': {
        const result = handlers.revertToCheckpoint(
          msg.checkpointId,
          msg.mode || 'both',
        );
        sendRelay({ type: 'checkpoint_reverted', checkpointId: msg.checkpointId, mode: msg.mode || 'both', ...result, requestId, timestamp: Date.now() });
        break;
      }

      // --- Remote Tool Execution ---
      case 'remote_tool_result': {
        // Handled by relay forwarding, not local handlers
        break;
      }

      // --- Tool Permission Approval ---
      case 'tool_permission_response': {
        // SECURITY: mode intentionally not forwarded — remote clients cannot escalate permissions
        handlers.handleToolPermissionResponse(
          msg.requestId,
          msg.approved,
        );
        sendRelay({ type: 'tool_permission_response_ack', requestId: msg.requestId, timestamp: Date.now() });
        break;
      }

      // --- Brain Sync (stub) ---
      case 'brain_sync_push': {
        sendRelay({ type: 'brain_sync_status', brainId: msg.brainId, synced: true, version: msg.version, lastSyncedAt: Date.now(), requestId, timestamp: Date.now() });
        break;
      }

      case 'brain_sync_pull': {
        sendRelay({ type: 'brain_sync_data', brainId: msg.brainId, version: 0, nodesJson: '[]', requestId, timestamp: Date.now() });
        break;
      }

      // --- License (stub) ---
      case 'license_validate': {
        sendRelay({ type: 'license_status', valid: false, plan: 'FREE', features: [], expiresAt: '', requestId, timestamp: Date.now() });
        break;
      }

      // --- Swarm ---
      case 'start_swarm': {
        const swarmId = handlers.startSwarm(msg.message);
        sendRelay({ type: 'swarm_started', swarmId, requestId, timestamp: Date.now() });
        break;
      }

      case 'abort_swarm': {
        const success = handlers.abortSwarm(msg.swarmId);
        sendRelay({ type: 'swarm_aborted', swarmId: msg.swarmId, success, requestId, timestamp: Date.now() });
        break;
      }

      case 'get_swarm_status': {
        const swarm = handlers.getSwarmStatus();
        sendRelay({ type: 'swarm_status', swarm, requestId, timestamp: Date.now() });
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
    // Add random jitter (0–25%) to prevent thundering herd on server restart
    const jitter = Math.random() * backoff * 0.25;
    reconnectTimer = setTimeout(() => {
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      connect();
    }, backoff + jitter);
  }

  // Start connection
  connect();

  // Subscribe to brain server events for relay forwarding (no monkey-patching)
  if (brainServer) {
    brainServer.on('event', forwardEvent);
    brainServer.on('control', forwardEvent);
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
  return CONTROL_REQUEST_TYPES.has(type);
}
