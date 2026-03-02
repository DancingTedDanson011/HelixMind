/**
 * Brain Sync — push/pull spiral brain snapshots to/from the web platform.
 * Used by PRO+ plans for cloud brain backup and cross-device sync.
 */

/** Loose interface — SpiralEngine may or may not implement these methods */
interface SyncableEngine {
  getFullExport?(): { nodes: unknown[]; edges?: unknown[] };
  getAllNodes?(): unknown[];
  clearAllNodes?(): void;
  importNode?(node: unknown): void;
}

export interface SyncStatus {
  synced: boolean;
  version: number;
  lastSyncedAt: number | null;
}

export interface SyncResult {
  success: boolean;
  version?: number;
  sizeBytes?: number;
  error?: string;
}

interface SyncResponse {
  version?: number;
  sizeBytes?: number;
  error?: string;
  nodesJson?: string;
  syncEnabled?: boolean;
  syncVersion?: number;
  lastSyncedAt?: string;
}

/**
 * Export all spiral nodes from the engine as a JSON string.
 */
export function exportBrainNodes(engine: SyncableEngine): string {
  if (engine.getFullExport) {
    const exp = engine.getFullExport();
    return JSON.stringify(exp.nodes);
  }
  if (engine.getAllNodes) {
    return JSON.stringify(engine.getAllNodes());
  }
  return '[]';
}

/**
 * Import spiral nodes from a JSON string into the engine.
 * Mode: 'replace' clears existing nodes, 'merge' adds new ones.
 */
export async function importBrainNodes(
  engine: SyncableEngine,
  nodesJson: string,
  mode: 'replace' | 'merge' = 'replace',
): Promise<number> {
  const nodes = JSON.parse(nodesJson);
  if (!Array.isArray(nodes)) throw new Error('Invalid nodesJson: expected array');

  if (mode === 'replace' && engine.clearAllNodes) {
    engine.clearAllNodes();
  }

  let imported = 0;
  for (const node of nodes) {
    if (engine.importNode) {
      engine.importNode(node);
      imported++;
    }
  }
  return imported;
}

/**
 * Push brain snapshot to web platform via REST API.
 */
export async function pushSync(
  brainId: string,
  version: number,
  nodesJson: string,
  apiUrl: string,
  apiKey: string,
): Promise<SyncResult> {
  try {
    const metadata = {
      nodeCount: (JSON.parse(nodesJson) as unknown[]).length,
      syncedAt: Date.now(),
    };

    const res = await fetch(`${apiUrl}/api/brain/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ brainId, version, nodesJson, metadata }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: res.statusText }))) as SyncResponse;
      return { success: false, error: err.error || `HTTP ${res.status}` };
    }

    const data = (await res.json()) as SyncResponse;
    return { success: true, version: data.version, sizeBytes: data.sizeBytes };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync push failed',
    };
  }
}

/**
 * Pull latest brain snapshot from web platform.
 */
export async function pullSync(
  brainId: string,
  apiUrl: string,
  apiKey: string,
): Promise<{ success: boolean; nodesJson?: string; version?: number; error?: string }> {
  try {
    const res = await fetch(`${apiUrl}/api/brain/sync/pull/${brainId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: res.statusText }))) as SyncResponse;
      return { success: false, error: err.error || `HTTP ${res.status}` };
    }

    const data = (await res.json()) as SyncResponse;
    return { success: true, nodesJson: data.nodesJson, version: data.version };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync pull failed',
    };
  }
}

/**
 * Get sync status for a brain.
 */
export async function getSyncStatus(
  brainId: string,
  apiUrl: string,
  apiKey: string,
): Promise<SyncStatus> {
  try {
    const res = await fetch(`${apiUrl}/api/brain/sync/status/${brainId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return { synced: false, version: 0, lastSyncedAt: null };
    }

    const data = (await res.json()) as SyncResponse;
    return {
      synced: !!data.syncEnabled,
      version: data.syncVersion || 0,
      lastSyncedAt: data.lastSyncedAt ? new Date(data.lastSyncedAt).getTime() : null,
    };
  } catch {
    return { synced: false, version: 0, lastSyncedAt: null };
  }
}
