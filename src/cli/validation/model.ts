/**
 * Validation Model Selection — picks a fast/cheap model for validation checks.
 * The validation model is different from the main agent model (smaller, faster).
 */
import { createProvider, KNOWN_PROVIDERS } from '../providers/registry.js';
import type { LLMProvider } from '../providers/types.js';

export interface ValidationModelConfig {
  provider: string;
  model: string;
}

/**
 * Map from main agent model to the best validation model.
 * Strategy: use the smallest model from the same provider.
 */
const MODEL_MAP: Record<string, ValidationModelConfig> = {
  // Anthropic
  'claude-sonnet-4-6':         { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  'claude-opus-4-6':           { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  'claude-haiku-4-5-20251001': { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },

  // OpenAI
  'gpt-4o':        { provider: 'openai', model: 'gpt-4o-mini' },
  'gpt-4o-mini':   { provider: 'openai', model: 'gpt-4o-mini' },
  'gpt-4-turbo':   { provider: 'openai', model: 'gpt-4o-mini' },
  'o1':            { provider: 'openai', model: 'gpt-4o-mini' },
  'o1-mini':       { provider: 'openai', model: 'gpt-4o-mini' },
  'o3-mini':       { provider: 'openai', model: 'gpt-4o-mini' },

  // DeepSeek
  'deepseek-chat':     { provider: 'deepseek', model: 'deepseek-chat' },
  'deepseek-reasoner': { provider: 'deepseek', model: 'deepseek-chat' },

  // Groq (already fast)
  'llama-3.3-70b-versatile': { provider: 'groq', model: 'llama-3.1-8b-instant' },
  'llama-3.1-8b-instant':    { provider: 'groq', model: 'llama-3.1-8b-instant' },
  'mixtral-8x7b-32768':      { provider: 'groq', model: 'llama-3.1-8b-instant' },
};

/**
 * Get the validation model config for the given main model.
 * Falls back to using the same provider/model if no mapping exists.
 */
export function getValidationModelConfig(mainModel: string, mainProvider: string): ValidationModelConfig {
  const mapped = MODEL_MAP[mainModel];
  if (mapped) return mapped;

  // Fallback: use same provider, try to find a smaller model
  const providerInfo = KNOWN_PROVIDERS[mainProvider];
  if (providerInfo) {
    // Pick the last (usually smallest) model in the list, or just use the same
    const models = providerInfo.models;
    const smallerModel = models[models.length - 1] || mainModel;
    return { provider: mainProvider, model: smallerModel };
  }

  // Ultimate fallback: same model
  return { provider: mainProvider, model: mainModel };
}

/**
 * Create a validation LLM provider instance.
 * Uses the same API key as the main provider.
 */
export function createValidationProvider(
  mainModel: string,
  mainProvider: string,
  apiKey: string,
): LLMProvider {
  const config = getValidationModelConfig(mainModel, mainProvider);
  const providerInfo = KNOWN_PROVIDERS[config.provider];
  const baseURL = providerInfo?.baseURL;

  return createProvider(config.provider, apiKey, config.model, baseURL);
}
