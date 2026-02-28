import { z } from 'zod';
import type { SpiralEngine } from '../spiral/engine.js';
import type { RelationType } from '../types.js';

export const spiralRelateSchema = {
  source_id: z.string().describe('Source node ID'),
  target_id: z.string().describe('Target node ID'),
  type: z.enum(['depends_on', 'related_to', 'caused_by', 'fixes', 'supersedes', 'part_of']).describe('Relation type'),
  weight: z.number().min(0).max(1).optional().describe('Relation strength (0.0–1.0, default: 1.0)'),
};

export async function handleSpiralRelate(
  engine: SpiralEngine,
  args: {
    source_id: string;
    target_id: string;
    type: RelationType;
    weight?: number;
  },
) {
  const edge = engine.relate(args.source_id, args.target_id, args.type, args.weight);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        edge_id: edge.id,
        source_id: edge.source_id,
        target_id: edge.target_id,
      }, null, 2),
    }],
  };
}
