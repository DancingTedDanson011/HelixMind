import type { TaskStep } from '../ui/activity.js';

/** A single SWE-bench task from HuggingFace dataset */
export interface SWETask {
  instance_id: string;
  repo: string;
  base_commit: string;
  problem_statement: string;
  hints_text: string;
  patch: string;
  test_patch: string;
  FAIL_TO_PASS: string;
  PASS_TO_PASS: string;
  version: string;
  environment_setup_commit: string;
  created_at: string;
}

/** Configuration for a benchmark run */
export interface BenchConfig {
  dataset: 'lite' | 'verified';
  taskLimit?: number;
  taskFilter?: RegExp;
  provider: string;
  model: string;
  apiKey: string;
  baseURL?: string;
  maxIterations: number;
  timeoutSeconds: number;
  parallelism: number;
  outputDir: string;
  runId: string;
  noCache?: boolean;
  /** Enable Spiral Memory for context-enhanced solving */
  withSpiral?: boolean;
  /** Spiral mode: 'fresh' = new spiral per task, 'learning' = shared spiral across tasks */
  spiralMode?: 'fresh' | 'learning';
  /** Resume a previous run — skip already-completed tasks */
  resumeRunId?: string;
}

/** Result for a single task */
export interface TaskResult {
  instance_id: string;
  status: 'resolved' | 'failed' | 'error' | 'timeout';
  model_patch: string;
  tokens: { input: number; output: number };
  toolCalls: number;
  steps: Array<{ tool: string; label: string; status: string }>;
  errors: string[];
  durationMs: number;
  agentText: string;
  testOutput?: string;
}

/** Aggregated metrics for a complete run */
export interface BenchRunMetrics {
  runId: string;
  timestamp: string;
  dataset: string;
  provider: string;
  model: string;
  totalTasks: number;
  resolved: number;
  failed: number;
  errors: number;
  timeouts: number;
  resolutionRate: number;
  avgTokensPerTask: { input: number; output: number };
  avgToolCallsPerTask: number;
  avgDurationMs: number;
  totalCostEstimate: number;
  totalDurationMs: number;
  taskResults: TaskResult[];
  spiralMode?: string;
}

/** SWE-bench compatible prediction for JSONL output */
export interface SWEPrediction {
  instance_id: string;
  model_name_or_path: string;
  model_patch: string;
}

/** Progress event from a running task */
export interface TaskProgressEvent {
  type: 'tokens' | 'tool' | 'status';
  input?: number;
  output?: number;
  name?: string;
  message?: string;
}

/** Stored run summary for listing */
export interface RunSummary {
  runId: string;
  timestamp: string;
  dataset: string;
  provider: string;
  model: string;
  resolved: number;
  totalTasks: number;
  resolutionRate: number;
  totalCostEstimate: number;
  spiralMode?: string;
}
