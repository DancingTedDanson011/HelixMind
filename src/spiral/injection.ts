import type { ContextNode, SpiralResultNode } from '../types.js';
import { NodeStore } from '../storage/nodes.js';
import { EdgeStore } from '../storage/edges.js';
import { VectorStore } from '../storage/vectors.js';
import { computeRelevance } from './relevance.js';
import { allocateTokenBudget, estimateTokens } from '../utils/tokens.js';
import { logger } from '../utils/logger.js';

interface InjectionResult {
  level_1: SpiralResultNode[];
  level_2: SpiralResultNode[];
  level_3: SpiralResultNode[];
  level_4: SpiralResultNode[];
  level_5: SpiralResultNode[];
  total_tokens: number;
  node_count: number;
}

/**
 * Proactive context injection engine.
 * Assembles the most relevant context across all 5 spiral levels.
 */
export class InjectionEngine {
  private nodes: NodeStore;
  private edges: EdgeStore;
  private vectors: VectorStore;

  constructor(nodes: NodeStore, edges: EdgeStore, vectors: VectorStore) {
    this.nodes = nodes;
    this.edges = edges;
    this.vectors = vectors;
  }

  /**
   * Build context for a query across all spiral levels.
   */
  async assemble(
    queryEmbedding: Float32Array | null,
    query: string,
    maxTokens: number,
    levels: number[],
  ): Promise<InjectionResult> {
    const budget = allocateTokenBudget(maxTokens);

    // Step 1: Find direct matches via semantic search
    let candidateIds: string[] = [];
    if (queryEmbedding) {
      const vecResults = this.vectors.search(queryEmbedding, 50);
      candidateIds = vecResults.map(r => r.node_id);
    }

    // If no embedding results, fall back to loading recent nodes
    if (candidateIds.length === 0) {
      const allNodes = this.nodes.getAll();
      candidateIds = allNodes.slice(0, 50).map(n => n.id);
    }

    // Step 2: Get full node data
    const candidates = this.nodes.getByIds(candidateIds);

    // Step 3: Score each candidate
    // Build similarity lookup ONCE (not per-candidate)
    const simMap = new Map<string, number>();
    if (queryEmbedding) {
      const vecResults = this.vectors.search(queryEmbedding, 50);
      for (const r of vecResults) {
        simMap.set(r.node_id, 1 - r.distance);
      }
    }

    const scored = candidates.map(node => {
      const semanticSim = simMap.get(node.id) ?? (queryEmbedding ? 0 : 0.5);

      const connectedIds = this.edges.getConnectedNodeIds(node.id);
      const connectedInResult = connectedIds.filter(id => candidateIds.includes(id)).length;

      const relevance = computeRelevance(semanticSim, node, connectedInResult, query);

      return { node, relevance };
    });

    // Sort by relevance descending
    scored.sort((a, b) => b.relevance - a.relevance);

    // Step 4: Assemble levels with token budgets
    const level1: SpiralResultNode[] = [];
    const level2: SpiralResultNode[] = [];
    const level3: SpiralResultNode[] = [];
    const level4: SpiralResultNode[] = [];
    const level5: SpiralResultNode[] = [];
    let level1Tokens = 0;
    let level2Tokens = 0;
    let level3Tokens = 0;
    let level4Tokens = 0;
    let level5Tokens = 0;

    // Dynamic budget: each level passes unused tokens to the next level.
    let surplus = 0;

    // Step 5: Fill Level 1 Focus (direct matches, highest relevance)
    const l1Budget = budget.level1;
    for (const { node, relevance } of scored) {
      if (!levels.includes(1)) break;
      if (relevance < 0.5) break;

      const content = node.content;
      const tokens = estimateTokens(content);
      if (level1Tokens + tokens > l1Budget) continue;

      level1.push({ id: node.id, type: node.type, content, relevance });
      level1Tokens += tokens;
    }
    surplus = l1Budget - level1Tokens;

    const usedIds = new Set(level1.map(n => n.id));

    // Step 6: Fill Level 2 Active (associated context, proactive injection)
    const l2Budget = budget.level2 + surplus;
    if (levels.includes(2)) {
      const neighborIds = new Set<string>();
      for (const l1Node of level1) {
        const connected = this.edges.getConnectedNodeIds(l1Node.id);
        for (const id of connected) {
          if (!usedIds.has(id)) neighborIds.add(id);
        }
      }

      const l2Candidates = scored
        .filter(s => !usedIds.has(s.node.id))
        .map(s => ({ ...s, isNeighbor: neighborIds.has(s.node.id) }));

      l2Candidates.sort((a, b) => {
        if (a.isNeighbor && !b.isNeighbor) return -1;
        if (!a.isNeighbor && b.isNeighbor) return 1;
        return b.relevance - a.relevance;
      });

      for (const { node, relevance } of l2Candidates) {
        if (relevance < 0.2) break;

        const content = node.summary ?? node.content;
        const tokens = estimateTokens(content);
        if (level2Tokens + tokens > l2Budget) continue;

        level2.push({ id: node.id, type: node.type, content, relevance });
        level2Tokens += tokens;
        usedIds.add(node.id);
      }
    }
    surplus = l2Budget - level2Tokens;

    // Step 7: Fill Level 3 Reference (proactively injected context)
    const l3Budget = budget.level3 + surplus;
    if (levels.includes(3)) {
      const l3Candidates = scored.filter(s => !usedIds.has(s.node.id));

      for (const { node, relevance } of l3Candidates) {
        if (relevance < 0.1) break;

        const content = node.summary ?? node.content.slice(0, 200);
        const tokens = estimateTokens(content);
        if (level3Tokens + tokens > l3Budget) continue;

        level3.push({ id: node.id, type: node.type, content, relevance });
        level3Tokens += tokens;
        usedIds.add(node.id);
      }
    }
    surplus = l3Budget - level3Tokens;

    // Step 8: Fill Level 4 Archive (compressed background context)
    const l4Budget = budget.level4 + surplus;
    if (levels.includes(4)) {
      const l4Candidates = scored.filter(s => !usedIds.has(s.node.id));

      for (const { node, relevance } of l4Candidates) {
        const content = node.summary ?? node.content.slice(0, 100);
        const tokens = estimateTokens(content);
        if (level4Tokens + tokens > l4Budget) continue;

        level4.push({ id: node.id, type: node.type, content, relevance });
        level4Tokens += tokens;
        usedIds.add(node.id);
      }
    }
    surplus = l4Budget - level4Tokens;

    // Step 9: Fill Level 5 Deep Archive (minimal references)
    const l5Budget = budget.level5 + surplus;
    if (levels.includes(5)) {
      const l5Candidates = scored.filter(s => !usedIds.has(s.node.id));

      for (const { node, relevance } of l5Candidates) {
        const content = node.summary ?? node.content.slice(0, 50);
        const tokens = estimateTokens(content);
        if (level5Tokens + tokens > l5Budget) continue;

        level5.push({ id: node.id, type: node.type, content, relevance });
        level5Tokens += tokens;
      }
    }

    const totalTokens = level1Tokens + level2Tokens + level3Tokens + level4Tokens + level5Tokens;
    const nodeCount = level1.length + level2.length + level3.length + level4.length + level5.length;

    logger.debug(`Injection: L1=${level1.length} L2=${level2.length} L3=${level3.length} L4=${level4.length} L5=${level5.length} tokens=${totalTokens}`);

    return {
      level_1: level1,
      level_2: level2,
      level_3: level3,
      level_4: level4,
      level_5: level5,
      total_tokens: totalTokens,
      node_count: nodeCount,
    };
  }
}
