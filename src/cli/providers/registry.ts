import type { LLMProvider } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { RECOMMENDED_MODELS } from './ollama.js';

// FIX: PROVIDERS-s4 — derive ollama.models from RECOMMENDED_MODELS (single source of truth).
// Any additional local-only aliases are appended after the recommended list.
const OLLAMA_EXTRA_MODELS = [
  'deepseek-r1:14b',
  'llama3.3',
  'codellama:34b',
];

const OLLAMA_DERIVED_MODELS = Array.from(
  new Set([...RECOMMENDED_MODELS.map((m) => m.name), ...OLLAMA_EXTRA_MODELS]),
);

/** Known providers with their base URLs and default models */
export const KNOWN_PROVIDERS: Record<string, {
  type: 'anthropic' | 'openai-compatible';
  baseURL?: string;
  models: string[];
  defaultModel: string;
}> = {
  anthropic: {
    type: 'anthropic',
    // FIX: PROVIDERS-M5 — Added opus-4-7 + 1M context variants.
    models: [
      'claude-opus-4-7',
      'claude-opus-4-7-1m',
      'claude-sonnet-4-6',
      'claude-sonnet-4-6-1m',
      'claude-opus-4-6',
      'claude-haiku-4-5-20251001',
    ],
    defaultModel: 'claude-sonnet-4-6',
  },
  openai: {
    type: 'openai-compatible',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'o3-mini'],
    defaultModel: 'gpt-4o',
  },
  deepseek: {
    type: 'openai-compatible',
    baseURL: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
  groq: {
    type: 'openai-compatible',
    baseURL: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  together: {
    type: 'openai-compatible',
    baseURL: 'https://api.together.xyz/v1',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x22B-Instruct-v0.1'],
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  },
  ollama: {
    type: 'openai-compatible',
    baseURL: 'http://localhost:11434/v1',
    // FIX: PROVIDERS-s4 — single source of truth (RECOMMENDED_MODELS).
    models: OLLAMA_DERIVED_MODELS,
    defaultModel: 'qwen2.5-coder:32b',
  },
  zai: {
    type: 'openai-compatible',
    baseURL: 'https://api.z.ai/api/coding/paas/v4',
    models: [
      // Premium
      'glm-5.1',
      'glm-5',
      'glm-5-code',
      // Standard
      'glm-4.7',
      'glm-4.7-flashx',
      'glm-4.6',
      'glm-4.5',
      'glm-4.5-x',
      'glm-4.5-air',
      'glm-4.5-airx',
      // Free
      'glm-4.7-flash',
      'glm-4.5-flash',
    ],
    defaultModel: 'glm-5.1',
  },
  openrouter: {
    type: 'openai-compatible',
    baseURL: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-exp'],
    defaultModel: 'anthropic/claude-sonnet-4',
  },
};

export function createProvider(
  provider: string,
  apiKey: string,
  model: string,
  baseURL?: string,
): LLMProvider {
  const known = KNOWN_PROVIDERS[provider];

  if (provider === 'anthropic') {
    return new AnthropicProvider(apiKey, model);
  }

  // All other providers use OpenAI-compatible client
  const url = baseURL ?? known?.baseURL;
  return new OpenAIProvider(apiKey, model, url, provider);
}

/** Get all known provider names */
export function getProviderNames(): string[] {
  return Object.keys(KNOWN_PROVIDERS);
}

/** Models that are completely free to use (no cost per token) */
export const FREE_MODELS = new Set([
  'glm-4.7-flash',
  'glm-4.5-flash',
]);

/** Check if a model is free */
export function isModelFree(model: string): boolean {
  return FREE_MODELS.has(model);
}

/** Register a model as free at runtime (e.g. from user config) */
export function registerFreeModel(model: string): void {
  FREE_MODELS.add(model);
}

/** Remove a model from the free set */
export function unregisterFreeModel(model: string): void {
  FREE_MODELS.delete(model);
}
