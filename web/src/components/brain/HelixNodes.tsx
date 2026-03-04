'use client';

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { DemoNode } from './brain-types';
import { LEVEL_SIZES } from '@/lib/constants';

interface HelixNodesProps {
  positions: THREE.Vector3[];
  nodes: DemoNode[];
  nodeColors: Float32Array;
}

// ─── Glow shader materials (match CLI brain template) ───

const nodeVertexShader = /* glsl */`
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vC;
  void main() {
    vC = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (1200.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const nodeFragmentShader = /* glsl */`
  varying vec3 vC;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float i = exp(-d * d * 50.0) * 0.9 + exp(-d * d * 8.0) * 0.4 + exp(-d * d * 2.5) * 0.15;
    float core = exp(-d * d * 50.0);
    gl_FragColor = vec4(vC * (1.0 + core * 2.0), i);
  }
`;

export function HelixNodes({ positions, nodes, nodeColors }: HelixNodesProps) {
  const { posArray, sizeArray } = useMemo(() => {
    const nC = nodes.length;
    const posArr = new Float32Array(nC * 3);
    const szArr = new Float32Array(nC);

    for (let i = 0; i < nC; i++) {
      const p = positions[i];
      posArr[i * 3] = p.x;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = p.z;
      szArr[i] = LEVEL_SIZES[nodes[i].level as keyof typeof LEVEL_SIZES] || 36;
    }

    return { posArray: posArr, sizeArray: szArr };
  }, [nodes, positions]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: nodeVertexShader,
    fragmentShader: nodeFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  useEffect(() => () => { material.dispose(); }, [material]);

  return (
    <points material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posArray, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[nodeColors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizeArray, 1]} />
      </bufferGeometry>
    </points>
  );
}
