'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LEVEL_COLORS } from '@/lib/constants';
import { dustVertexShader, dustFragmentShader } from './shaders';

const SPACE_DUST_COUNT = 600;
const GALAXY_DUST_COUNT = 200; // ambient particles in the galaxy sphere

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export function NebulaStars() {
  const geoRef = useRef<THREE.BufferGeometry>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const TOTAL = SPACE_DUST_COUNT + GALAXY_DUST_COUNT;

  const attributes = useMemo(() => {
    const posArr = new Float32Array(TOTAL * 3);
    const colArr = new Float32Array(TOTAL * 3);
    const sizeArr = new Float32Array(TOTAL);
    const tmpColor = new THREE.Color();
    let idx = 0;

    // ─── Space dust: random dim particles far out ───
    for (let i = 0; i < SPACE_DUST_COUNT; i++) {
      posArr[idx * 3]     = (seededRandom(i * 31) - 0.5) * 2500;
      posArr[idx * 3 + 1] = (seededRandom(i * 37) - 0.5) * 2500;
      posArr[idx * 3 + 2] = (seededRandom(i * 41) - 0.5) * 2500;

      const hue = seededRandom(i * 53) * 0.15 + 0.55;
      tmpColor.setHSL(hue, 0.3 + seededRandom(i * 59) * 0.3, 0.2 + seededRandom(i * 61) * 0.1);
      colArr[idx * 3]     = tmpColor.r;
      colArr[idx * 3 + 1] = tmpColor.g;
      colArr[idx * 3 + 2] = tmpColor.b;

      sizeArr[idx] = 1 + seededRandom(i * 53) * 2;
      idx++;
    }

    // ─── Galaxy ambient dust: colored particles around the brain sphere ───
    const levels = [1, 2, 3, 4, 5, 6];
    const perLevel = Math.floor(GALAXY_DUST_COUNT / levels.length);

    for (const lvl of levels) {
      const levelColor = LEVEL_COLORS[lvl as keyof typeof LEVEL_COLORS] || 0x4488ff;
      tmpColor.set(levelColor);
      tmpColor.multiplyScalar(0.25); // very dim

      for (let j = 0; j < perLevel; j++) {
        // Scatter in a sphere around origin, radius 300-600
        const golden = 2.399963;
        const globalIdx = (lvl - 1) * perLevel + j;
        const theta = golden * globalIdx;
        const phi = Math.acos(1 - 2 * (globalIdx + 0.5) / GALAXY_DUST_COUNT);
        const r = 300 + seededRandom(globalIdx * 71 + lvl * 200) * 300;

        posArr[idx * 3]     = r * Math.sin(phi) * Math.cos(theta);
        posArr[idx * 3 + 1] = r * Math.cos(phi);
        posArr[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        colArr[idx * 3]     = tmpColor.r;
        colArr[idx * 3 + 1] = tmpColor.g;
        colArr[idx * 3 + 2] = tmpColor.b;

        sizeArr[idx] = 2 + seededRandom(globalIdx * 83 + lvl * 400) * 4;
        idx++;
      }
    }

    return { posArr, colArr, sizeArr };
  }, [TOTAL]);

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
