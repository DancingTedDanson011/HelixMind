/**
 * Jarvis Proxy Types — Message types for CLI ↔ Server Jarvis communication.
 * This is a thin client — NO Jarvis AGI logic lives here.
 * All intelligence runs server-side; the CLI only proxies commands and tool calls.
 */

export interface JarvisProxyConfig {
  /** Maximum number of Jarvis instances for the current plan */
  maxInstances: number;
  /** Whether deep thinking is available */
  deepThinking: boolean;
  /** Whether scheduling is available */
  scheduling: boolean;
  /** Whether triggers are available */
  triggers: boolean;
  /** Whether parallel execution is available */
  parallel: boolean;
}

export type JarvisProxyStatus = 'disconnected' | 'connecting' | 'connected' | 'running' | 'paused' | 'error';

export interface JarvisProxyState {
  status: JarvisProxyStatus;
  instanceCount: number;
  config: JarvisProxyConfig;
  lastError?: string;
}
