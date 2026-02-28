/**
 * Model context window sizes (in tokens).
 *
 * Used to calculate trim budgets so the agent loop never exceeds
 * the model's context limit during long tool-heavy runs.
 */

const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  // Anthropic
  'claude-opus-4-6': 200_000,
  'claude-sonnet-4-6': 200_000,
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

/**
 * Get the context window size for a model.
 * Falls back to 32k for Ollama models, 128k for everything else.
 */
export function getModelContextLength(model: string, provider?: string): number {
  // Exact match first
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
