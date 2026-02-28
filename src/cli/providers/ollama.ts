/**
 * Ollama integration — detect, list models, pull new models.
 * Ollama exposes an OpenAI-compatible API at localhost:11434/v1,
 * so we reuse the OpenAIProvider for actual inference.
 */

const OLLAMA_BASE = 'http://localhost:11434';

/** Recommended coding models sorted by quality (best first) */
export const RECOMMENDED_MODELS = [
  {
    name: 'qwen3-coder:30b',
    size: '~18 GB',
    description: 'Best coding model for 32GB VRAM (MoE, 30B total / 3B active)',
    vram: 18,
  },
  {
    name: 'qwen2.5-coder:32b',
    size: '~22 GB',
    description: 'Battle-tested coding champion, excellent tool use',
    vram: 22,
  },
  {
    name: 'qwen2.5-coder:14b',
    size: '~10 GB',
    description: 'Great coding, lower VRAM — fast on any GPU',
    vram: 10,
  },
  {
    name: 'deepseek-r1:32b',
    size: '~22 GB',
    description: 'Strong reasoning + coding (chain-of-thought)',
    vram: 22,
  },
  {
    name: 'qwen2.5-coder:7b',
    size: '~5 GB',
    description: 'Lightweight coder, runs on almost anything',
    vram: 5,
  },
  {
    name: 'deepseek-coder-v2:16b',
    size: '~11 GB',
    description: 'Good all-round coder, MoE architecture',
    vram: 11,
  },
];

/** Check if Ollama is running locally */
export async function isOllamaRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${OLLAMA_BASE}/api/version`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/** Get Ollama version string */
export async function getOllamaVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${OLLAMA_BASE}/api/version`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json() as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

/** List models currently installed in Ollama */
export async function listOllamaModels(): Promise<OllamaModel[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json() as { models?: OllamaModel[] };
    return data.models ?? [];
  } catch {
    return [];
  }
}

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
}

/** Format model size for display */
export function formatModelSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

/**
 * Pull (download) an Ollama model. Streams progress.
 * Returns true if successful.
 */
export async function pullOllamaModel(
  modelName: string,
  onProgress?: (status: string, completed?: number, total?: number) => void,
): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!res.ok || !res.body) return false;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line) as {
            status?: string;
            completed?: number;
            total?: number;
            error?: string;
          };
          if (data.error) {
            onProgress?.(`Error: ${data.error}`);
            return false;
          }
          onProgress?.(data.status ?? '', data.completed, data.total);
        } catch {
          // Ignore parse errors in stream
        }
      }
    }

    return true;
  } catch (err) {
    onProgress?.(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
