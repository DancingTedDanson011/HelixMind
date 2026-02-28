import { z } from 'zod';
import type { SpiralEngine } from '../spiral/engine.js';
import type { ContextType } from '../types.js';

export const spiralStoreSchema = {
  content: z.string().describe('The context content to store'),
  type: z.enum(['code', 'decision', 'error', 'pattern', 'architecture']).describe('Type of context'),
  metadata: z.object({
    file: z.string().optional(),
    function: z.string().optional(),
    language: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional().describe('Optional metadata'),
  relations: z.array(z.string()).optional().describe('IDs of related context nodes'),
};

export async function handleSpiralStore(
  engine: SpiralEngine,
  args: {
    content: string;
    type: ContextType;
    metadata?: { file?: string; function?: string; language?: string; tags?: string[] };
    relations?: string[];
  },
) {
  const result = await engine.store(args.content, args.type, args.metadata, args.relations);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(result, null, 2),
    }],
  };
}
