import type {
  ContextType,
  NodeMetadata,
  RelationType,
  SpiralLevel,
  SpiralConfig,
  SpiralQueryResult,
  SpiralStoreResult,
  SpiralStatusResult,
  SpiralCompactResult,
  Edge,
} from '../types.js';
import { Database } from '../storage/database.js';
import { NodeStore } from '../storage/nodes.js';
import { EdgeStore } from '../storage/edges.js';
import { VectorStore } from '../storage/vectors.js';
import { EmbeddingService } from './embeddings.js';
import { InjectionEngine } from './injection.js';
import { CompressionService, type EvolutionResult } from './compression.js';
import { logger } from '../utils/logger.js';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Core engine that orchestrates all spiral operations.
 */
export class SpiralEngine {
  private db: Database;
  private nodes: NodeStore;
  private edges: EdgeStore;
  private vectors: VectorStore;
  private embeddings: EmbeddingService;
  private injection: InjectionEngine;
  private compression: CompressionService;
  private config: SpiralConfig;

  constructor(config: SpiralConfig) {
    this.config = config;

    // Initialize storage
    this.db = new Database(config.dataDir);
    this.nodes = new NodeStore(this.db);
    this.edges = new EdgeStore(this.db);
    this.vectors = new VectorStore(this.db, config.embeddingDimensions);

    // Initialize spiral logic
    this.embeddings = new EmbeddingService(config.model);
    this.injection = new InjectionEngine(this.nodes, this.edges, this.vectors);
    this.compression = new CompressionService(
      this.nodes,
      this.vectors,
      config.levelThresholds.l1Min,
      config.levelThresholds.l2Min,
      config.levelThresholds.l3Min,
      config.levelThresholds.l4Min,
    );
  }

  /**
   * Start the engine. Embedding model is now lazy-loaded on first query
   * instead of blocking startup (saves 2-5s).
   */
  async initialize(): Promise<void> {
    // Embeddings load lazily on first embed() call — no blocking here.
    // Start background preload without awaiting it.
    this.embeddings.initialize().catch(() => {});
    logger.info('SpiralEngine initialized (embeddings: lazy)');
  }

  /**
   * Query context across spiral levels.
   */
  async query(
    queryText: string,
    maxTokens?: number,
    levels?: number[],
  ): Promise<SpiralQueryResult> {
    const budget = maxTokens ?? this.config.maxTokens;
    const activeLevels = levels ?? [1, 2, 3, 4, 5];

    // Generate embedding for query
    const queryEmbedding = await this.embeddings.embed(queryText);

    // Assemble context from all levels
    return this.injection.assemble(queryEmbedding, queryText, budget, activeLevels);
  }

