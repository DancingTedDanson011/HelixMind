/**
 * Server-Side Jarvis AGI — Entry Point
 *
 * This is the server-side Jarvis engine that runs on the HelixMind web platform.
 * Jarvis code is NEVER distributed to clients — it runs exclusively server-side.
 *
 * Architecture:
 * - Worker Manager: Manages Jarvis instances per user (plan-limited)
 * - Remote Tools: Bridges tool calls between server LLM loop and CLI
 * - Plan Check: Validates user plan before starting Jarvis
 */
export {
  startWorker,
  stopWorker,
  pauseWorker,
  resumeWorker,
  getActiveWorkers,
  getAllWorkers,
  getWorker,
  updateWorkerTask,
  recordTaskResult,
  setWorkerAutonomy,
  cleanupStoppedWorkers,
  getTotalActiveWorkers,
  type StartWorkerResult,
} from './worker-manager';

export {
  createRemoteToolCall,
  resolveToolCall,
  cancelSessionCalls,
  getPendingCallCount,
  getSessionPendingCalls,
} from './remote-tools';

export {
  canStartJarvis,
  canUseDeepThinking,
  canUseScheduling,
  canUseTriggers,
  canUseParallel,
  type PlanCheckResult,
} from './plan-check';

export type {
  JarvisWorker,
  JarvisTask,
  JarvisStatusInfo,
  JarvisPlanLimits,
  RemoteToolCall,
  RemoteToolResult,
  WorkerStatus,
  AutonomyLevel,
} from './types';

export { JARVIS_PLAN_LIMITS, AUTONOMY_LABELS } from './types';
