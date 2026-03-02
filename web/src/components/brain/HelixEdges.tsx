'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { DemoNode, DemoEdge } from './brain-demo-data';
import { FORCE_LAYOUT } from '@/lib/constants';

interface HelixEdgesProps {
  nodes: DemoNode[];
  edges: DemoEdge[];
  positions: THREE.Vector3[];
  nodeColors: Float32Array;
}

// Edge shader — per-vertex alpha with additive blending (matches CLI template eMat)
const edgeVertexShader = /* glsl */`
  attribute vec3 color;
  attribute float aA;
  varying vec3 vC;
  varying float vA;
  void main() {
    vC = color;
    vA = aA;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const edgeFragmentShader = /* glsl */`
  varying vec3 vC;
  varying float vA;
  void main() {
    gl_FragColor = vec4(vC, vA);
  }
`;

export function HelixEdges({ nodes, edges, positions, nodeColors }: HelixEdgesProps) {
  const nodeIdxMap = useMemo(() => {
    const map: Record<string, number> = {};
    nodes.forEach((n, i) => { map[n.id] = i; });
    return map;
  }, [nodes]);

  const { linePositions, lineColors, lineAlphas, material } = useMemo(() => {
    const { MAX_E } = FORCE_LAYOUT;

    // Separate cross-level and same-level edges, prioritize cross-level
    const crossE: Array<{ si: number; ti: number; w: number; cross: boolean }> = [];
    const sameE: Array<{ si: number; ti: number; w: number; cross: boolean }> = [];

    for (const edge of edges) {
      const si = nodeIdxMap[edge.source];
      const ti = nodeIdxMap[edge.target];
      if (si !== undefined && ti !== undefined) {
        const cross = nodes[si].level !== nodes[ti].level;
        const obj = { si, ti, w: edge.weight, cross };
        if (cross) crossE.push(obj); else sameE.push(obj);
      }
    }

    crossE.sort((a, b) => b.w - a.w);
    sameE.sort((a, b) => b.w - a.w);

    const visEdges = [...crossE, ...sameE].slice(0, MAX_E);
    const eC = visEdges.length;

    const posArr = new Float32Array(eC * 6);
    const colArr = new Float32Array(eC * 6);
    const alphaArr = new Float32Array(eC * 2);
    const aS = Math.min(1.0, 2500 / eC);

    for (let i = 0; i < eC; i++) {
      const { si, ti, w, cross } = visEdges[i];
      const start = positions[si];
      const end = positions[ti];
      const offset = i * 6;

      posArr[offset] = start.x;
      posArr[offset + 1] = start.y;
      posArr[offset + 2] = start.z;
      posArr[offset + 3] = end.x;
      posArr[offset + 4] = end.y;
      posArr[offset + 5] = end.z;

      // Edge color from node colors
      colArr[offset] = nodeColors[si * 3];
      colArr[offset + 1] = nodeColors[si * 3 + 1];
      colArr[offset + 2] = nodeColors[si * 3 + 2];
      colArr[offset + 3] = nodeColors[ti * 3];
      colArr[offset + 4] = nodeColors[ti * 3 + 1];
      colArr[offset + 5] = nodeColors[ti * 3 + 2];

      // Cross-level edges get alpha boost
      const ba = cross ? (0.08 + w * 0.2) : (0.04 + w * 0.1);
      alphaArr[i * 2] = ba * aS;
      alphaArr[i * 2 + 1] = ba * aS;
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: edgeVertexShader,
      fragmentShader: edgeFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { linePositions: posArr, lineColors: colArr, lineAlphas: alphaArr, material: mat };
  }, [edges, nodeIdxMap, positions, nodes, nodeColors]);

  return (
    <lineSegments material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        <bufferAttribute attach="attributes-color" args={[lineColors, 3]} />
        <bufferAttribute attach="attributes-aA" args={[lineAlphas, 1]} />
      </bufferGeometry>
    </lineSegments>
  );
}
