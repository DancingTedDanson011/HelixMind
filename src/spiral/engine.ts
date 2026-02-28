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
   * Start the engine. Loads embedding model eagerly.
   */
  async initialize(): Promise<void> {
    await this.embeddings.initialize();
    logger.info('SpiralEngine initialized');
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
   */
  async store(
    content: string,
    type: ContextType,
    metadata?: NodeMetadata,
    relations?: string[],
  ): Promise<SpiralStoreResult> {
    // Create the node
    const node = this.nodes.create({
      type,
      content,
      metadata: metadata ?? {},
    });

    // Generate and store embedding
    const embedding = await this.embeddings.embed(content);
    if (embedding) {
      this.vectors.store(node.id, embedding);
    }

    // Create explicit relations
    let connectionCount = 0;
    if (relations) {
      for (const targetId of relations) {
        const target = this.nodes.getById(targetId);
        if (target) {
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
        if (result.distance < 0.3) { // Very similar
          try {
            this.edges.create({
              source_id: node.id,
              target_id: result.node_id,
              relation_type: 'related_to',
              weight: 1 - result.distance,
            });
            connectionCount++;
          } catch {
            // Duplicate edge, ignore
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
    const allEdges: Edge[] = [];

    // Collect all edges
    const seenEdgeIds = new Set<string>();
    for (const node of allNodes) {
      const edges = this.edges.getConnected(node.id);
      for (const edge of edges) {
        if (!seenEdgeIds.has(edge.id)) {
          seenEdgeIds.add(edge.id);
          allEdges.push(edge);
        }
      }
    }

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
            await this.store(msg.content, 'code', {
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
   */
  importNode(input: {
    type: ContextType;
    content: string;
    level?: SpiralLevel;
    relevanceScore?: number;
    metadata?: NodeMetadata;
  }): SpiralStoreResult {
    const node = this.nodes.create({
      type: input.type,
      content: input.content,
      metadata: input.metadata ?? {},
      level: input.level,
      relevance_score: input.relevanceScore,
    });

    return {
      node_id: node.id,
      level: node.level,
      connections: 0,
      token_count: node.token_count,
    };
  }

  /**
   * Clear all nodes and edges (for ZIP replace import).
   */
  clearAll(): void {
    this.db.raw.exec('DELETE FROM edges');
    this.db.raw.exec('DELETE FROM vec_nodes');
    this.db.raw.exec('DELETE FROM nodes');
  }

  /**
   * Shutdown: close database.
   */
  close(): void {
    this.db.close();
  }
}

function buildNodeLabel(node: import('../types.js').ContextNode): string {
  if (node.metadata.file) return node.metadata.file as string;
  const firstLine = node.content.split('\n')[0];
  return firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine;
}
