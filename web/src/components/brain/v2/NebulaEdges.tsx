'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DemoNode, DemoEdge } from '../brain-demo-data';
import { computeNebulaPositions } from './NebulaNodes';
import { LEVEL_COLORS } from '@/lib/constants';
import { edgeVertexShader, edgeFragmentShader } from './shaders';

interface NebulaEdgesProps {
  nodes: DemoNode[];
  edges: DemoEdge[];
}

export function NebulaEdges({ nodes, edges }: NebulaEdgesProps) {
  const geoRef = useRef<THREE.BufferGeometry>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const positions = useMemo(() => computeNebulaPositions(nodes), [nodes]);

  const nodeIdxMap = useMemo(() => {
    const map: Record<string, number> = {};
    nodes.forEach((n, i) => { map[n.id] = i; });
    return map;
  }, [nodes]);

  const attributes = useMemo(() => {
    // Collect valid edges
    const valid: Array<{ si: number; ti: number }> = [];
    for (const edge of edges) {
      const si = nodeIdxMap[edge.source];
      const ti = nodeIdxMap[edge.target];
      if (si !== undefined && ti !== undefined) {
        valid.push({ si, ti });
      }
    }

    const count = valid.length;
    const posArr = new Float32Array(count * 6);       // 2 vertices × 3 coords
    const colArr = new Float32Array(count * 6);       // 2 vertices × 3 color
    const srcPosArr = new Float32Array(count * 6);    // aSourcePos for growth animation
    const birthArr = new Float32Array(count * 2);     // 2 vertices × 1 birth time
    const srcColor = new THREE.Color();
    const tgtColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const { si, ti } = valid[i];
      const start = positions[si];
      const end = positions[ti];
      const off = i * 6;
      const bOff = i * 2;

      // Source vertex
      posArr[off]     = start.x;
      posArr[off + 1] = start.y;
      posArr[off + 2] = start.z;
      // Target vertex
      posArr[off + 3] = end.x;
      posArr[off + 4] = end.y;
      posArr[off + 5] = end.z;

      // Colors: gradient from source level → target level
      const srcLvl = nodes[si].level as keyof typeof LEVEL_COLORS;
      const tgtLvl = nodes[ti].level as keyof typeof LEVEL_COLORS;
      srcColor.set(LEVEL_COLORS[srcLvl] || 0x4488ff);
      tgtColor.set(LEVEL_COLORS[tgtLvl] || 0x4488ff);

      colArr[off]     = srcColor.r;
      colArr[off + 1] = srcColor.g;
      colArr[off + 2] = srcColor.b;
      colArr[off + 3] = tgtColor.r;
      colArr[off + 4] = tgtColor.g;
      colArr[off + 5] = tgtColor.b;

      // Source position for both vertices (growth starts from source)
      srcPosArr[off]     = start.x;
      srcPosArr[off + 1] = start.y;
      srcPosArr[off + 2] = start.z;
      srcPosArr[off + 3] = start.x;  // target vertex also starts here
      srcPosArr[off + 4] = start.y;
      srcPosArr[off + 5] = start.z;

      // Birth time: -1 = instant (static demo data)
      birthArr[bOff]     = -1;
      birthArr[bOff + 1] = -1;
    }

    return { posArr, colArr, srcPosArr, birthArr };
  }, [edges, nodeIdxMap, positions, nodes]);

  useEffect(() => {
    const geo = geoRef.current;
    if (!geo) return;
    geo.setAttribute('position', new THREE.BufferAttribute(attributes.posArr, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(attributes.colArr, 3));
    geo.setAttribute('aSourcePos', new THREE.BufferAttribute(attributes.srcPosArr, 3));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(attributes.birthArr, 1));
  }, [attributes]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <lineSegments>
      <bufferGeometry ref={geoRef} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={edgeVertexShader}
        fragmentShader={edgeFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}
