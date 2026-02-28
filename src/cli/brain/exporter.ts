import type { SpiralEngine } from '../../spiral/engine.js';
import type { BrainScope } from '../../utils/config.js';

export interface BrainExport {
  meta: {
    totalNodes: number;
    totalEdges: number;
    webKnowledgeCount: number;
    exportDate: string;
    projectName: string;
    brainScope: BrainScope;
  };
  nodes: Array<{
    id: string;
    label: string;
    content: string;
    type: string;
    level: 1 | 2 | 3 | 4 | 5 | 6;
    relevanceScore: number;
    createdAt: string;
    lastAccessed: string;
    /** Web knowledge source URL (only for L6 nodes) */
    webSource?: string;
    /** Web topic that was researched (only for L6 nodes) */
    webTopic?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    weight: number;
  }>;
}

export function exportBrainData(
  engine: SpiralEngine,
  projectName: string = 'HelixMind Project',
  brainScope: BrainScope = 'global',
): BrainExport {
  const data = engine.exportForVisualization();

  // Mark web knowledge nodes as L6 for visualization
  let webKnowledgeCount = 0;
  const nodes = data.nodes.map(node => {
    const tags: string[] = (node as any).type === 'pattern'
      ? [] // we check content instead
      : [];

    const isWebKnowledge = node.content.includes('[Web Knowledge:');

    if (isWebKnowledge) {
      webKnowledgeCount++;

      // Extract source URL and topic from content
      const sourceMatch = node.content.match(/Source:\s*(\S+)/);
      const topicMatch = node.content.match(/\[Web Knowledge:\s*([^\]]+)\]/);

      return {
        ...node,
        level: 6 as const,
        webSource: sourceMatch?.[1],
        webTopic: topicMatch?.[1],
      };
    }

    return node;
  });

  return {
    meta: {
      totalNodes: data.nodes.length,
      totalEdges: data.edges.length,
      webKnowledgeCount,
      exportDate: new Date().toISOString(),
      projectName,
      brainScope,
    },
    nodes,
    edges: data.edges,
  };
}
