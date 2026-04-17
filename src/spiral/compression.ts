import type { ContextNode, SpiralLevel } from '../types.js';
import { NodeStore } from '../storage/nodes.js';
import { VectorStore } from '../storage/vectors.js';
import { logger } from '../utils/logger.js';
import { estimateTokens } from '../utils/tokens.js';
import { determineLevel } from './relevance.js';

interface CompactionResult {
  compacted_nodes: number;
  freed_tokens: number;
  nodes_deleted: number;
}

export interface EvolutionResult {
  promoted: number;
  demoted: number;
  archived: number;
  summarized: number;
}

/**
 * Handles context evolution as nodes move through 5 spiral levels.
 * L1 Focus → L2 Active: relevance demotion, no content change
 * L2 Active → L3 Reference: content summarized
 * L3 Reference → L4 Archive: content heavily compressed
 * L4 Archive → L5 Deep Archive: only metadata + short summary kept
 * Archived nodes are NEVER deleted — they remain retrievable.
 */
export class CompressionService {
  private nodes: NodeStore;
  private vectors: VectorStore;
  private l1Min: number;
  private l2Min: number;
  private l3Min: number;
  private l4Min: number;

  constructor(nodes: NodeStore, vectors: VectorStore, l1Min = 0.7, l2Min = 0.5, l3Min = 0.3, l4Min = 0.1) {
    this.nodes = nodes;
    this.vectors = vectors;
    this.l1Min = l1Min;
    this.l2Min = l2Min;
    this.l3Min = l3Min;
    this.l4Min = l4Min;
  }

  /**
   * Apply time-based decay to all nodes and re-level them.
   */
  applyDecay(decayRate: number): number {
    const now = Date.now();
    const allNodes = this.nodes.getAll();
    const updates: Array<{ id: string; score: number; level: SpiralLevel }> = [];

    for (const node of allNodes) {
      const hoursSinceAccess = (now - node.accessed_at) / (1000 * 60 * 60);
      const decayFactor = Math.exp(-decayRate * hoursSinceAccess);
      const newScore = Math.max(0.01, node.relevance_score * decayFactor);
      const newLevel = determineLevel(newScore, this.l1Min, this.l2Min, this.l3Min, this.l4Min);

      if (newScore !== node.relevance_score || newLevel !== node.level) {
        updates.push({ id: node.id, score: newScore, level: newLevel });

        // Summarize when demoting to L3+
        if (newLevel >= 3 && node.level < 3 && !node.summary) {
          const summary = this.summarizeContent(node.content);
          this.nodes.updateSummary(node.id, summary);
          // FIX: WIDE-SPIRAL-014 — token_count now reflects summary, not original content.
          this.nodes.updateTokenCount(node.id, estimateTokens(summary));
        }

        // Deep compress when demoting to L4+
        if (newLevel >= 4 && node.level < 4 && node.summary) {
          const deepSummary = this.deepCompress(node.summary);
          this.nodes.updateSummary(node.id, deepSummary);
          // FIX: WIDE-SPIRAL-014 — refresh token_count after deep compression.
          this.nodes.updateTokenCount(node.id, estimateTokens(deepSummary));
        }
      }
    }

    if (updates.length > 0) {
      this.nodes.bulkUpdateRelevance(updates);
      logger.debug(`Decay applied to ${updates.length} nodes`);
    }

    return updates.length;
  }

  /**
   * Evolution: promote or demote nodes based on current relevance scores.
   * Unlike compaction, evolution preserves ALL nodes — nothing is deleted.
   */
  evolve(): EvolutionResult {
    let promoted = 0;
    let demoted = 0;
    let archived = 0;
    let summarized = 0;

    const allNodes = this.nodes.getAll();

    for (const node of allNodes) {
      const targetLevel = determineLevel(
        node.relevance_score, this.l1Min, this.l2Min, this.l3Min, this.l4Min,
      );

      if (targetLevel === node.level) continue;

      // Promotion (moving to a higher-priority level)
      if (targetLevel < node.level) {
        this.nodes.updateLevel(node.id, targetLevel);
        promoted++;
        continue;
      }

      // Demotion (moving to a lower-priority level)
      this.nodes.updateLevel(node.id, targetLevel);
      demoted++;

      // Summarize when entering L3 for the first time
      if (targetLevel >= 3 && node.level < 3 && !node.summary) {
        const summary = this.summarizeContent(node.content);
        this.nodes.updateSummary(node.id, summary);
        // FIX: WIDE-SPIRAL-014 — keep token_count aligned with the active (summary) text.
        this.nodes.updateTokenCount(node.id, estimateTokens(summary));
        summarized++;
      }

      // Deep compress when entering L4/L5
      if (targetLevel >= 4 && node.level < 4) {
        const text = node.summary ?? node.content;
        const deepSummary = this.deepCompress(text);
        this.nodes.updateSummary(node.id, deepSummary);
        // FIX: WIDE-SPIRAL-014 — keep token_count aligned with deep-compressed text.
        this.nodes.updateTokenCount(node.id, estimateTokens(deepSummary));
        archived++;
      }
    }

    logger.info(`Evolution: ${promoted} promoted, ${demoted} demoted, ${archived} archived, ${summarized} summarized`);
    return { promoted, demoted, archived, summarized };
  }

