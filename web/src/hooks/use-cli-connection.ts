'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  ConnectionMode,
  ConnectionState,
  Finding,
  BugInfo,
  BrowserScreenshotInfo,
  InstanceMeta,
  SessionInfo,
  ThreatEvent,
  DefenseRecord,
  ApprovalRequest,
  MonitorStatus,
  JarvisTaskInfo,
  JarvisStatusInfo,
} from '@/lib/cli-types';
import { registerConnectionWs, unregisterConnectionWs } from '@/lib/cli-ws-registry';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PING_INTERVAL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;
const RECONNECT_MAX_MS = 15_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseCliConnectionParams {
  mode: ConnectionMode;
  port?: number;
  token?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface WSIncoming {
  type: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface UseCliConnectionReturn {
  connectionId: string;
  connectionState: ConnectionState;
  /** Increments each time a new WebSocket is created (for re-attaching listeners) */
  wsVersion: number;
  sessions: SessionInfo[];
  findings: Finding[];
  bugs: BugInfo[];
  lastScreenshot: BrowserScreenshotInfo | null;
  instanceMeta: InstanceMeta | null;
  error: string | null;

  // Monitor state
  threats: ThreatEvent[];
  defenses: DefenseRecord[];
  approvals: ApprovalRequest[];
  monitorStatus: MonitorStatus | null;

  // Jarvis state
  jarvisTasks: JarvisTaskInfo[];
  jarvisStatus: JarvisStatusInfo | null;

  connect: () => void;
  disconnect: () => void;
  sendRequest: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
  listSessions: () => Promise<SessionInfo[]>;
  startAuto: (goal?: string) => Promise<string>;
  startSecurity: () => Promise<string>;
  startMonitor: (mode: string) => Promise<string>;
  stopMonitor: () => Promise<void>;
  respondApproval: (requestId: string, approved: boolean) => Promise<void>;
  sendMonitorCommand: (command: string, params?: Record<string, string>) => Promise<void>;
  abortSession: (sessionId: string) => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  getFindings: () => Promise<Finding[]>;
  getBugs: () => Promise<BugInfo[]>;
  // Jarvis methods
  startJarvis: () => Promise<string>;
  stopJarvis: () => Promise<void>;
  pauseJarvis: () => Promise<void>;
  resumeJarvis: () => Promise<void>;
  addJarvisTask: (title: string, description: string, priority?: string) => Promise<JarvisTaskInfo>;
  listJarvisTasks: () => Promise<JarvisTaskInfo[]>;
  getJarvisStatus: () => Promise<JarvisStatusInfo>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Central hook for connecting to a HelixMind CLI instance via WebSocket.
 * Supports both local (ws://127.0.0.1:{port}) and relay (wss://{host}/api/relay/web) modes.
 */
export function useCliConnection(params: UseCliConnectionParams): UseCliConnectionReturn {
  const { mode, port, token } = params;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [bugs, setBugs] = useState<BugInfo[]>([]);
  const [lastScreenshot, setLastScreenshot] = useState<BrowserScreenshotInfo | null>(null);
  const [instanceMeta, setInstanceMeta] = useState<InstanceMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Monitor state
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [defenses, setDefenses] = useState<DefenseRecord[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [monitorStatus, setMonitorStatus] = useState<MonitorStatus | null>(null);
  const [jarvisTasks, setJarvisTasks] = useState<JarvisTaskInfo[]>([]);
  const [jarvisStatus, setJarvisStatus] = useState<JarvisStatusInfo | null>(null);
  const [wsVersion, setWsVersion] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const connectionStateRef = useRef<ConnectionState>('disconnected');
  const mountedRef = useRef(true);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const connectionIdRef = useRef(crypto.randomUUID());

  // Keep latest params in a ref so callbacks always see current values
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Wrapper to update both state and ref in sync
  const updateConnectionState = useCallback((state: ConnectionState) => {
    connectionStateRef.current = state;
    setConnectionState(state);
  }, []);

  // ---------------------------------------------------------------------------
  // Internal: cleanup resources
  // ---------------------------------------------------------------------------
  const cleanup = useCallback(() => {
    if (pingRef.current !== null) {
      clearInterval(pingRef.current);
      pingRef.current = null;
    }
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Reject all pending requests
    for (const [, pending] of pendingRef.current) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection closed'));
    }
    pendingRef.current.clear();

    unregisterConnectionWs(connectionIdRef.current);

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Internal: schedule reconnect with exponential backoff
  // ---------------------------------------------------------------------------
  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current || intentionalCloseRef.current) return;

    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttemptRef.current),
      RECONNECT_MAX_MS,
    );
    reconnectAttemptRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current && !intentionalCloseRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        connectInternal();
      }
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Internal: send raw JSON on the socket
  // ---------------------------------------------------------------------------
  const sendRaw = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Internal: handle incoming messages
  // ---------------------------------------------------------------------------
  const handleMessage = useCallback((msg: WSIncoming) => {
    // Response to a pending request
    if (msg.requestId && pendingRef.current.has(msg.requestId)) {
      const pending = pendingRef.current.get(msg.requestId)!;
      clearTimeout(pending.timer);
      pendingRef.current.delete(msg.requestId);
      pending.resolve(msg);
      return;
    }

    // Auth responses
    if (msg.type === 'auth_ok') {
      if (mountedRef.current) {
        updateConnectionState('connected');
        setError(null);
        reconnectAttemptRef.current = 0;
      }
      return;
    }

    if (msg.type === 'auth_fail') {
      if (mountedRef.current) {
        updateConnectionState('error');
        setError(String(msg.reason ?? 'Authentication failed'));
      }
      return;
    }

    if (msg.type === 'pong') {
      return;
    }

    // Server-push events
    if (msg.type === 'session_updated') {
      const session = msg.session as SessionInfo;
      if (mountedRef.current) {
        setSessions((prev) => prev.map((s) => (s.id === session.id ? session : s)));
      }
      return;
    }

    if (msg.type === 'session_created') {
      const session = msg.session as SessionInfo;
      if (mountedRef.current) {
        setSessions((prev) => [...prev, session]);
      }
      return;
    }

    if (msg.type === 'session_removed') {
      const sessionId = msg.sessionId as string;
      if (mountedRef.current) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
      return;
    }

    if (msg.type === 'instance_meta') {
      const instance = msg.instance as InstanceMeta;
      if (mountedRef.current) {
        setInstanceMeta(instance);
      }
      return;
    }

    if (msg.type === 'findings_push') {
      const pushed = msg.findings as Finding[];
      if (mountedRef.current && Array.isArray(pushed)) {
        setFindings((prev) => [...prev, ...pushed]);
      }
      return;
    }

    if (msg.type === 'bug_created') {
      const bug = msg.bug as BugInfo;
      if (mountedRef.current) {
        setBugs((prev) => [...prev, bug]);
      }
      return;
    }

    if (msg.type === 'bug_updated') {
      const bug = msg.bug as BugInfo;
      if (mountedRef.current) {
        setBugs((prev) => prev.map((b) => (b.id === bug.id ? bug : b)));
      }
      return;
    }

    if (msg.type === 'browser_screenshot') {
      const screenshot = msg.screenshot as BrowserScreenshotInfo;
      if (mountedRef.current) {
        setLastScreenshot(screenshot);
      }
      return;
    }

    // Monitor events
    if (msg.type === 'threat_detected') {
      const threat = msg.threat as ThreatEvent;
      if (mountedRef.current) {
        setThreats((prev) => [...prev, threat]);
      }
      return;
    }

    if (msg.type === 'defense_activated') {
      const defense = msg.defense as DefenseRecord;
      if (mountedRef.current) {
        setDefenses((prev) => [...prev, defense]);
      }
      return;
    }

    if (msg.type === 'approval_request') {
      const request = msg.request as ApprovalRequest;
      if (mountedRef.current) {
        setApprovals((prev) => [...prev, request]);
      }
      return;
    }

    if (msg.type === 'monitor_status') {
      if (mountedRef.current) {
        setMonitorStatus(msg as unknown as MonitorStatus);
      }
      return;
    }

    // Jarvis events
    if (msg.type === 'jarvis_task_created') {
      const task = msg.task as JarvisTaskInfo;
      if (mountedRef.current) {
        setJarvisTasks((prev) => [...prev, task]);
      }
      return;
    }

    if (msg.type === 'jarvis_task_updated') {
      const task = msg.task as JarvisTaskInfo;
      if (mountedRef.current) {
        setJarvisTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      }
      return;
    }

    if (msg.type === 'jarvis_status_changed') {
      const status = msg.status as JarvisStatusInfo;
      if (mountedRef.current) {
        setJarvisStatus(status);
      }
      return;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Internal: connect
  // ---------------------------------------------------------------------------
  const connectInternal = useCallback(() => {
    cleanup();

    const { mode: m, port: p, token: t } = paramsRef.current;

    let url: string;
    if (m === 'local') {
      if (!p) {
        setError('Port is required for local connections');
        updateConnectionState('error');
        return;
      }
      url = `ws://127.0.0.1:${p}`;
    } else {
      url = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/relay/web`;
    }

    updateConnectionState('connecting');
    setError(null);
    intentionalCloseRef.current = false;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    registerConnectionWs(connectionIdRef.current, ws);
    setWsVersion(v => v + 1);

    ws.onopen = () => {
      if (!mountedRef.current) return;

      updateConnectionState('authenticating');

      // Send authentication
      if (m === 'local' && t) {
        sendRaw({ type: 'auth', token: t, timestamp: Date.now() });
      } else if (m === 'relay') {
        // Relay mode uses cookie-based auth; send empty auth to trigger server-side validation
        sendRaw({ type: 'auth', timestamp: Date.now() });
      }

      // Start ping interval
      pingRef.current = setInterval(() => {
        sendRaw({ type: 'ping', timestamp: Date.now() });
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const data: WSIncoming = JSON.parse(String(event.data));
        handleMessage(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setError('WebSocket error');
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;

      const wasConnected = connectionStateRef.current === 'connected';
      updateConnectionState('disconnected');

      if (!intentionalCloseRef.current) {
        if (wasConnected) {
          setError('Connection lost, reconnecting...');
        }
        scheduleReconnect();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup, handleMessage, scheduleReconnect, sendRaw]);

  // ---------------------------------------------------------------------------
  // Public: connect / disconnect
  // ---------------------------------------------------------------------------
  const connect = useCallback(() => {
    intentionalCloseRef.current = false;
    reconnectAttemptRef.current = 0;
    connectInternal();
  }, [connectInternal]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    updateConnectionState('disconnected');
    setError(null);
    cleanup();
  }, [cleanup]);

  // ---------------------------------------------------------------------------
  // Public: sendRequest (request/response with timeout)
  // ---------------------------------------------------------------------------
  const sendRequest = useCallback(
    (type: string, payload?: Record<string, unknown>): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          reject(new Error('Not connected'));
          return;
        }

        const requestId = crypto.randomUUID();
        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          reject(new Error(`Request "${type}" timed out`));
        }, REQUEST_TIMEOUT_MS);

        pendingRef.current.set(requestId, { resolve, reject, timer });

        sendRaw({
          type,
          requestId,
          timestamp: Date.now(),
          ...(payload ?? {}),
        });
      });
    },
    [sendRaw],
  );

  // ---------------------------------------------------------------------------
  // Public: convenience methods
  // ---------------------------------------------------------------------------
  const listSessions = useCallback(async (): Promise<SessionInfo[]> => {
    const res = (await sendRequest('list_sessions')) as { sessions: SessionInfo[] };
    const list = res.sessions ?? [];
    setSessions(list);
    return list;
  }, [sendRequest]);

  const startAuto = useCallback(
    async (goal?: string): Promise<string> => {
      const payload: Record<string, unknown> = {};
      if (goal !== undefined) payload.goal = goal;
      const res = (await sendRequest('start_auto', payload)) as { sessionId: string };
      return res.sessionId;
    },
    [sendRequest],
  );

  const startSecurity = useCallback(async (): Promise<string> => {
    const res = (await sendRequest('start_security')) as { sessionId: string };
    return res.sessionId;
  }, [sendRequest]);

  const abortSession = useCallback(
    async (sessionId: string): Promise<void> => {
      await sendRequest('abort_session', { sessionId });
    },
    [sendRequest],
  );

  const sendChat = useCallback(
    async (text: string): Promise<void> => {
      await sendRequest('send_chat', { text });
    },
    [sendRequest],
  );

  const getFindings = useCallback(async (): Promise<Finding[]> => {
    const res = (await sendRequest('get_findings')) as { findings: Finding[] };
    const list = res.findings ?? [];
    setFindings(list);
    return list;
  }, [sendRequest]);

  const getBugs = useCallback(async (): Promise<BugInfo[]> => {
    const res = (await sendRequest('get_bugs')) as { bugs: BugInfo[] };
    const list = res.bugs ?? [];
    setBugs(list);
    return list;
  }, [sendRequest]);

  const startMonitor = useCallback(
    async (mode: string): Promise<string> => {
      const res = (await sendRequest('start_monitor', { mode })) as { sessionId: string };
      return res.sessionId;
    },
    [sendRequest],
  );

  const stopMonitor = useCallback(async (): Promise<void> => {
    await sendRequest('stop_monitor');
  }, [sendRequest]);

  const respondApproval = useCallback(
    async (requestId: string, approved: boolean): Promise<void> => {
      await sendRequest('approval_response', { requestId, approved });
      if (mountedRef.current) {
        setApprovals((prev) => prev.filter((a) => a.id !== requestId));
      }
    },
    [sendRequest],
  );

  const sendMonitorCommand = useCallback(
    async (command: string, params?: Record<string, string>): Promise<void> => {
      await sendRequest('monitor_command', { command, params });
    },
    [sendRequest],
  );

  // ---------------------------------------------------------------------------
  // Jarvis convenience methods
  // ---------------------------------------------------------------------------
  const startJarvis = useCallback(async (): Promise<string> => {
    const res = (await sendRequest('start_jarvis')) as { sessionId: string };
    return res.sessionId;
  }, [sendRequest]);

  const stopJarvis = useCallback(async (): Promise<void> => {
    await sendRequest('stop_jarvis');
  }, [sendRequest]);

  const pauseJarvis = useCallback(async (): Promise<void> => {
    await sendRequest('pause_jarvis');
  }, [sendRequest]);

  const resumeJarvis = useCallback(async (): Promise<void> => {
    await sendRequest('resume_jarvis');
  }, [sendRequest]);

  const addJarvisTask = useCallback(
    async (title: string, description: string, priority?: string): Promise<JarvisTaskInfo> => {
      const payload: Record<string, unknown> = { title, description };
      if (priority) payload.priority = priority;
      const res = (await sendRequest('add_jarvis_task', payload)) as { task: JarvisTaskInfo };
      return res.task;
    },
    [sendRequest],
  );

  const listJarvisTasks = useCallback(async (): Promise<JarvisTaskInfo[]> => {
    const res = (await sendRequest('list_jarvis_tasks')) as { tasks: JarvisTaskInfo[] };
    const list = res.tasks ?? [];
    setJarvisTasks(list);
    return list;
  }, [sendRequest]);

  const getJarvisStatus = useCallback(async (): Promise<JarvisStatusInfo> => {
    const res = (await sendRequest('get_jarvis_status')) as { status: JarvisStatusInfo };
    setJarvisStatus(res.status);
    return res.status;
  }, [sendRequest]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      intentionalCloseRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  return {
    connectionId: connectionIdRef.current,
    connectionState,
    wsVersion,
    sessions,
    findings,
    bugs,
    lastScreenshot,
    instanceMeta,
    error,

    // Monitor state
    threats,
    defenses,
    approvals,
    monitorStatus,

    // Jarvis state
    jarvisTasks,
    jarvisStatus,

    connect,
    disconnect,
    sendRequest,
    listSessions,
    startAuto,
    startSecurity,
    startMonitor,
    stopMonitor,
    respondApproval,
    sendMonitorCommand,
    abortSession,
    sendChat,
    getFindings,
    getBugs,
    // Jarvis
    startJarvis,
    stopJarvis,
    pauseJarvis,
    resumeJarvis,
    addJarvisTask,
    listJarvisTasks,
    getJarvisStatus,
  };
}
