import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SWETask } from './types.js';

const DATASET_NAMES: Record<string, string> = {
  lite: 'princeton-nlp/SWE-bench_Lite',
  verified: 'princeton-nlp/SWE-bench_Verified',
};

const HF_API = 'https://datasets-server.huggingface.co';
const PAGE_SIZE = 100;

/**
 * Fetch SWE-bench dataset from HuggingFace REST API.
 * Paginates in chunks of 100 rows.
 */
async function fetchDataset(variant: 'lite' | 'verified'): Promise<SWETask[]> {
  const dataset = DATASET_NAMES[variant];
  if (!dataset) throw new Error(`Unknown dataset variant: ${variant}`);

  const tasks: SWETask[] = [];
  let offset = 0;

  while (true) {
    const url = `${HF_API}/rows?dataset=${encodeURIComponent(dataset)}&config=default&split=test&offset=${offset}&length=${PAGE_SIZE}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HuggingFace API error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json() as { rows: Array<{ row: Record<string, unknown> }> };

    if (!data.rows || data.rows.length === 0) break;

    for (const item of data.rows) {
      const r = item.row;
      tasks.push({
        instance_id: String(r.instance_id ?? ''),
        repo: String(r.repo ?? ''),
        base_commit: String(r.base_commit ?? ''),
        problem_statement: String(r.problem_statement ?? ''),
        hints_text: String(r.hints_text ?? ''),
        patch: String(r.patch ?? ''),
        test_patch: String(r.test_patch ?? ''),
        FAIL_TO_PASS: String(r.FAIL_TO_PASS ?? '[]'),
        PASS_TO_PASS: String(r.PASS_TO_PASS ?? '[]'),
        version: String(r.version ?? ''),
        environment_setup_commit: String(r.environment_setup_commit ?? ''),
        created_at: String(r.created_at ?? ''),
      });
    }

    if (data.rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return tasks;
}

/**
 * Load dataset with local file cache.
 * Cache stored at cacheDir/datasets/{variant}.json
 */
export async function loadDataset(
  variant: 'lite' | 'verified',
  cacheDir: string,
  options?: { filter?: RegExp; limit?: number; noCache?: boolean },
): Promise<SWETask[]> {
  const datasetDir = join(cacheDir, 'datasets');
  const cachePath = join(datasetDir, `${variant}.json`);

  let tasks: SWETask[];

  if (!options?.noCache && existsSync(cachePath)) {
    try {
      tasks = JSON.parse(readFileSync(cachePath, 'utf-8'));
    } catch {
      tasks = await fetchDataset(variant);
      mkdirSync(datasetDir, { recursive: true });
      writeFileSync(cachePath, JSON.stringify(tasks), 'utf-8');
    }
  } else {
    tasks = await fetchDataset(variant);
    mkdirSync(datasetDir, { recursive: true });
    writeFileSync(cachePath, JSON.stringify(tasks), 'utf-8');
  }

  // Apply filter
  if (options?.filter) {
    tasks = tasks.filter(t => options.filter!.test(t.instance_id));
  }

  // Apply limit
  if (options?.limit && options.limit > 0) {
    tasks = tasks.slice(0, options.limit);
  }

  return tasks;
}

/** Get count of cached tasks without loading full dataset */
export function getCachedCount(variant: 'lite' | 'verified', cacheDir: string): number | null {
  const cachePath = join(cacheDir, 'datasets', `${variant}.json`);
  if (!existsSync(cachePath)) return null;
  try {
    const data = JSON.parse(readFileSync(cachePath, 'utf-8'));
    return Array.isArray(data) ? data.length : null;
  } catch {
    return null;
  }
}
