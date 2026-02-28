import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SpiralEngine } from './spiral/engine.js';
import { spiralQuerySchema, handleSpiralQuery } from './tools/spiral-query.js';
import { spiralStoreSchema, handleSpiralStore } from './tools/spiral-store.js';
import { handleSpiralStatus } from './tools/spiral-status.js';
import { spiralCompactSchema, handleSpiralCompact } from './tools/spiral-compact.js';
import { spiralRelateSchema, handleSpiralRelate } from './tools/spiral-relate.js';
import type { SpiralConfig } from './types.js';

export function createServer(config: SpiralConfig): { server: McpServer; engine: SpiralEngine } {
  const engine = new SpiralEngine(config);

  const server = new McpServer(
    { name: 'spiral-context-mcp', version: '0.1.0' },
    { capabilities: { logging: {} } },
  );

  // Tool: spiral_context – Query context across spiral levels
  server.registerTool(
    'spiral_context',
    {
      title: 'Spiral Context',
      description: 'Query the spiral context store. Returns proactively assembled context across Focus (L1), Association (L2), and Periphery (L3) levels.',
      inputSchema: spiralQuerySchema,
    },
    async (args) => handleSpiralQuery(engine, args),
  );

  // Tool: spiral_store – Store new context
  server.registerTool(
    'spiral_store',
    {
      title: 'Spiral Store',
      description: 'Store new context in the spiral. Automatically generates embeddings, detects relations to existing context, and assigns the appropriate spiral level.',
      inputSchema: spiralStoreSchema,
    },
    async (args) => handleSpiralStore(engine, args),
  );

  // Tool: spiral_status – Get spiral metrics
  server.registerTool(
    'spiral_status',
    {
      title: 'Spiral Status',
      description: 'Show the current state of the spiral context store: node counts per level, edge counts, storage size, and embedding status.',
      inputSchema: {},
    },
    async () => handleSpiralStatus(engine),
  );

  // Tool: spiral_compact – Manual compaction
  server.registerTool(
    'spiral_compact',
    {
      title: 'Spiral Compact',
      description: 'Trigger manual compaction. Compresses old context nodes and optionally deletes very old ones in aggressive mode.',
      inputSchema: spiralCompactSchema,
    },
    async (args) => handleSpiralCompact(engine, args),
  );

  // Tool: spiral_relate – Create manual relations
  server.registerTool(
    'spiral_relate',
    {
      title: 'Spiral Relate',
      description: 'Manually create a relation between two context nodes. Relations are used to proactively inject associated context.',
      inputSchema: spiralRelateSchema,
    },
    async (args) => handleSpiralRelate(engine, args),
  );

  return { server, engine };
}
