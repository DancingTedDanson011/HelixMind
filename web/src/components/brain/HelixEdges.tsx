'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { DemoNode, DemoEdge } from './brain-demo-data';
import { computeNodePositions } from './HelixNodes';

interface HelixEdgesProps {
  nodes: DemoNode[];
  edges: DemoEdge[];
}

const EDGE_COLORS: Record<string, string> = {
  imports: '#00ff88',
  calls: '#ffdd00',
  depends_on: '#ffdd00',
  related_to: '#4488ff',
  similar_to: '#4488ff',
  implements: '#00d4ff',
  supersedes: '#8a2be2',
  part_of: '#00d4ff',
  fixes: '#ff4444',
};

export function HelixEdges({ nodes, edges }: HelixEdgesProps) {
  const positions = useMemo(() => computeNodePositions(nodes), [nodes]);

  const nodeIdxMap = useMemo(() => {
    const map: Record<string, number> = {};
    nodes.forEach((n, i) => { map[n.id] = i; });
    return map;
  }, [nodes]);

  // Single batched geometry for all edges — 1 draw call
  const { linePositions, lineColors } = useMemo(() => {
    const validEdges: Array<{ si: number; ti: number; color: string }> = [];
    for (const edge of edges) {
      const si = nodeIdxMap[edge.source];
      const ti = nodeIdxMap[edge.target];
      if (si !== undefined && ti !== undefined) {
        validEdges.push({ si, ti, color: EDGE_COLORS[edge.type] || '#4488ff' });
      }
    }

    const posArr = new Float32Array(validEdges.length * 6); // 2 vertices * 3 coords
    const colArr = new Float32Array(validEdges.length * 6); // 2 vertices * 3 color channels
    const tmpColor = new THREE.Color();

    for (let i = 0; i < validEdges.length; i++) {
      const { si, ti, color } = validEdges[i];
      const start = positions[si];
      const end = positions[ti];
      const offset = i * 6;

      posArr[offset] = start.x;
      posArr[offset + 1] = start.y;
      posArr[offset + 2] = start.z;
      posArr[offset + 3] = end.x;
      posArr[offset + 4] = end.y;
      posArr[offset + 5] = end.z;

      tmpColor.set(color);
      colArr[offset] = tmpColor.r;
      colArr[offset + 1] = tmpColor.g;
      colArr[offset + 2] = tmpColor.b;
      colArr[offset + 3] = tmpColor.r;
      colArr[offset + 4] = tmpColor.g;
      colArr[offset + 5] = tmpColor.b;
    }

    return { linePositions: posArr, lineColors: colArr };
  }, [edges, nodeIdxMap, positions]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        <bufferAttribute attach="attributes-color" args={[lineColors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.3} />
    </lineSegments>
  );
}
