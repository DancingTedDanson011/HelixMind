import type { ContextNode, ContextType, SpiralLevel } from '../types.js';

const ERROR_KEYWORDS = ['error', 'exception', 'bug', 'fail', 'crash', 'TypeError', 'ReferenceError', 'SyntaxError'];
const ARCH_KEYWORDS = ['architecture', 'design', 'decision', 'pattern', 'structure', 'refactor'];
const CODE_KEYWORDS = ['function', 'class', 'module', 'import', 'implement', 'code', 'method'];

/**
 * Per-level weights for relevance scoring.
 * Higher levels (Focus) weight semantic similarity more,
 * Lower levels (Archive) weight recency less.
 */
export const LEVEL_WEIGHTS: Record<SpiralLevel, { semantic: number; recency: number; connection: number; typeBoost: number }> = {
  1: { semantic: 0.45, recency: 0.30, connection: 0.15, typeBoost: 0.10 },
  2: { semantic: 0.40, recency: 0.25, connection: 0.20, typeBoost: 0.15 },
  3: { semantic: 0.35, recency: 0.20, connection: 0.25, typeBoost: 0.20 },
  4: { semantic: 0.30, recency: 0.15, connection: 0.30, typeBoost: 0.25 },
  5: { semantic: 0.25, recency: 0.10, connection: 0.35, typeBoost: 0.30 },
};

/**
 * Computes relevance score for a node given a query context.
 * Uses per-level weights for differentiated scoring.
 */
export function computeRelevance(
  semanticSimilarity: number,
  node: ContextNode,
  connectedInResult: number,
  query: string,
): number {
  const semantic = Math.max(0, Math.min(1, semanticSimilarity));
  const recency = computeRecency(node.accessed_at);
  const connection = computeConnectionScore(connectedInResult);
  const typeBoost = computeTypeBoost(node.type, query);

  const w = LEVEL_WEIGHTS[node.level] ?? LEVEL_WEIGHTS[1];
  return semantic * w.semantic + recency * w.recency + connection * w.connection + typeBoost * w.typeBoost;
}

/**
 * Recency score using exponential decay.
 * Half-life ~14 hours (λ = 0.05).
 */
export function computeRecency(accessedAt: number, now?: number): number {
  const currentTime = now ?? Date.now();
  const hoursSinceAccess = (currentTime - accessedAt) / (1000 * 60 * 60);
  return Math.exp(-0.05 * Math.max(0, hoursSinceAccess));
}

/**
 * Connection score: nodes connected to other relevant nodes get boosted.
 * Normalized to [0, 1] with saturation at 5 connections.
 */
export function computeConnectionScore(connectedNodesInResult: number): number {
  return Math.min(1.0, connectedNodesInResult / 5);
}

/**
 * Type boost: certain node types get boosted based on query keywords.
 */
export function computeTypeBoost(nodeType: ContextType, query: string): number {
  const lowerQuery = query.toLowerCase();

  if (nodeType === 'error' && ERROR_KEYWORDS.some(kw => lowerQuery.includes(kw.toLowerCase()))) {
    return 1.0;
  }
  if ((nodeType === 'architecture' || nodeType === 'decision') && ARCH_KEYWORDS.some(kw => lowerQuery.includes(kw))) {
    return 1.0;
  }
  if ((nodeType === 'code' || nodeType === 'pattern') && CODE_KEYWORDS.some(kw => lowerQuery.includes(kw))) {
    return 1.0;
  }
  return 0.0;
}

/**
 * Determines which spiral level a node should be on based on its relevance score.
 * L1 Focus >= l1Min, L2 Active >= l2Min, L3 Reference >= l3Min, L4 Archive >= l4Min, L5 Deep Archive < l4Min
 */
export function determineLevel(
  relevanceScore: number,
  l1Min = 0.7,
  l2Min = 0.5,
  l3Min = 0.3,
  l4Min = 0.1,
): SpiralLevel {
  if (relevanceScore >= l1Min) return 1;
  if (relevanceScore >= l2Min) return 2;
  if (relevanceScore >= l3Min) return 3;
  if (relevanceScore >= l4Min) return 4;
  return 5;
}
