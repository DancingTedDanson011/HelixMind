import { z } from 'zod';
import type { SpiralEngine } from '../spiral/engine.js';

export const spiralCompactSchema = {
  aggressive: z.boolean().optional().describe('If true, more aggressive compaction thresholds'),
};

export async function handleSpiralCompact(
  engine: SpiralEngine,
  args: { aggressive?: boolean },
) {
  const result = engine.compact(args.aggressive ?? false);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(result, null, 2),
    }],
  };
}
