import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'spiral_store',
    description: 'Store an important insight, decision, or finding in the spiral memory. Use this when you discover something worth remembering across sessions — architectural decisions, bug patterns, important code relationships.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The insight or information to store' },
        type: {
          type: 'string',
          enum: ['code', 'decision', 'error', 'pattern', 'architecture'],
          description: 'Type of knowledge being stored',
        },
        relations: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of related spiral nodes to link to',
        },
      },
      required: ['content', 'type'],
    },
  },

  async execute(input, ctx) {
    if (!ctx.spiralEngine) {
      return 'Spiral engine is not available.';
    }

    try {
      const result = await ctx.spiralEngine.store(
        input.content as string,
        input.type as string,
        {},
        input.relations as string[] | undefined,
      );

      return `Stored in spiral:\n  Node ID: ${result.node_id}\n  Level: L${result.level}\n  Connections: ${result.connections}\n  Tokens: ${result.token_count}`;
    } catch (err) {
      return `Error storing in spiral: ${err}`;
    }
  },
});
