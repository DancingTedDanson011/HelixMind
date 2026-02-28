import { z } from 'zod';
import type { SpiralEngine } from '../spiral/engine.js';

export const spiralQuerySchema = {
  query: z.string().describe('What context to search for'),
  max_tokens: z.number().optional().describe('Maximum tokens to return (default: 4000)'),
  levels: z.array(z.number().min(1).max(5)).optional().describe('Which levels to include (default: [1,2,3,4,5])'),
};

export async function handleSpiralQuery(
  engine: SpiralEngine,
  args: { query: string; max_tokens?: number; levels?: number[] },
) {
  const result = await engine.query(args.query, args.max_tokens, args.levels);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(result, null, 2),
    }],
  };
}
