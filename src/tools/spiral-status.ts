import type { SpiralEngine } from '../spiral/engine.js';

export async function handleSpiralStatus(engine: SpiralEngine) {
  const result = engine.status();

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(result, null, 2),
    }],
  };
}
