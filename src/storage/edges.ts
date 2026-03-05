import { randomUUID } from 'node:crypto';
import type { Database } from './database.js';
import type { Edge, RelationType } from '../types.js';

interface CreateEdgeInput {
  source_id: string;
  target_id: string;
  relation_type: RelationType;
  weight?: number;
  metadata?: Record<string, unknown>;
}

interface EdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  weight: number;
  metadata: string;
  created_at: number;
}

function safeParseJson(raw: string, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToEdge(row: EdgeRow): Edge {
  return {
    id: row.id,
    source_id: row.source_id,
    target_id: row.target_id,
    relation_type: row.relation_type as RelationType,
    weight: row.weight,
    metadata: safeParseJson(row.metadata),
    created_at: row.created_at,
  };
}

export class EdgeStore {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  create(input: CreateEdgeInput): Edge {
    const id = randomUUID();
    const now = Date.now();

    this.db.raw.prepare(`
      INSERT INTO edges (id, source_id, target_id, relation_type, weight, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.source_id,
      input.target_id,
      input.relation_type,
      input.weight ?? 1.0,
      JSON.stringify(input.metadata ?? {}),
      now,
    );

    return {
      id,
      source_id: input.source_id,
      target_id: input.target_id,
      relation_type: input.relation_type,
      weight: input.weight ?? 1.0,
      metadata: input.metadata ?? {},
      created_at: now,
    };
  }

  getBySource(sourceId: string): Edge[] {
    const rows = this.db.raw.prepare('SELECT * FROM edges WHERE source_id = ?').all(sourceId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  getByTarget(targetId: string): Edge[] {
    const rows = this.db.raw.prepare('SELECT * FROM edges WHERE target_id = ?').all(targetId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  getConnected(nodeId: string): Edge[] {
    const rows = this.db.raw.prepare('SELECT * FROM edges WHERE source_id = ? OR target_id = ?').all(nodeId, nodeId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  /**
   * Get all node IDs connected to a given node (1-hop neighbors).
   */
  getConnectedNodeIds(nodeId: string): string[] {
    const edges = this.getConnected(nodeId);
    const ids = new Set<string>();
    for (const edge of edges) {
      if (edge.source_id !== nodeId) ids.add(edge.source_id);
      if (edge.target_id !== nodeId) ids.add(edge.target_id);
    }
    return Array.from(ids);
  }

  /**
   * Batch-fetch connected node IDs for multiple nodes in a single SQL query.
   * Eliminates N+1 query pattern in the injection engine.
   */
  getConnectedNodeIdsForMany(nodeIds: string[]): Map<string, string[]> {
    if (nodeIds.length === 0) return new Map();
    const placeholders = nodeIds.map(() => '?').join(',');
    const rows = this.db.raw.prepare(
      `SELECT source_id, target_id FROM edges
       WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})`
    ).all(...nodeIds, ...nodeIds) as Array<{ source_id: string; target_id: string }>;

    const map = new Map<string, string[]>();
    for (const id of nodeIds) map.set(id, []);
    for (const row of rows) {
      if (map.has(row.source_id)) map.get(row.source_id)!.push(row.target_id);
      if (map.has(row.target_id)) map.get(row.target_id)!.push(row.source_id);
    }
    return map;
  }

  count(): number {
    const row = this.db.raw.prepare('SELECT COUNT(*) as cnt FROM edges').get() as { cnt: number };
    return row.cnt;
  }

  delete(id: string): void {
    this.db.raw.prepare('DELETE FROM edges WHERE id = ?').run(id);
  }
}
