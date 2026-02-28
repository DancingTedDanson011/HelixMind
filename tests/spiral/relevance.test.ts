import { describe, it, expect } from 'vitest';
import {
  computeRelevance,
  computeRecency,
  computeConnectionScore,
  computeTypeBoost,
  determineLevel,
} from '../../src/spiral/relevance.js';
import type { ContextNode } from '../../src/types.js';

function makeNode(overrides: Partial<ContextNode> = {}): ContextNode {
  return {
    id: 'test-id',
    type: 'code',
    content: 'test content',
    summary: null,
    level: 1,
    relevance_score: 1.0,
    token_count: 10,
    metadata: {},
    created_at: Date.now(),
    updated_at: Date.now(),
    accessed_at: Date.now(),
    ...overrides,
  };
}

describe('computeRecency', () => {
  it('should return 1.0 for just-accessed nodes', () => {
    const now = Date.now();
    expect(computeRecency(now, now)).toBeCloseTo(1.0, 2);
  });

  it('should return ~0.5 after ~14 hours (half-life)', () => {
    const now = Date.now();
    const fourteenHoursAgo = now - 14 * 60 * 60 * 1000;
    const score = computeRecency(fourteenHoursAgo, now);
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(0.6);
  });

  it('should approach 0 for very old nodes', () => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    expect(computeRecency(weekAgo, now)).toBeLessThan(0.01);
  });
});

describe('computeConnectionScore', () => {
  it('should return 0 for no connections', () => {
    expect(computeConnectionScore(0)).toBe(0);
  });

  it('should return 1.0 for 5 or more connections', () => {
    expect(computeConnectionScore(5)).toBe(1.0);
    expect(computeConnectionScore(10)).toBe(1.0);
  });

  it('should scale linearly', () => {
    expect(computeConnectionScore(1)).toBeCloseTo(0.2);
    expect(computeConnectionScore(3)).toBeCloseTo(0.6);
  });
});

describe('computeTypeBoost', () => {
  it('should boost error nodes for error queries', () => {
    expect(computeTypeBoost('error', 'I got a TypeError in my code')).toBe(1.0);
  });

  it('should boost architecture nodes for architecture queries', () => {
    expect(computeTypeBoost('architecture', 'What was the design decision?')).toBe(1.0);
    expect(computeTypeBoost('decision', 'architecture pattern')).toBe(1.0);
  });

  it('should boost code nodes for code queries', () => {
    expect(computeTypeBoost('code', 'implement the function')).toBe(1.0);
  });

  it('should return 0 for non-matching types', () => {
    expect(computeTypeBoost('code', 'what is the error?')).toBe(0.0);
    expect(computeTypeBoost('error', 'show me the function')).toBe(0.0);
  });
});

describe('computeRelevance', () => {
  it('should weight all components', () => {
    const node = makeNode({ accessed_at: Date.now() });
    const score = computeRelevance(1.0, node, 5, 'code function');
    // 1.0 * 0.4 + ~1.0 * 0.3 + 1.0 * 0.2 + 1.0 * 0.1 = ~1.0
    expect(score).toBeGreaterThan(0.9);
  });

  it('should return low score for old, unconnected, non-matching nodes', () => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const node = makeNode({ type: 'pattern', accessed_at: weekAgo });
    const score = computeRelevance(0.1, node, 0, 'error');
    expect(score).toBeLessThan(0.1);
  });
});

describe('determineLevel', () => {
  it('should assign Level 1 (Focus) for high relevance', () => {
    expect(determineLevel(0.8)).toBe(1);
    expect(determineLevel(0.7)).toBe(1);
  });

  it('should assign Level 2 (Active) for medium-high relevance', () => {
    expect(determineLevel(0.6)).toBe(2);
    expect(determineLevel(0.5)).toBe(2);
  });

  it('should assign Level 3 (Reference) for medium relevance', () => {
    expect(determineLevel(0.4)).toBe(3);
    expect(determineLevel(0.3)).toBe(3);
  });

  it('should assign Level 4 (Archive) for low relevance', () => {
    expect(determineLevel(0.2)).toBe(4);
    expect(determineLevel(0.1)).toBe(4);
  });

  it('should assign Level 5 (Deep Archive) for very low relevance', () => {
    expect(determineLevel(0.09)).toBe(5);
    expect(determineLevel(0.0)).toBe(5);
  });
});
