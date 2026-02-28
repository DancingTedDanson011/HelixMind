/**
 * Estimates token count for a string using a simple heuristic.
 * Average ratio: ~4 characters per token for English text/code.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Allocates token budget across 5 spiral levels.
 * L1 Focus: 25%, L2 Active: 20%, L3 Reference: 10%, L4 Archive: 3%, L5 Deep Archive: 2%, Reserved: 40%
 */
export function allocateTokenBudget(totalTokens: number): {
  level1: number;
  level2: number;
  level3: number;
  level4: number;
  level5: number;
} {
  return {
    level1: Math.floor(totalTokens * 0.25),
    level2: Math.floor(totalTokens * 0.20),
    level3: Math.floor(totalTokens * 0.10),
    level4: Math.floor(totalTokens * 0.03),
    level5: Math.floor(totalTokens * 0.02),
  };
}

/**
 * Truncates text to fit within a token budget, appending "..." if truncated.
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;

  const maxChars = maxTokens * 4 - 3; // reserve space for "..."
  return text.slice(0, Math.max(0, maxChars)) + '...';
}
