import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { BrainExport } from './exporter.js';
import type { BrainScope } from '../../utils/config.js';
import { generateBrainHTML } from './template.js';
import { startBrainServer, type BrainServer } from './server.js';
import type { ControlHandlers, InstanceMeta, SessionInfo } from './control-protocol.js';

/** Generate a static HTML file (fallback / export) */
export function generateBrainFile(data: BrainExport): string {
  const html = generateBrainHTML(data);
  const outputPath = join(tmpdir(), 'helixmind-brain.html');
  writeFileSync(outputPath, html, 'utf-8');
  return outputPath;
}

/** Active brain server instance (singleton per process) */
let activeBrainServer: BrainServer | null = null;
let updateInterval: ReturnType<typeof setInterval> | null = null;

/** Pending handlers to register when server starts */
let pendingVoiceHandler: ((text: string) => void) | null = null;
let pendingScopeSwitchHandler: ((scope: 'project' | 'global') => void) | null = null;
let pendingModelActivateHandler: ((model: string) => void) | null = null;

/** Relay client instance */
let activeRelayClient: { close(): void } | null = null;

/**
 * Start a live brain server that auto-refreshes when spiral data changes.
 * Returns the URL to open in browser. Subsequent calls reuse the same server.
 */
export async function startLiveBrain(
  engine: any,
  projectName: string = 'HelixMind Project',
  brainScope: BrainScope = 'global',
): Promise<string> {
  const { exportBrainData } = await import('./exporter.js');
  const initialData = exportBrainData(engine, projectName, brainScope);

  if (activeBrainServer) {
    // Server already running — just push fresh data
    activeBrainServer.pushUpdate(initialData);
    return activeBrainServer.url;
  }

  // Start new server
  activeBrainServer = await startBrainServer(initialData);

  // Register any pending handlers
  if (pendingVoiceHandler) {
    activeBrainServer.onVoiceInput(pendingVoiceHandler);
  }
  if (pendingScopeSwitchHandler) {
    activeBrainServer.onScopeSwitch(pendingScopeSwitchHandler);
  }
  if (pendingModelActivateHandler) {
    activeBrainServer.onModelActivate(pendingModelActivateHandler);
  }

  // Poll spiral engine for changes every 5 seconds
  let lastNodeCount = initialData.meta.totalNodes;
  let lastEdgeCount = initialData.meta.totalEdges;

  updateInterval = setInterval(() => {
    try {
      const freshData = exportBrainData(engine, projectName, brainScope);
      if (freshData.meta.totalNodes !== lastNodeCount ||
          freshData.meta.totalEdges !== lastEdgeCount) {
        lastNodeCount = freshData.meta.totalNodes;
        lastEdgeCount = freshData.meta.totalEdges;
        activeBrainServer?.pushUpdate(freshData);
      }
    } catch {
      // Engine might be closed
    }
  }, 5000);

  return activeBrainServer.url;
}

/** Stop the live brain server */
export function stopLiveBrain(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  if (activeRelayClient) {
    activeRelayClient.close();
    activeRelayClient = null;
  }
  if (activeBrainServer) {
    activeBrainServer.close();
    activeBrainServer = null;
  }
  // Clear pending handlers when server stops
  pendingVoiceHandler = null;
  pendingScopeSwitchHandler = null;
  pendingModelActivateHandler = null;
}

/**
 * Push a web knowledge event to the brain visualization.
 * Shows a live popup animation in the 3D view when new web knowledge arrives.
 */
export function pushWebKnowledge(topic: string, summary: string, source: string): void {
  if (!activeBrainServer) return;
  activeBrainServer.pushEvent({
    type: 'web_knowledge',
    topic,
    summary,
    source,
    timestamp: Date.now(),
  });
}

/**
 * Push an agent finding to the brain visualization.
 * Shows a live popup for security findings, auto-fix results, etc.
 */
export function pushAgentFinding(
  sessionName: string,
  finding: string,
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
  file?: string,
): void {
  if (!activeBrainServer) return;
  activeBrainServer.pushEvent({
    type: 'agent_finding',
    sessionName,
    finding,
    severity,
    file: file || '',
    timestamp: Date.now(),
  });
}

