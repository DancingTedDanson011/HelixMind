import type { BenchConfig, TaskResult, BenchRunMetrics } from './types.js';

/** Model pricing per 1M tokens in USD */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'o1': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 3.0, output: 12.0 },
  'o3-mini': { input: 1.1, output: 4.4 },
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  // Z.AI
  'glm-5': { input: 0.5, output: 1.0 },
  'glm-4.7': { input: 0.3, output: 0.6 },
  'glm-4.6': { input: 0.2, output: 0.4 },
  'glm-4.5': { input: 0.15, output: 0.3 },
  // OpenRouter (pass-through pricing varies)
  'anthropic/claude-sonnet-4': { input: 3.0, output: 15.0 },
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
};

/** Estimate cost for a given model and token counts */
export function estimateCost(model: string, tokens: { input: number; output: number }): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (tokens.input / 1_000_000) * pricing.input + (tokens.output / 1_000_000) * pricing.output;
}

/** Format USD with appropriate precision */
export function formatCurrency(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

/** Format token count for display */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

/** Format duration in human-readable form */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Compute aggregated metrics from a set of task results */
export function computeMetrics(config: BenchConfig, results: TaskResult[]): BenchRunMetrics {
  const resolved = results.filter(r => r.status === 'resolved').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const errors = results.filter(r => r.status === 'error').length;
  const timeouts = results.filter(r => r.status === 'timeout').length;

  const totalTokensIn = results.reduce((sum, r) => sum + r.tokens.input, 0);
  const totalTokensOut = results.reduce((sum, r) => sum + r.tokens.output, 0);
  const totalToolCalls = results.reduce((sum, r) => sum + r.toolCalls, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

  const n = results.length || 1;

  return {
    runId: config.runId,
    timestamp: new Date().toISOString(),
    dataset: config.dataset,
    provider: config.provider,
    model: config.model,
    totalTasks: results.length,
    resolved,
    failed,
    errors,
    timeouts,
    resolutionRate: results.length > 0 ? (resolved / results.length) * 100 : 0,
    avgTokensPerTask: {
      input: Math.round(totalTokensIn / n),
      output: Math.round(totalTokensOut / n),
    },
    avgToolCallsPerTask: Math.round((totalToolCalls / n) * 10) / 10,
    avgDurationMs: Math.round(totalDuration / n),
    totalCostEstimate: estimateCost(config.model, { input: totalTokensIn, output: totalTokensOut }),
    totalDurationMs: totalDuration,
    taskResults: results,
    spiralMode: config.withSpiral ? (config.spiralMode ?? 'fresh') : undefined,
  };
}
