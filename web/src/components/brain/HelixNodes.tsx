'use client';

import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import type { DemoNode } from './brain-demo-data';
import { LEVEL_COLORS, LEVEL_SIZES } from '@/lib/constants';

interface HelixNodesProps {
  positions: THREE.Vector3[];
  nodes: DemoNode[];
  spread: number;
}

function srand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
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

export function HelixNodes({ positions, nodes, spread }: HelixNodesProps) {
  const pointsRef = useRef<THREE.Points>(null!);

  // Compute centroid for distance-based fading
  const centroid = useMemo(() => {
    let cx = 0, cy = 0, cz = 0;
    for (const p of positions) { cx += p.x; cy += p.y; cz += p.z; }
    const n = positions.length || 1;
    return new THREE.Vector3(cx / n, cy / n, cz / n);
  }, [positions]);

  // Build buffer attributes
  const { posArray, colorArray, sizeArray } = useMemo(() => {
    const nC = nodes.length;
    const posArr = new Float32Array(nC * 3);
    const colArr = new Float32Array(nC * 3);
    const szArr = new Float32Array(nC);
    const tc = new THREE.Color();

    for (let i = 0; i < nC; i++) {
      const p = positions[i];
      posArr[i * 3] = p.x;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = p.z;

      const node = nodes[i];

      // Distance from centroid for fade effect
      const dx = p.x - centroid.x, dy = p.y - centroid.y, dz = p.z - centroid.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const maxD = spread * 1.2;
      const distRatio = Math.min(dist / maxD, 1);

      if (node.level === 1) {
        // L1 Focus: magenta/fuchsia range with subtle hue variation
        const h = 0.78 + srand(i * 137 + 42) * 0.1;
        const s = 0.7 + srand(i * 173) * 0.3;
        const l = 0.45 + srand(i * 211) * 0.2;
        tc.setHSL(h, s, l);
      } else {
        tc.set(LEVEL_COLORS[node.level as keyof typeof LEVEL_COLORS] || 0x00FFFF);
      }

      // Distant nodes fade to light blue/gray
      if (distRatio > 0.55) {
        const fade = Math.min((distRatio - 0.55) / 0.45, 1);
        const coolC = new THREE.Color().setHSL(0.58, 0.15 + 0.1 * (1 - fade), 0.65 + fade * 0.15);
        tc.lerp(coolC, fade * 0.85);
      }

      colArr[i * 3] = tc.r;
      colArr[i * 3 + 1] = tc.g;
      colArr[i * 3 + 2] = tc.b;

      szArr[i] = LEVEL_SIZES[node.level as keyof typeof LEVEL_SIZES] || 36;
    }

    return { posArray: posArr, colorArray: colArr, sizeArray: szArr };
  }, [nodes, positions, centroid, spread]);

  // Shader material
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: nodeVertexShader,
    fragmentShader: nodeFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  }), []);

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posArray, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colorArray, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizeArray, 1]} />
      </bufferGeometry>
    </points>
  );
}
