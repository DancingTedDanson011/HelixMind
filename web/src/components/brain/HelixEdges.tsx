'use client';

import { useMemo } from 'react';
import { Line } from '@react-three/drei';
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

  const lines = useMemo(() => {
    return edges
      .map((edge) => {
        const si = nodeIdxMap[edge.source];
        const ti = nodeIdxMap[edge.target];
        if (si === undefined || ti === undefined) return null;

        const start = positions[si];
        const end = positions[ti];
        const color = EDGE_COLORS[edge.type] || '#4488ff';

        return { start, end, color, opacity: 0.15 + edge.weight * 0.25 };
      })
      .filter(Boolean) as Array<{ start: THREE.Vector3; end: THREE.Vector3; color: string; opacity: number }>;
  }, [edges, nodeIdxMap, positions]);

  return (
    <group>
      {lines.map((line, i) => (
        <Line
          key={i}
          points={[line.start, line.end]}
          color={line.color}
          lineWidth={0.5}
          transparent
          opacity={line.opacity}
        />
      ))}
    </group>
  );
}
