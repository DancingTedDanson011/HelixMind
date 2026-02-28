import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ProviderEntry {
  apiKey: string;
  models: string[];
  baseURL?: string;
}

export interface HelixMindConfig {
  provider: string;
  apiKey: string;
  model: string;
  providers: Record<string, ProviderEntry>;
  spiral: {
    enabled: boolean;
    autoStore: boolean;
    maxTokensBudget: number;
  };
  relay?: {
    url?: string;
    apiKey?: string;
    autoConnect?: boolean;
    userId?: string;
    userEmail?: string;
    plan?: string;
    loginAt?: string;
  };
}

// Keep in sync with KNOWN_PROVIDERS in providers/registry.ts
// Auto-merge in load() ensures existing configs get new models automatically
const DEFAULT_MODELS: Record<string, string[]> = {
  anthropic: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'o3-mini'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  together: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x22B-Instruct-v0.1'],
  ollama: ['qwen3-coder:30b', 'qwen2.5-coder:32b', 'qwen2.5-coder:14b', 'qwen2.5-coder:7b', 'deepseek-r1:32b', 'deepseek-r1:14b', 'deepseek-coder-v2:16b', 'llama3.3', 'codellama:34b'],
  openrouter: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-exp'],
  zai: [
    'glm-5', 'glm-5-code',
    'glm-4.7', 'glm-4.7-flashx', 'glm-4.7-flash',
    'glm-4.6',
    'glm-4.5', 'glm-4.5-x', 'glm-4.5-air', 'glm-4.5-airx', 'glm-4.5-flash',
  ],
};

const DEFAULT_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
  ollama: 'http://localhost:11434/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  zai: 'https://api.z.ai/api/paas/v4',
};

const DEFAULT_CONFIG: HelixMindConfig = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-sonnet-4-6',
  providers: {},
  spiral: {
    enabled: true,
    autoStore: true,
    maxTokensBudget: 40000,
  },
};

export class ConfigStore {
  private configPath: string;
  private config: HelixMindConfig;

  constructor(configDir: string) {
    mkdirSync(configDir, { recursive: true });
    this.configPath = join(configDir, 'config.json');
    this.config = this.load();
  }

  private load(): HelixMindConfig {
    if (!existsSync(this.configPath)) {
      this.save(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG, providers: {}, spiral: { ...DEFAULT_CONFIG.spiral } };
    }
    try {
      const raw = JSON.parse(readFileSync(this.configPath, 'utf-8'));

      // Auto-merge: add new default models to existing providers
      if (raw.providers) {
        for (const [name, defaults] of Object.entries(DEFAULT_MODELS)) {
          const stored = raw.providers[name] as ProviderEntry | undefined;
          if (stored?.models) {
            const existing = new Set(stored.models);
            for (const m of defaults) {
              if (!existing.has(m)) stored.models.push(m);
            }
          }
        }
      }

      return {
        ...DEFAULT_CONFIG,
        ...raw,
        providers: raw.providers ?? {},
        spiral: { ...DEFAULT_CONFIG.spiral, ...(raw.spiral ?? {}) },
        relay: raw.relay ?? undefined,
      };
    } catch {
      return { ...DEFAULT_CONFIG, providers: {}, spiral: { ...DEFAULT_CONFIG.spiral } };
    }
  }

