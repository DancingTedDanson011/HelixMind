'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LEVEL_COLORS } from '@/lib/constants';
import { LAYER_CONFIG } from './NebulaNodes';
import { dustVertexShader, dustFragmentShader } from './shaders';

const SPACE_DUST_COUNT = 400;
const LAYER_RING_COUNT = 50; // per layer
const TOTAL = SPACE_DUST_COUNT + LAYER_RING_COUNT * 6;

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export function NebulaStars() {
  const geoRef = useRef<THREE.BufferGeometry>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const attributes = useMemo(() => {
    const posArr = new Float32Array(TOTAL * 3);
    const colArr = new Float32Array(TOTAL * 3);
    const sizeArr = new Float32Array(TOTAL);
    const tmpColor = new THREE.Color();
    let idx = 0;

    // ─── Space dust: random dim particles ───
    for (let i = 0; i < SPACE_DUST_COUNT; i++) {
      posArr[idx * 3]     = (seededRandom(i * 31) - 0.5) * 1500;
      posArr[idx * 3 + 1] = (seededRandom(i * 37) - 0.5) * 1500;
      posArr[idx * 3 + 2] = (seededRandom(i * 41) - 0.5) * 1500;

      tmpColor.set(0x334466);
      colArr[idx * 3]     = tmpColor.r;
      colArr[idx * 3 + 1] = tmpColor.g;
      colArr[idx * 3 + 2] = tmpColor.b;

      sizeArr[idx] = 1 + seededRandom(i * 53) * 3;
      idx++;
    }

    // ─── Layer fog rings: colored particles at each layer Y ───
    for (let lvl = 1; lvl <= 6; lvl++) {
      const config = LAYER_CONFIG[lvl];
      if (!config) continue;

      const levelColor = LEVEL_COLORS[lvl as keyof typeof LEVEL_COLORS] || 0x4488ff;
      tmpColor.set(levelColor);
      // Dim the color for fog effect
      tmpColor.multiplyScalar(0.4);

      const fogRadius = config.radius * 1.6;

      for (let j = 0; j < LAYER_RING_COUNT; j++) {
        const angle = (j / LAYER_RING_COUNT) * Math.PI * 2 + seededRandom(j * 67 + lvl * 100) * 0.4;
        const r = fogRadius * (0.2 + seededRandom(j * 71 + lvl * 200) * 0.8);

        posArr[idx * 3]     = Math.cos(angle) * r;
        posArr[idx * 3 + 1] = config.y + (seededRandom(j * 79 + lvl * 300) - 0.5) * 25;
        posArr[idx * 3 + 2] = Math.sin(angle) * r;

        colArr[idx * 3]     = tmpColor.r;
        colArr[idx * 3 + 1] = tmpColor.g;
        colArr[idx * 3 + 2] = tmpColor.b;

        sizeArr[idx] = 3 + seededRandom(j * 83 + lvl * 400) * 6;
        idx++;
      }
    }

    return { posArr, colArr, sizeArr };
  }, []);

  useEffect(() => {
    const geo = geoRef.current;
    if (!geo) return;
    geo.setAttribute('position', new THREE.BufferAttribute(attributes.posArr, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(attributes.colArr, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(attributes.sizeArr, 1));
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
    <points>
      <bufferGeometry ref={geoRef} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={dustVertexShader}
        fragmentShader={dustFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