  /**
   * Store new context in the spiral.
   * Deduplicates by content hash — identical content is refreshed, not duplicated.
   * FIX: WIDE-SPIRAL-009 — added optional opts.level / opts.relevance_score to allow
   * callers (e.g. web enricher) to store content at a non-L1 level. Defaults preserve
   * existing behavior (level=1, relevance_score=1.0).
   */
  async store(
    content: string,
    type: ContextType,
    metadata?: NodeMetadata,
    relations?: string[],
    opts?: { level?: SpiralLevel; relevance_score?: number },
  ): Promise<SpiralStoreResult> {
    const meta = metadata ?? {};
    const contentHash = createHash('sha256').update(content).digest('hex');
    // FIX: WIDE-SPIRAL-009 — clamp level to [1,5] if provided
    const clampedLevel = opts?.level !== undefined
      ? (Math.max(1, Math.min(5, opts.level)) as SpiralLevel)
      : undefined;
    const relevanceScore = opts?.relevance_score !== undefined && Number.isFinite(opts.relevance_score)
      ? Math.max(0, Math.min(1, opts.relevance_score))
      : undefined;

    // FIX: WIDE-SPIRAL-012 — wrap dedup-check + create in a single transaction to
    // prevent two concurrent processes from inserting duplicate hashes between the
    // SELECT and the INSERT.
    const txnResult = this.db.raw.transaction((): {
      kind: 'dedup';
      result: SpiralStoreResult;
    } | {
      kind: 'created';
      nodeId: string;
      level: SpiralLevel;
      tokenCount: number;
    } => {
      // Dedup check: if identical content already exists, refresh it instead of creating a new node
      const existing = this.nodes.findByContentHash(contentHash);
      if (existing) {
        // Merge tags from new metadata into existing
        const existingMeta = existing.metadata;
        if (meta.tags && Array.isArray(meta.tags)) {
          const existingTags = Array.isArray(existingMeta.tags) ? existingMeta.tags as string[] : [];
          const merged = [...new Set([...existingTags, ...meta.tags as string[]])];
          existingMeta.tags = merged;
        }
        // Copy over any new metadata keys (except tags, already merged)
        for (const [key, val] of Object.entries(meta)) {
          if (key !== 'tags') existingMeta[key] = val;
        }

        this.nodes.refreshNode(existing.id, content, existingMeta, contentHash);
        logger.debug(`Dedup: refreshed existing node ${existing.id} (type: ${type})`);

        return {
          kind: 'dedup',
          result: {
            node_id: existing.id,
            level: existing.level,
            connections: 0,
            token_count: existing.token_count,
            deduplicated: true,
          },
        };
      }

      // Create the node with content hash
      const node = this.nodes.create({
        type,
        content,
        metadata: meta,
        content_hash: contentHash,
        level: clampedLevel,
        relevance_score: relevanceScore,
      });
      return { kind: 'created', nodeId: node.id, level: node.level, tokenCount: node.token_count };
    })();

    if (txnResult.kind === 'dedup') {
      return txnResult.result;
    }

    // Reconstruct minimal node info; the row was created inside the transaction.
    const node = {
      id: txnResult.nodeId,
      level: txnResult.level,
      token_count: txnResult.tokenCount,
    };

    // Generate and store embedding
    const embedding = await this.embeddings.embed(content);
    if (embedding) {
      this.vectors.store(node.id, embedding);
    }

    // Create explicit relations
    let connectionCount = 0;
    if (relations) {
      for (const targetId of relations) {
        if (this.nodes.exists(targetId)) {
          this.edges.create({
            source_id: node.id,
            target_id: targetId,
            relation_type: 'related_to',
          });
          connectionCount++;
        }
      }
    }

    // Auto-detect relations via similarity (if embeddings available)
    if (embedding) {
      const similar = this.vectors.search(embedding, 5);
      for (const result of similar) {
        if (result.node_id === node.id) continue;
        // FIX: WIDE-SPIRAL-008 — lowered threshold 0.3 -> 0.15 for more aggressive auto-edge creation
        if (result.distance < 0.15) {
          try {
            this.edges.create({
              source_id: node.id,
              target_id: result.node_id,
              relation_type: 'related_to',
              weight: 1 - result.distance,
            });
            connectionCount++;
          } catch (err) {
            // FIX: WIDE-SPIRAL-008 — only swallow unique-constraint errors, log everything else
            const errCode = (err as { code?: string })?.code;
            if (errCode !== 'SQLITE_CONSTRAINT_UNIQUE') {
              logger.warn(`Auto-edge creation failed (non-unique-constraint): ${String(err)}`);
            }
          }
        }
      }
    }

    logger.debug(`Stored node ${node.id} (type: ${type}, connections: ${connectionCount})`);

    return {
      node_id: node.id,
      level: node.level,
      connections: connectionCount,
      token_count: node.token_count,
    };
  }

  /**
   * Get spiral status metrics.
   */
  status(): SpiralStatusResult {
    const totalNodes = this.nodes.count();
    const perLevel = this.nodes.countByLevel();
    const totalEdges = this.edges.count();
    const { oldest, newest } = this.nodes.getOldestAndNewest();

    let storageSize = 0;
    try {
      const dbPath = join(this.config.dataDir, 'spiral.db');
      storageSize = statSync(dbPath).size;
    } catch {
      // File may not exist yet
    }

    return {
      total_nodes: totalNodes,
      per_level: perLevel,
      total_edges: totalEdges,
      storage_size_bytes: storageSize,
      oldest_node: oldest ? new Date(oldest).toISOString() : null,
      newest_node: newest ? new Date(newest).toISOString() : null,
      embedding_status: this.embeddings.status,
    };
  }

  /** Count web knowledge nodes (virtual L6) */
  webKnowledgeCount(): number {
    return this.nodes.countWebKnowledge();
  }

  /**
   * Run compaction.
   */
  compact(aggressive: boolean): SpiralCompactResult {
    return this.compression.compact(aggressive);
  }

  /**
   * Create a manual relation between two nodes.
   */
  relate(
    sourceId: string,
    targetId: string,
    type: RelationType,
    weight?: number,
  ): Edge {
    return this.edges.create({
      source_id: sourceId,
      target_id: targetId,
      relation_type: type,
      weight,
    });
  }

  /**
   * Export all data for visualization.
   */
  exportForVisualization(): {
    nodes: Array<{
      id: string;
      label: string;
      content: string;
      type: string;
      level: SpiralLevel;
      relevanceScore: number;
      createdAt: string;
      lastAccessed: string;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: string;
      weight: number;
    }>;
  } {
    const allNodes = this.nodes.getAll();

    // Fetch all edges in a single query instead of N+1 per-node queries
    const allEdgeRows = this.db.raw.prepare('SELECT * FROM edges').all() as Array<{
      id: string; source_id: string; target_id: string;
      relation_type: string; weight: number; metadata: string; created_at: number;
    }>;
    const allEdges: Edge[] = allEdgeRows.map(row => ({
      id: row.id,
      source_id: row.source_id,
      target_id: row.target_id,
      relation_type: row.relation_type as Edge['relation_type'],
      weight: row.weight,
      metadata: JSON.parse(row.metadata || '{}'),
      created_at: row.created_at,
    }));

    return {
      nodes: allNodes.map(n => ({
        id: n.id,
        label: buildNodeLabel(n),
        content: (n.summary ?? n.content).slice(0, 200),
        type: n.type,
        level: n.level,
        relevanceScore: n.relevance_score,
        createdAt: new Date(n.created_at).toISOString(),
        lastAccessed: new Date(n.accessed_at).toISOString(),
      })),
      edges: allEdges.map(e => ({
        source: e.source_id,
        target: e.target_id,
        type: e.relation_type,
        weight: e.weight,
      })),
    };
  }