  /**
   * Manual compaction: compress and demote old nodes.
   * In 5-level system, aggressive mode pushes to L4/L5 instead of deleting.
   */
  compact(aggressive: boolean): CompactionResult {
    let compacted = 0;
    let freed = 0;
    let deleted = 0;

    const allNodes = this.nodes.getAll();

    for (const node of allNodes) {
      // Compress L2 Active nodes that are old
      if (node.level === 2 && !node.summary) {
        const hoursSince = (Date.now() - node.accessed_at) / (1000 * 60 * 60);
        if (hoursSince > 24 || aggressive) {
          const summary = this.summarizeContent(node.content);
          const oldTokens = node.token_count;
          const newTokens = estimateTokens(summary);
          freed += oldTokens - newTokens;

          this.nodes.updateSummary(node.id, summary);
          this.nodes.updateLevel(node.id, 3);
          // FIX: WIDE-SPIRAL-014 — persist updated token_count after summarization.
          this.nodes.updateTokenCount(node.id, newTokens);
          compacted++;
        }
      }

      // Compress L3 Reference nodes to L4 Archive
      if (node.level === 3) {
        const hoursSince = (Date.now() - node.accessed_at) / (1000 * 60 * 60);
        if (hoursSince > 72 || aggressive) {
          const text = node.summary ?? node.content;
          const deepSummary = this.deepCompress(text);
          const oldTokens = estimateTokens(text);
          const newTokens = estimateTokens(deepSummary);
          freed += oldTokens - newTokens;

          this.nodes.updateSummary(node.id, deepSummary);
          this.nodes.updateLevel(node.id, 4);
          // FIX: WIDE-SPIRAL-014 — persist updated token_count after deep compression.
          this.nodes.updateTokenCount(node.id, newTokens);
          compacted++;
        }
      }

      // In aggressive mode, push L4 to L5 (deep archive) — but NEVER delete
      if (aggressive && node.level === 4) {
        const hoursSince = (Date.now() - node.accessed_at) / (1000 * 60 * 60);
        if (hoursSince > 168) { // 7 days
          this.nodes.updateLevel(node.id, 5);
          compacted++;
        }
      }

      // Only delete L5 nodes in aggressive mode after 30 days
      if (aggressive && node.level === 5) {
        const hoursSince = (Date.now() - node.accessed_at) / (1000 * 60 * 60);
        if (hoursSince > 720) { // 30 days
          freed += node.token_count;
          this.vectors.delete(node.id);
          this.nodes.delete(node.id);
          deleted++;
        }
      }
    }

    logger.info(`Compaction: ${compacted} compressed, ${deleted} deleted, ${freed} tokens freed`);
    return { compacted_nodes: compacted, freed_tokens: freed, nodes_deleted: deleted };
  }

  /**
   * Simple content summarization: truncate to ~200 code-point chars.
   * FIX: WIDE-SPIRAL-014 — slice on code-point boundaries via spread, so surrogate
   * pairs (emoji, etc.) are not split mid-character producing mojibake.
   */
  summarizeContent(content: string): string {
    const codePoints = [...content];
    if (codePoints.length <= 200) return content;
    return codePoints.slice(0, 197).join('') + '...';
  }

  /**
   * Deep compression for archive levels: truncate to ~100 code-point chars.
   * FIX: WIDE-SPIRAL-014 — slice on code-point boundaries (see summarizeContent).
   */
  deepCompress(content: string): string {
    const codePoints = [...content];
    if (codePoints.length <= 100) return content;
    return codePoints.slice(0, 97).join('') + '...';
  }
}
