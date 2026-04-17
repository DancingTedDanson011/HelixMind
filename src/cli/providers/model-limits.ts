/**
 * Model context window sizes (in tokens).
 *
 * Used to calculate trim budgets so the agent loop never exceeds
 * the model's context limit during long tool-heavy runs.
 */

const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  // Anthropic
  // FIX: PROVIDERS-M5 — Added opus-4-7 and 1M context variants.
  'claude-opus-4-7': 200_000,
  'claude-opus-4-7-1m': 1_000_000,
  'claude-opus-4-6': 200_000,
  'claude-sonnet-4-6': 200_000,
  'claude-sonnet-4-6-1m': 1_000_000,
  'claude-haiku-4-5-20251001': 200_000,
  'claude-haiku-4-5': 200_000,

  // OpenAI
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4-turbo': 128_000,
  'o1': 200_000,
  'o1-mini': 200_000,
  'o3-mini': 200_000,

  // DeepSeek
  'deepseek-chat': 64_000,
  'deepseek-reasoner': 64_000,

  // ZhipuAI (Z.AI)
  'glm-5.1': 128_000,
  'glm-5': 128_000,
  'glm-5-code': 128_000,
  'glm-4.7': 128_000,
  'glm-4.7-flashx': 128_000,
  'glm-4.7-flash': 128_000,
  'glm-4.6': 128_000,
  'glm-4.5': 128_000,
  'glm-4.5-x': 128_000,
  'glm-4.5-air': 8_000,
  'glm-4.5-airx': 8_000,
  'glm-4.5-flash': 128_000,

  // Groq
  'llama-3.3-70b-versatile': 128_000,
  'llama-3.1-8b-instant': 128_000,
  'mixtral-8x7b-32768': 32_768,
};

const DEFAULT_CONTEXT_LENGTH = 128_000;
const OLLAMA_DEFAULT_CONTEXT_LENGTH = 32_000;

/** Runtime-extensible overrides (populated by ConfigStore on load) */
const CUSTOM_CONTEXT_LENGTHS: Map<string, number> = new Map();

/** Register a custom context length for a model (e.g. from user config) */
export function registerModelContextLength(model: string, length: number): void {
  CUSTOM_CONTEXT_LENGTHS.set(model, length);
}

/** Remove a custom context length registration */
export function unregisterModelContextLength(model: string): void {
  CUSTOM_CONTEXT_LENGTHS.delete(model);
}

/**
 * Get the context window size for a model.
 * Priority: custom registration > hardcoded > prefix match > provider default.
 */
export function getModelContextLength(model: string, provider?: string): number {
  // Custom overrides first (user-configured models)
  const custom = CUSTOM_CONTEXT_LENGTHS.get(model);
  if (custom !== undefined) return custom;

  // Exact match in hardcoded map
  if (MODEL_CONTEXT_LENGTHS[model] !== undefined) {
    return MODEL_CONTEXT_LENGTHS[model];
  }

  // Prefix match (e.g. "claude-sonnet-4-6-20250514" → "claude-sonnet-4-6")
  for (const [key, value] of Object.entries(MODEL_CONTEXT_LENGTHS)) {
    if (model.startsWith(key)) {
      return value;
    }
  }

  // Ollama models default to 32k
  if (provider === 'ollama') {
    return OLLAMA_DEFAULT_CONTEXT_LENGTH;
  }

  return DEFAULT_CONTEXT_LENGTH;
}

/**
 * Per-model output-token caps used by chatWithTools.
 * FIX: PROVIDERS-M2 — chatWithTools previously hardcoded max_tokens=8192 which
 * caused truncation for reasoning models with larger output budgets.
 */
export const MAX_OUTPUT_TOKENS: Record<string, number> = {
  // Anthropic
  'claude-opus-4-7': 32_000,
  'claude-opus-4-7-1m': 32_000,
  'claude-opus-4-6': 16_000,
  'claude-sonnet-4-6': 64_000,
  'claude-sonnet-4-6-1m': 64_000,
  'claude-haiku-4-5': 8_192,
  'claude-haiku-4-5-20251001': 8_192,

  // OpenAI / reasoning
  'gpt-4o': 16_384,
  'gpt-4o-mini': 16_384,
  'o1': 100_000,
  'o1-mini': 65_536,
  'o3-mini': 100_000,

  // DeepSeek
  'deepseek-chat': 8_192,
  'deepseek-reasoner': 8_192,
};

const DEFAULT_MAX_OUTPUT_TOKENS = 8_192;

/** Get the recommended max output token budget for a model. */
export function getMaxOutputTokens(model: string): number {
  if (MAX_OUTPUT_TOKENS[model] !== undefined) {
    return MAX_OUTPUT_TOKENS[model];
  }
  // Prefix match (e.g. "claude-sonnet-4-6-20250514" → "claude-sonnet-4-6")
  for (const [key, value] of Object.entries(MAX_OUTPUT_TOKENS)) {
    if (model.startsWith(key)) return value;
  }
  return DEFAULT_MAX_OUTPUT_TOKENS;
}
