'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { DemoNode, DemoEdge } from './brain-demo-data';
import { FORCE_LAYOUT } from '@/lib/constants';

// ─── Constants ───────────────────────────────────────────────
const SIG_COUNT = 80;
const { MAX_E } = FORCE_LAYOUT;

// ─── Types ───────────────────────────────────────────────────
interface SignalParticlesProps {
  positions: THREE.Vector3[];
  nodes: DemoNode[];
  edges: DemoEdge[];
  nodeColors: Float32Array;
}

interface VisibleEdge {
  si: number;
  ti: number;
  weight: number;
  cross: boolean;
}

interface SignalDatum {
  edge: number;
  progress: number;
  speed: number;
  forward: boolean;
}

// ─── Signal particle shader (matches CLI brain sigMat) ──────
const sigVertexShader = /* glsl */`
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

const sigFragmentShader = /* glsl */`
  varying vec3 vC;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float glow = exp(-d * d * 20.0) + exp(-d * d * 5.0) * 0.4;
    gl_FragColor = vec4(vC * 2.0, glow * 0.9);
  }
`;

// ─── Component ───────────────────────────────────────────────
export function SignalParticles({ positions, nodes, edges, nodeColors }: SignalParticlesProps) {
  // Build node-id-to-index map
  const nodeIdxMap = useMemo(() => {
    const map: Record<string, number> = {};
    nodes.forEach((n, i) => { map[n.id] = i; });
    return map;
  }, [nodes]);

  // Build visible edges + adjacency map
  const { visEdges, nodeVisEdges } = useMemo(() => {
    const crossE: VisibleEdge[] = [];
    const sameE: VisibleEdge[] = [];

    for (const edge of edges) {
      const si = nodeIdxMap[edge.source];
      const ti = nodeIdxMap[edge.target];
      if (si !== undefined && ti !== undefined) {
        const cross = nodes[si].level !== nodes[ti].level;
        const obj: VisibleEdge = { si, ti, weight: edge.weight, cross };
        if (cross) crossE.push(obj); else sameE.push(obj);
      }
    }

    crossE.sort((a, b) => b.weight - a.weight);
    sameE.sort((a, b) => b.weight - a.weight);

    const vis = [...crossE, ...sameE].slice(0, MAX_E);

    // Build adjacency: node index -> list of visible edge indices
    const adj: Record<number, number[]> = {};
    for (let i = 0; i < vis.length; i++) {
      const { si, ti } = vis[i];
      if (!adj[si]) adj[si] = [];
      if (!adj[ti]) adj[ti] = [];
      adj[si].push(i);
      adj[ti].push(i);
    }

    return { visEdges: vis, nodeVisEdges: adj };
  }, [edges, nodeIdxMap, nodes]);

  const eC = visEdges.length;

  // Mutable signal data — persists across frames without re-renders
  const sigDataRef = useRef<SignalDatum[] | null>(null);
  if (sigDataRef.current === null && eC > 0) {
    sigDataRef.current = Array.from({ length: SIG_COUNT }, () => ({
      edge: Math.floor(Math.random() * eC),
      progress: Math.random(),
      speed: 0.25 + Math.random() * 0.55,
      forward: Math.random() > 0.5,
    }));
  }

  // Buffer arrays — stable refs updated in-place each frame
  const posRef = useRef<Float32Array | null>(null);
  const colRef = useRef<Float32Array | null>(null);
  const sizeRef = useRef<Float32Array | null>(null);
  if (posRef.current === null && eC > 0) {
    posRef.current = new Float32Array(SIG_COUNT * 3);
    colRef.current = new Float32Array(SIG_COUNT * 3);
    const sz = new Float32Array(SIG_COUNT);
    for (let i = 0; i < SIG_COUNT; i++) sz[i] = 6 + Math.random() * 5;
    sizeRef.current = sz;
  }

  // Refs for buffer attributes so we can flag needsUpdate
  const posAttrRef = useRef<THREE.BufferAttribute>(null);
  const colAttrRef = useRef<THREE.BufferAttribute>(null);

  // Shader material (created once)
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: sigVertexShader,
    fragmentShader: sigFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  // Animation loop
  useFrame(({ clock }) => {
    const sigData = sigDataRef.current;
    const posArr = posRef.current;
    const colArr = colRef.current;
    if (!sigData || !posArr || !colArr || eC === 0) return;

    const dt = clock.getDelta();

    for (let i = 0; i < SIG_COUNT; i++) {
      const sig = sigData[i];

      // Advance progress
      sig.progress += sig.speed * dt;

      // Hop to next edge when arriving at a node
      if (sig.progress >= 1.0) {
        const curEdge = visEdges[sig.edge];
        const endN = sig.forward ? curEdge.ti : curEdge.si;
        const neighbors = nodeVisEdges[endN];

        if (neighbors && neighbors.length > 0) {
          const nextIdx = neighbors[Math.floor(Math.random() * neighbors.length)];
          sig.edge = nextIdx;
          const nextEdge = visEdges[nextIdx];
          // Set direction: travel away from endN
          sig.forward = nextEdge.si === endN;
        } else {
          // Orphaned node — teleport to random edge
          sig.edge = Math.floor(Math.random() * eC);
          sig.forward = Math.random() > 0.5;
        }

        sig.progress = 0;
        sig.speed = 0.25 + Math.random() * 0.55;
      }

      // Interpolate position
      const edge = visEdges[sig.edge];
      const p = sig.forward ? sig.progress : 1 - sig.progress;
      const src = positions[edge.si];
      const tgt = positions[edge.ti];

      const off = i * 3;
      posArr[off]     = src.x + (tgt.x - src.x) * p;
      posArr[off + 1] = src.y + (tgt.y - src.y) * p;
      posArr[off + 2] = src.z + (tgt.z - src.z) * p;

      // Lerp color between source and target node colors
      const si3 = edge.si * 3;
      const ti3 = edge.ti * 3;
      colArr[off]     = nodeColors[si3]     + (nodeColors[ti3]     - nodeColors[si3])     * p;
      colArr[off + 1] = nodeColors[si3 + 1] + (nodeColors[ti3 + 1] - nodeColors[si3 + 1]) * p;
      colArr[off + 2] = nodeColors[si3 + 2] + (nodeColors[ti3 + 2] - nodeColors[si3 + 2]) * p;
    }

    // Flag GPU buffers for upload
    if (posAttrRef.current) posAttrRef.current.needsUpdate = true;
    if (colAttrRef.current) colAttrRef.current.needsUpdate = true;
  });

  // Nothing to render if no edges
  if (eC === 0) return null;

  return (
    <points material={material}>
      <bufferGeometry>
        <bufferAttribute
          ref={posAttrRef}
          attach="attributes-position"
          args={[posRef.current!, 3]}
        />
        <bufferAttribute
          ref={colAttrRef}
          attach="attributes-aColor"
          args={[colRef.current!, 3]}
        />
        <bufferAttribute
          attach="attributes-aSize"
          args={[sizeRef.current!, 1]}
        />
      </bufferGeometry>
    </points>
  );
}
