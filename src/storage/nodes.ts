import { randomUUID } from 'node:crypto';
import type { Database } from './database.js';
import type { ContextNode, ContextType, SpiralLevel, NodeMetadata } from '../types.js';
import { estimateTokens } from '../utils/tokens.js';

interface CreateNodeInput {
  type: ContextType;
  content: string;
  metadata: NodeMetadata;
  summary?: string;
  level?: SpiralLevel;
  relevance_score?: number;
}

interface NodeRow {
  id: string;
  type: string;
  content: string;
  content_hash: string | null;
  summary: string | null;
  level: number;
  relevance_score: number;
  token_count: number;
  metadata: string;
  created_at: number;
  updated_at: number;
  accessed_at: number;
}

function rowToNode(row: NodeRow): ContextNode {
  return {
    id: row.id,
    type: row.type as ContextType,
    content: row.content,
    summary: row.summary,
    level: row.level as SpiralLevel,
    relevance_score: row.relevance_score,
    token_count: row.token_count,
    metadata: JSON.parse(row.metadata) as NodeMetadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
    accessed_at: row.accessed_at,
  };
}

export class NodeStore {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  create(input: CreateNodeInput & { content_hash?: string }): ContextNode {
    const id = randomUUID();
    const now = Date.now();
    const tokenCount = estimateTokens(input.content);

    this.db.raw.prepare(`
      INSERT INTO nodes (id, type, content, content_hash, summary, level, relevance_score, token_count, metadata, created_at, updated_at, accessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.type,
      input.content,
      input.content_hash ?? null,
      input.summary ?? null,
      input.level ?? 1,
      input.relevance_score ?? 1.0,
      tokenCount,
      JSON.stringify(input.metadata),
      now,
      now,
      now,
    );

    return {
      id,
      type: input.type,
      content: input.content,
      summary: input.summary ?? null,
      level: (input.level ?? 1) as SpiralLevel,
      relevance_score: input.relevance_score ?? 1.0,
      token_count: tokenCount,
      metadata: input.metadata,
      created_at: now,
      updated_at: now,
      accessed_at: now,
    };
  }

  /**
   * Find a node by its content hash (for deduplication).
   * Returns null if no matching node exists.
   */
  findByContentHash(hash: string): ContextNode | null {
    const row = this.db.raw.prepare(
      'SELECT * FROM nodes WHERE content_hash = ? LIMIT 1'
    ).get(hash) as NodeRow | undefined;
    return row ? rowToNode(row) : null;
  }

  /**
   * Update an existing node's content, metadata, and access time (for dedup refresh).
   */
  refreshNode(id: string, content: string, metadata: NodeMetadata, contentHash: string): void {
    const now = Date.now();
    const tokenCount = estimateTokens(content);
    this.db.raw.prepare(`
      UPDATE nodes SET content = ?, content_hash = ?, token_count = ?, metadata = ?, updated_at = ?, accessed_at = ?
      WHERE id = ?
    `).run(content, contentHash, tokenCount, JSON.stringify(metadata), now, now, id);
  }

  getById(id: string): ContextNode | null {
    const row = this.db.raw.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as NodeRow | undefined;
    if (!row) return null;

    // Update accessed_at
    const now = Date.now();
    this.db.raw.prepare('UPDATE nodes SET accessed_at = ? WHERE id = ?').run(now, id);

    return rowToNode({ ...row, accessed_at: now });
  }

  getByLevel(level: SpiralLevel): ContextNode[] {
    const rows = this.db.raw.prepare('SELECT * FROM nodes WHERE level = ? ORDER BY relevance_score DESC').all(level) as NodeRow[];
    return rows.map(rowToNode);
  }

  getAll(): ContextNode[] {
    const rows = this.db.raw.prepare('SELECT * FROM nodes ORDER BY relevance_score DESC').all() as NodeRow[];
    return rows.map(rowToNode);
  }

  getByIds(ids: string[]): ContextNode[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db.raw.prepare(`SELECT * FROM nodes WHERE id IN (${placeholders})`).all(...ids) as NodeRow[];
    return rows.map(rowToNode);
  }

  updateLevel(id: string, level: SpiralLevel): void {
    this.db.raw.prepare('UPDATE nodes SET level = ?, updated_at = ? WHERE id = ?').run(level, Date.now(), id);
  }

  updateRelevance(id: string, score: number): void {
    this.db.raw.prepare('UPDATE nodes SET relevance_score = ?, updated_at = ? WHERE id = ?').run(score, Date.now(), id);
  }

  updateSummary(id: string, summary: string): void {
    this.db.raw.prepare('UPDATE nodes SET summary = ?, updated_at = ? WHERE id = ?').run(summary, Date.now(), id);
  }

  count(): number {
    const row = this.db.raw.prepare('SELECT COUNT(*) as cnt FROM nodes').get() as { cnt: number };
    return row.cnt;
  }

  countByLevel(): Record<SpiralLevel, number> {
    const rows = this.db.raw.prepare('SELECT level, COUNT(*) as cnt FROM nodes GROUP BY level').all() as { level: number; cnt: number }[];
    const result: Record<SpiralLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of rows) {
      result[row.level as SpiralLevel] = row.cnt;
    }
    return result;
  }

  /** Count web knowledge nodes (L2 nodes with [Web Knowledge: prefix) */
  countWebKnowledge(): number {
    const row = this.db.raw.prepare("SELECT COUNT(*) as cnt FROM nodes WHERE content LIKE '[Web Knowledge:%'").get() as { cnt: number };
    return row.cnt;
  }

  getOldestAndNewest(): { oldest: number | null; newest: number | null } {
    const row = this.db.raw.prepare('SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM nodes').get() as { oldest: number | null; newest: number | null };
    return { oldest: row.oldest, newest: row.newest };
  }

  delete(id: string): void {
    this.db.raw.prepare('DELETE FROM nodes WHERE id = ?').run(id);
  }

  /**
   * Get nodes that need decay (accessed more than `hours` ago).
   */
  getStaleNodes(hoursThreshold: number): ContextNode[] {
    const cutoff = Date.now() - hoursThreshold * 60 * 60 * 1000;
    const rows = this.db.raw.prepare('SELECT * FROM nodes WHERE accessed_at < ? AND level < 5 ORDER BY accessed_at ASC').all(cutoff) as NodeRow[];
    return rows.map(rowToNode);
  }

  /**
   * Bulk update relevance scores. Used by decay function.
   */
  bulkUpdateRelevance(updates: Array<{ id: string; score: number; level: SpiralLevel }>): void {
    const stmt = this.db.raw.prepare('UPDATE nodes SET relevance_score = ?, level = ?, updated_at = ? WHERE id = ?');
    const now = Date.now();
    const transaction = this.db.raw.transaction((items: typeof updates) => {
      for (const item of items) {
        stmt.run(item.score, item.level, now, item.id);
      }
    });
    transaction(updates);
  }
}