  private save(config: HelixMindConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  getAll(): HelixMindConfig {
    return this.config;
  }

  get(key: string): unknown {
    const parts = key.split('.');
    let current: unknown = this.config;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  set(key: string, value: unknown): void {
    const parts = key.split('.');
    const record = this.config as unknown as Record<string, unknown>;
    if (parts.length === 1) {
      record[key] = value;
    } else if (parts.length === 2) {
      const [section, prop] = parts;
      // Auto-create section objects (e.g. relay.url when relay doesn't exist yet)
      if (!record[section] || typeof record[section] !== 'object') {
        record[section] = {};
      }
      (record[section] as Record<string, unknown>)[prop] = value;
    }
    this.save(this.config);
  }

  // --- Provider management ---

  /** Add or update a provider with an API key */
  addProvider(name: string, apiKey: string, baseURL?: string): void {
    const models = DEFAULT_MODELS[name] ?? [];
    const url = baseURL ?? DEFAULT_BASE_URLS[name];
    this.config.providers[name] = {
      apiKey,
      models,
      ...(url ? { baseURL: url } : {}),
    };

    // If this is the first provider, make it active
    if (!this.config.apiKey) {
      this.config.provider = name;
      this.config.apiKey = apiKey;
      this.config.model = models[0] ?? '';
    }

    this.save(this.config);
  }

  /** Remove a provider and its API key */
  removeProvider(name: string): boolean {
    if (!this.config.providers[name]) return false;
    delete this.config.providers[name];

    // If we removed the active provider, switch to another
    if (this.config.provider === name) {
      const remaining = Object.keys(this.config.providers);
      if (remaining.length > 0) {
        const next = remaining[0];
        this.config.provider = next;
        this.config.apiKey = this.config.providers[next].apiKey;
        this.config.model = this.config.providers[next].models[0] ?? '';
      } else {
        this.config.apiKey = '';
        this.config.model = '';
      }
    }

    this.save(this.config);
    return true;
  }

  /** Switch to a specific provider + model */
  switchProvider(name: string, model?: string): boolean {
    const entry = this.config.providers[name];
    if (!entry) return false;

    this.config.provider = name;
    this.config.apiKey = entry.apiKey;
    this.config.model = model ?? entry.models[0] ?? '';
    this.save(this.config);
    return true;
  }

  /** Switch model within the current provider */
  switchModel(model: string): void {
    this.config.model = model;
    this.save(this.config);
  }

  /** Get all stored providers */
  getProviders(): Array<{ name: string; entry: ProviderEntry; active: boolean }> {
    return Object.entries(this.config.providers).map(([name, entry]) => ({
      name,
      entry,
      active: name === this.config.provider,
    }));
  }

  /** Get available models for a provider */
  getModels(providerName?: string): string[] {
    const name = providerName ?? this.config.provider;
    return this.config.providers[name]?.models ?? DEFAULT_MODELS[name] ?? [];
  }

  /** Check if any API key is configured */
  hasApiKey(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 0;
  }

  /** Mask an API key for display (show first 8 + last 4) */
  static maskKey(key: string): string {
    if (key.length <= 12) return '***';
    return key.slice(0, 8) + '...' + key.slice(-4);
  }

  /** Check if authenticated with HelixMind web platform */
  isLoggedIn(): boolean {
    return !!this.config.relay?.apiKey;
  }

  /** Get auth info or null if not logged in */
  getAuthInfo(): { apiKey: string; url: string; userId?: string; email?: string; plan?: string } | null {
    if (!this.config.relay?.apiKey) return null;
    return {
      apiKey: this.config.relay.apiKey,
      url: this.config.relay.url ?? '',
      userId: this.config.relay.userId,
      email: this.config.relay.userEmail,
      plan: this.config.relay.plan,
    };
  }

  /** Clear auth data (logout) */
  clearAuth(): void {
    if (this.config.relay) {
      delete this.config.relay.apiKey;
      delete this.config.relay.userId;
      delete this.config.relay.userEmail;
      delete this.config.relay.plan;
      delete this.config.relay.loginAt;
    }
    this.save(this.config);
  }

  listFlat(): Array<{ key: string; value: unknown }> {
    const entries: Array<{ key: string; value: unknown }> = [];
    for (const [key, value] of Object.entries(this.config)) {
      if (key === 'providers') {
        for (const [pName, pEntry] of Object.entries(value as Record<string, ProviderEntry>)) {
          entries.push({ key: `providers.${pName}.apiKey`, value: ConfigStore.maskKey(pEntry.apiKey) });
          entries.push({ key: `providers.${pName}.models`, value: pEntry.models.join(', ') });
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        for (const [subKey, subValue] of Object.entries(value)) {
          entries.push({ key: `${key}.${subKey}`, value: subValue });
        }
      } else if (key === 'apiKey') {
        entries.push({ key, value: value ? ConfigStore.maskKey(value as string) : '(not set)' });
      } else {
        entries.push({ key, value });
      }
    }
    return entries;
  }
}