  /**
   * Run evolution: promote/demote nodes based on relevance scores.
   * Preserves all nodes — nothing is deleted.
   */
  evolve(): EvolutionResult {
    return this.compression.evolve();
  }

  /**
   * Save state: persist conversation context and trigger evolution if needed.
   * Called on graceful shutdown.
   */
  async saveState(conversationMessages?: Array<{ role: string; content: string }>): Promise<void> {
    // Archive only NEW conversation messages as L1 nodes.
    // Track the last saved index to avoid duplicates across sessions.
    if (conversationMessages && conversationMessages.length > 0) {
      // Only store the last few messages (avoid re-storing entire history)
      const maxNewMessages = 10;
      const startIdx = Math.max(0, conversationMessages.length - maxNewMessages);
      const newMessages = conversationMessages.slice(startIdx);

      for (const msg of newMessages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          try {
            // FIX: WIDE-SPIRAL-001 — redact secrets before storing conversation content in spiral
            const safeContent = redactSecrets(msg.content);
            await this.store(safeContent, 'code', {
              tags: ['conversation', msg.role],
            });
          } catch {
            // Skip on error
          }
        }
      }
    }

    // Trigger evolution
    this.compression.evolve();

    logger.info('State saved and evolution triggered');
  }

  /**
   * Import a node directly (for ZIP import). Returns store result.
   * Uses content hash for deduplication.
   */
  async importNode(input: {
    type: ContextType;
    content: string;
    level?: SpiralLevel;
    relevanceScore?: number;
    metadata?: NodeMetadata;
  }): Promise<SpiralStoreResult> {
    const contentHash = createHash('sha256').update(input.content).digest('hex');

    // Dedup: skip if identical content already exists
    const existing = this.nodes.findByContentHash(contentHash);
    if (existing) {
      return {
        node_id: existing.id,
        level: existing.level,
        connections: 0,
        token_count: existing.token_count,
        deduplicated: true,
      };
    }

    const node = this.nodes.create({
      type: input.type,
      content: input.content,
      metadata: input.metadata ?? {},
      level: input.level,
      relevance_score: input.relevanceScore,
      content_hash: contentHash,
    });

    // Generate and store embedding so imported nodes are findable via semantic search
    const embedding = await this.embeddings.embed(input.content);
    if (embedding) {
      this.vectors.store(node.id, embedding);
    }

    return {
      node_id: node.id,
      level: node.level,
      connections: 0,
      token_count: node.token_count,
    };
  }

  /**
   * Clear all nodes and edges (for ZIP replace import).
   * Handles both sqlite-vec (vec_nodes) and JS fallback (embeddings) tables.
   */
  clearAll(): void {
    // Wrap in transaction to ensure atomicity — partial delete would corrupt the brain
    this.db.raw.transaction(() => {
      this.db.raw.exec('DELETE FROM edges');
      try { this.db.raw.exec('DELETE FROM vec_nodes'); } catch { /* sqlite-vec table may not exist */ }
      try { this.db.raw.exec('DELETE FROM embeddings'); } catch { /* fallback table may not exist */ }
      this.db.raw.exec('DELETE FROM nodes');
    })();
  }

  /**
   * Shutdown: dispose embedding model and close database.
   */
  async close(): Promise<void> {
    await this.embeddings.dispose();
    this.db.close();
  }
}

function buildNodeLabel(node: import('../types.js').ContextNode): string {
  if (node.metadata.file) return node.metadata.file as string;
  const firstLine = node.content.split('\n')[0];
  return firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine;
}

// FIX: WIDE-SPIRAL-001 — redact common secret patterns before persisting content to spiral
function redactSecrets(text: string): string {
  return text
    .replace(/\b(sk-[A-Za-z0-9_\-]{20,})/g, '[REDACTED_API_KEY]')
    .replace(/\b(xoxb-[A-Za-z0-9\-]+)/g, '[REDACTED_SLACK_TOKEN]')
    .replace(/\b(ghp_[A-Za-z0-9]{36,})/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\b(Bearer\s+[A-Za-z0-9_\-\.]{20,})/gi, 'Bearer [REDACTED]')
    .replace(/\b(AKIA[0-9A-Z]{16})/g, '[REDACTED_AWS_KEY]')
    .replace(/-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END \1?PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/\b(eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,})\b/g, '[REDACTED_JWT]');
}
