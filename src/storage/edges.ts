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

function rowToEdge(row: EdgeRow): Edge {
  return {
    id: row.id,
    source_id: row.source_id,
    target_id: row.target_id,
    relation_type: row.relation_type as RelationType,
    weight: row.weight,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
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

  count(): number {
    const row = this.db.raw.prepare('SELECT COUNT(*) as cnt FROM edges').get() as { cnt: number };
    return row.cnt;
  }

  delete(id: string): void {
    this.db.raw.prepare('DELETE FROM edges WHERE id = ?').run(id);
  }
}
