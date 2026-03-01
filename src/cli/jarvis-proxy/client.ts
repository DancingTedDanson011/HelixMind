/**
 * Jarvis Proxy Client — Thin client that sends Jarvis commands to the server.
 * NO Jarvis AGI logic here. All intelligence runs server-side.
 * Commands are sent via the existing Relay WebSocket connection.
 */
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Message Types
// ---------------------------------------------------------------------------

export interface JarvisProxyMessage {
  type: string;
  requestId?: string;
  timestamp: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Message Factories
// ---------------------------------------------------------------------------

export function createStartJarvisMessage(): JarvisProxyMessage {
  return {
    type: 'start_jarvis',
    requestId: randomUUID().slice(0, 12),
    timestamp: Date.now(),
  };
}

export function createStopJarvisMessage(): JarvisProxyMessage {
  return {
    type: 'stop_jarvis',
    requestId: randomUUID().slice(0, 12),
    timestamp: Date.now(),
  };
}

export function createAddTaskMessage(
  title: string,
  description: string,
  opts?: { priority?: string; dependencies?: number[]; tags?: string[] },
): JarvisProxyMessage {
  return {
    type: 'add_jarvis_task',
    title,
    description,
    priority: opts?.priority,
    dependencies: opts?.dependencies,
    tags: opts?.tags,
    requestId: randomUUID().slice(0, 12),
    timestamp: Date.now(),
  };
}

export function createListTasksMessage(): JarvisProxyMessage {
  return {
    type: 'list_jarvis_tasks',
    requestId: randomUUID().slice(0, 12),
    timestamp: Date.now(),
  };
}

export function createGetStatusMessage(): JarvisProxyMessage {
  return {
    type: 'get_jarvis_status',
    requestId: randomUUID().slice(0, 12),
    timestamp: Date.now(),
  };
}

export function createPauseJarvisMessage(): JarvisProxyMessage {
  return {
    type: 'pause_jarvis',
    requestId: randomUUID().slice(0, 12),
    timestamp: Date.now(),
  };
}

export function createResumeJarvisMessage(): JarvisProxyMessage {
  return {
    type: 'resume_jarvis',
    requestId: randomUUID().slice(0, 12),
    timestamp: Date.now(),
  };
}
