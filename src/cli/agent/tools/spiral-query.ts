import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'spiral_query',
    description: 'Query the spiral memory for relevant context about a topic. Returns knowledge from all 5 levels (Focus, Active, Reference, Archive, Deep Archive). Use this when you need background information about the project, past decisions, or related context.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for in the spiral memory' },
        levels: {
          type: 'array',
          items: { type: 'number' },
          description: 'Which levels to query (default: all 5)',
        },
        max_results: { type: 'number', description: 'Maximum results per level (default: 10)' },
      },
      required: ['query'],
    },
  },

  async execute(input, ctx) {
    if (!ctx.spiralEngine) {
      return 'Spiral engine is not available.';
    }

    try {
      const query = input.query as string;
      const levels = (input.levels as number[]) ?? [1, 2, 3, 4, 5];

      const result = await ctx.spiralEngine.query(query, undefined, levels);
      const parts: string[] = [];

      const levelNames = ['', 'Focus', 'Active', 'Reference', 'Archive', 'Deep Archive'];

      for (const level of [1, 2, 3, 4, 5] as const) {
        const key = `level_${level}` as keyof typeof result;
        const nodes = result[key];
        if (nodes && nodes.length > 0) {
          parts.push(`\n=== L${level} ${levelNames[level]} (${nodes.length} nodes) ===`);
          for (const node of nodes) {
            const relevance = node.relevance.toFixed(2);
            const preview = node.content.slice(0, 120).replace(/\n/g, ' ');
            parts.push(`  [${node.type}] ${relevance}  ${preview}`);
          }
        }
      }

      if (parts.length === 0) {
        return `No spiral context found for: "${query}"`;
      }

      return `Spiral query results for "${query}":\n${parts.join('\n')}\n\nTotal: ${result.node_count} nodes, ${result.total_tokens} tokens`;
    } catch (err) {
      return `Spiral query error: ${err}`;
    }
  },
});