/** Check if brain server is running */
export function isBrainServerRunning(): boolean {
  return activeBrainServer !== null;
}

/**
 * Register a handler for voice input from the brain browser.
 * When the user speaks in the browser, the transcribed text is sent here.
 */
export function onBrainVoiceInput(handler: (text: string) => void): void {
  if (activeBrainServer) {
    activeBrainServer.onVoiceInput(handler);
  }
  pendingVoiceHandler = handler;
}

/**
 * Register a handler for scope switch from the brain browser.
 * When the user clicks Local/Global in the browser header.
 */
export function onBrainScopeSwitch(handler: (scope: 'project' | 'global') => void): void {
  if (activeBrainServer) {
    activeBrainServer.onScopeSwitch(handler);
  }
  pendingScopeSwitchHandler = handler;
}

/**
 * Push a scope change confirmation to the browser.
 */
export function pushScopeChange(scope: 'project' | 'global'): void {
  if (!activeBrainServer) return;
  activeBrainServer.pushEvent({ type: 'scope_changed', scope, timestamp: Date.now() });
}

/**
 * Register a handler for model activation from the brain browser.
 * When the user clicks "Activate" on a model in the browser.
 */
export function onBrainModelActivate(handler: (model: string) => void): void {
  if (activeBrainServer) {
    activeBrainServer.onModelActivate(handler);
  }
  pendingModelActivateHandler = handler;
}

/**
 * Push a model activated confirmation to the browser.
 */
export function pushModelActivated(model: string): void {
  if (!activeBrainServer) return;
  activeBrainServer.pushEvent({ type: 'model_activated', model, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Control Protocol — CLI ↔ Web
// ---------------------------------------------------------------------------

/** Register control handlers on the active brain server */
export function registerControlHandlers(handlers: ControlHandlers): void {
  if (activeBrainServer) {
    activeBrainServer.registerControlHandlers(handlers);
  }
}

/** Set instance metadata on the brain server (for discovery) */
export function setInstanceMeta(meta: InstanceMeta): void {
  if (activeBrainServer) {
    activeBrainServer.setInstanceMeta(meta);
  }
}

/** Get the brain server connection token (for local auth) */
export function getBrainToken(): string | null {
  return activeBrainServer?.connectionToken ?? null;
}

/** Push a session-updated event to control clients */
export function pushSessionUpdate(session: SessionInfo): void {
  if (!activeBrainServer) return;
  activeBrainServer.pushControlEvent({
    type: 'session_updated',
    session,
    timestamp: Date.now(),
  });
}

/** Push a session-created event to control clients */
export function pushSessionCreated(session: SessionInfo): void {
  if (!activeBrainServer) return;
  activeBrainServer.pushControlEvent({
    type: 'session_created',
    session,
    timestamp: Date.now(),
  });
}

/** Push a session-removed event to control clients */
export function pushSessionRemoved(sessionId: string): void {
  if (!activeBrainServer) return;
  activeBrainServer.pushControlEvent({
    type: 'session_removed',
    sessionId,
    timestamp: Date.now(),
  });
}

/** Push an output line event to subscribed control clients */
export function pushOutputLine(sessionId: string, line: string, lineIndex: number): void {
  if (!activeBrainServer) return;
  activeBrainServer.pushControlEvent({
    type: 'output_line',
    sessionId,
    line,
    lineIndex,
    timestamp: Date.now(),
  });
}

/**
 * Start the relay client (outbound connection to Web Server).
 * Only connects if relay.url + relay.apiKey are configured.
 */
export async function startRelayClient(
  relayUrl: string,
  apiKey: string,
  handlers: ControlHandlers,
  getInstanceMeta: () => InstanceMeta,
): Promise<void> {
  try {
    const { createRelayClient } = await import('./relay-client.js');
    activeRelayClient = createRelayClient(relayUrl, apiKey, handlers, getInstanceMeta, activeBrainServer);
  } catch {
    // Relay client is optional
  }
}
