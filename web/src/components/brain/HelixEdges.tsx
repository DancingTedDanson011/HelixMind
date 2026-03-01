'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { DemoNode, DemoEdge } from './brain-demo-data';
import { computeNodePositions } from './HelixNodes';
import { LEVEL_COLORS } from '@/lib/constants';

interface HelixEdgesProps {
  nodes: DemoNode[];
  edges: DemoEdge[];
}

export function HelixEdges({ nodes, edges }: HelixEdgesProps) {
  const positions = useMemo(() => computeNodePositions(nodes), [nodes]);

  const nodeIdxMap = useMemo(() => {
    const map: Record<string, number> = {};
    nodes.forEach((n, i) => { map[n.id] = i; });
    return map;
  }, [nodes]);

  // Single batched geometry — edge color derived from source node's level
  const { linePositions, lineColors } = useMemo(() => {
    const validEdges: Array<{ si: number; ti: number }> = [];
    for (const edge of edges) {
      const si = nodeIdxMap[edge.source];
      const ti = nodeIdxMap[edge.target];
      if (si !== undefined && ti !== undefined) {
        validEdges.push({ si, ti });
      }
    }

    const posArr = new Float32Array(validEdges.length * 6);
    const colArr = new Float32Array(validEdges.length * 6);
    const startColor = new THREE.Color();
    const endColor = new THREE.Color();

    for (let i = 0; i < validEdges.length; i++) {
      const { si, ti } = validEdges[i];
      const start = positions[si];
      const end = positions[ti];
      const offset = i * 6;

      posArr[offset] = start.x;
      posArr[offset + 1] = start.y;
      posArr[offset + 2] = start.z;
      posArr[offset + 3] = end.x;
      posArr[offset + 4] = end.y;
      posArr[offset + 5] = end.z;

      // Use each node's own level color — gradient from source to target
      const srcLevel = nodes[si].level as keyof typeof LEVEL_COLORS;
      const tgtLevel = nodes[ti].level as keyof typeof LEVEL_COLORS;
      startColor.set(LEVEL_COLORS[srcLevel] || 0x4488ff);
      endColor.set(LEVEL_COLORS[tgtLevel] || 0x4488ff);

      colArr[offset] = startColor.r;
      colArr[offset + 1] = startColor.g;
      colArr[offset + 2] = startColor.b;
      colArr[offset + 3] = endColor.r;
      colArr[offset + 4] = endColor.g;
      colArr[offset + 5] = endColor.b;
    }

    return { linePositions: posArr, lineColors: colArr };
  }, [edges, nodeIdxMap, positions, nodes]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        <bufferAttribute attach="attributes-color" args={[lineColors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.2} />
    </lineSegments>
  );
}
