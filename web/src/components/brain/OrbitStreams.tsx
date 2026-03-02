'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { srand } from './brain-utils';

// ─── Constants ──────────────────────────────────────────────
const ORB_COUNT = 200;
const ORB3_COUNT = 150;
const TRAIL_LEN = 6;

// ─── Shaders ────────────────────────────────────────────────

const orbVertexShader = /* glsl */`
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vC;
  void main() {
    vC = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (800.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const orbFragmentShader = /* glsl */`
  varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float g = exp(-d * d * 8.0);
    gl_FragColor = vec4(vC * 1.8, g * 0.85);
  }
`;

const trailVertexShader = orbVertexShader;

const trailFragmentShader = /* glsl */`
  varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float g = exp(-d * d * 8.0);
    gl_FragColor = vec4(vC * 1.4, g * 0.45);
  }
`;

// ─── Types ──────────────────────────────────────────────────

interface OrbitStreamsProps {
  spread: number;
  centroid: THREE.Vector3;
}

interface OrbitConfig {
  count: number;
  hueBase: number;
  hueRange: number;
  hueSeed: number;
  speedFactor: number;
  direction: number; // 1 or -1
  tiltX: number;
  tiltZ: number;
  tiltY: number;
  jarvisInterval: number; // every Nth particle is a "Jarvis node", 0 = none
  jarvisHueBase: number;
  jarvisHueRange: number;
}

// ─── Helpers ────────────────────────────────────────────────

/** Pre-compute per-particle static data for one orbit */
function buildOrbitStatics(cfg: OrbitConfig, orbR: number) {
  const { count, hueSeed, hueBase, hueRange, jarvisInterval, jarvisHueBase, jarvisHueRange } = cfg;
  const tmpC = new THREE.Color();

  const phases = new Float32Array(count);
  const radii = new Float32Array(count);
  const baseSizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    phases[i] = (i / count) * Math.PI * 2 + srand(i * 53) * 0.5;
    radii[i] = orbR * (0.82 + srand(i * 113) * 0.36);

    const isJarvis = jarvisInterval > 0 && i % jarvisInterval === 0;
    if (isJarvis) {
      baseSizes[i] = 9 + srand(i * 67) * 4;
      tmpC.setHSL(jarvisHueBase + srand(i * 137) * jarvisHueRange, 0.9, 0.6);
    } else {
      baseSizes[i] = 4 + srand(i * 67) * 5;
      tmpC.setHSL(hueBase + srand(i * hueSeed) * hueRange, 0.9, 0.6);
    }

    colors[i * 3] = tmpC.r;
    colors[i * 3 + 1] = tmpC.g;
    colors[i * 3 + 2] = tmpC.b;
  }

  return { phases, radii, baseSizes, colors };
}

/** Compute one particle position for an orbit at a given time */
function computePosition(
  i: number,
  speed: number,
  direction: number,
  phase: number,
  r: number,
  cx: number, cy: number, cz: number,
  tiltX: number, tiltZ: number, tiltY: number,
): [number, number, number] {
  const angle = phase + speed * direction;
  const jitter = (srand(i * 97 + Math.floor(speed * 100) % 1000) - 0.5) * r * 0.04;

  // Base ring in XZ plane
  let lx = Math.cos(angle) * r;
  let ly = jitter;
  let lz = Math.sin(angle) * r;

  // Apply tilt rotations
  if (tiltX !== 0) {
    const cosX = Math.cos(tiltX);
    const sinX = Math.sin(tiltX);
    const ry = ly * cosX - lz * sinX;
    const rz = ly * sinX + lz * cosX;
    ly = ry;
    lz = rz;
  }

  if (tiltZ !== 0) {
    const cosZ = Math.cos(tiltZ);
    const sinZ = Math.sin(tiltZ);
    const rx = lx * cosZ - ly * sinZ;
    const ry2 = lx * sinZ + ly * cosZ;
    lx = rx;
    ly = ry2;
  }

  if (tiltY !== 0) {
    const cosY = Math.cos(tiltY);
    const sinY = Math.sin(tiltY);
    const rx = lx * cosY + lz * sinY;
    const rz2 = -lx * sinY + lz * cosY;
    lx = rx;
    lz = rz2;
  }

  return [cx + lx, cy + ly, cz + lz];
}

// ─── Single Orbit Sub-Component ─────────────────────────────

interface OrbitLayerProps {
  cfg: OrbitConfig;
  orbR: number;
  cx: number;
  cy: number;
  cz: number;
}

function OrbitLayer({ cfg, orbR, cx, cy, cz }: OrbitLayerProps) {
  const { count, speedFactor, direction, tiltX, tiltZ, tiltY } = cfg;

  // Pre-compute statics once
  const statics = useMemo(() => buildOrbitStatics(cfg, orbR), [cfg, orbR]);

  // --- Buffer refs ---
  const orbGeoRef = useRef<THREE.BufferGeometry>(null!);
  const trailGeoRef = useRef<THREE.BufferGeometry>(null!);

  // --- Allocate buffers ---
  const orbPositions = useMemo(() => new Float32Array(count * 3), [count]);
  const orbSizes = useMemo(() => new Float32Array(count), [count]);
  const orbColors = useMemo(() => new Float32Array(count * 3), [count]);

  const trailPositions = useMemo(() => new Float32Array(count * TRAIL_LEN * 3), [count]);
  const trailSizes = useMemo(() => new Float32Array(count * TRAIL_LEN), [count]);
  const trailColors = useMemo(() => new Float32Array(count * TRAIL_LEN * 3), [count]);

  // Trail history: [particle][trail_index] = [x, y, z]
  const trailHistory = useRef<Float32Array[]>(null!);
  if (!trailHistory.current) {
    // Initialize all trail positions to zero; they'll converge on first frames
    trailHistory.current = Array.from({ length: count }, () =>
      new Float32Array(TRAIL_LEN * 3),
    );
  }

  // --- Materials ---
  const orbMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: orbVertexShader,
    fragmentShader: orbFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  const trailMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: trailVertexShader,
    fragmentShader: trailFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 1000;
    const speed = t * speedFactor;
    const { phases, radii, baseSizes, colors: staticColors } = statics;
    const hist = trailHistory.current!;

    for (let i = 0; i < count; i++) {
      const [px, py, pz] = computePosition(
        i, speed, direction, phases[i], radii[i],
        cx, cy, cz, tiltX, tiltZ, tiltY,
      );

      // --- Update trail history: shift old positions back ---
      const h = hist[i];
      for (let j = TRAIL_LEN - 1; j > 0; j--) {
        h[j * 3] = h[(j - 1) * 3];
        h[j * 3 + 1] = h[(j - 1) * 3 + 1];
        h[j * 3 + 2] = h[(j - 1) * 3 + 2];
      }
      h[0] = px;
      h[1] = py;
      h[2] = pz;

      // --- Write main particle ---
      orbPositions[i * 3] = px;
      orbPositions[i * 3 + 1] = py;
      orbPositions[i * 3 + 2] = pz;
      orbSizes[i] = baseSizes[i];
      orbColors[i * 3] = staticColors[i * 3];
      orbColors[i * 3 + 1] = staticColors[i * 3 + 1];
      orbColors[i * 3 + 2] = staticColors[i * 3 + 2];

      // --- Write trail particles ---
      for (let j = 0; j < TRAIL_LEN; j++) {
        const ti = i * TRAIL_LEN + j;
        trailPositions[ti * 3] = h[j * 3];
        trailPositions[ti * 3 + 1] = h[j * 3 + 1];
        trailPositions[ti * 3 + 2] = h[j * 3 + 2];

        trailSizes[ti] = baseSizes[i] * (1 - j / TRAIL_LEN) * 0.6;

        trailColors[ti * 3] = staticColors[i * 3];
        trailColors[ti * 3 + 1] = staticColors[i * 3 + 1];
        trailColors[ti * 3 + 2] = staticColors[i * 3 + 2];
      }
    }

    // --- Flag GPU updates ---
    if (orbGeoRef.current) {
      const attrs = orbGeoRef.current.attributes;
      (attrs.position as THREE.BufferAttribute).needsUpdate = true;
      (attrs.aSize as THREE.BufferAttribute).needsUpdate = true;
      (attrs.aColor as THREE.BufferAttribute).needsUpdate = true;
    }
    if (trailGeoRef.current) {
      const attrs = trailGeoRef.current.attributes;
      (attrs.position as THREE.BufferAttribute).needsUpdate = true;
      (attrs.aSize as THREE.BufferAttribute).needsUpdate = true;
      (attrs.aColor as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <>
      {/* Main orbit particles */}
      <points material={orbMat}>
        <bufferGeometry ref={orbGeoRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[orbPositions, 3]}
          />
          <bufferAttribute
            attach="attributes-aSize"
            args={[orbSizes, 1]}
          />
          <bufferAttribute
            attach="attributes-aColor"
            args={[orbColors, 3]}
          />
        </bufferGeometry>
      </points>

      {/* Trail particles */}
      <points material={trailMat}>
        <bufferGeometry ref={trailGeoRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[trailPositions, 3]}
          />
          <bufferAttribute
            attach="attributes-aSize"
            args={[trailSizes, 1]}
          />
          <bufferAttribute
            attach="attributes-aColor"
            args={[trailColors, 3]}
          />
        </bufferGeometry>
      </points>
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────

/**
 * OrbitStreams — port of the 3 orbit particle streams with trails from the CLI brain template.
 *
 * Orbit 1: Green spectrum, horizontal ring
 * Orbit 2: Gold spectrum, tilted ring (opposite direction)
 * Orbit 3: Cyan-violet spectrum, polar cross-ring
 */
export function OrbitStreams({ spread, centroid }: OrbitStreamsProps) {
  const orbR = spread * 1.6;
  const cx = centroid.x;
  const cy = centroid.y;
  const cz = centroid.z;

  // Orbit configs are stable — only recalculate when spread changes
  const orbit1: OrbitConfig = useMemo(() => ({
    count: ORB_COUNT,
    hueBase: 0.28,
    hueRange: 0.17,
    hueSeed: 137,
    speedFactor: 0.0003,
    direction: 1,
    tiltX: 0,
    tiltZ: 0,
    tiltY: 0,
    jarvisInterval: 12,
    jarvisHueBase: 0.45,
    jarvisHueRange: 0.1,
  }), []);

  const orbit2: OrbitConfig = useMemo(() => ({
    count: ORB_COUNT,
    hueBase: 0.08,
    hueRange: 0.12,
    hueSeed: 143,
    speedFactor: 0.00025,
    direction: -1,
    tiltX: Math.PI / 2.5,
    tiltZ: Math.PI / 6,
    tiltY: 0,
    jarvisInterval: 0,
    jarvisHueBase: 0,
    jarvisHueRange: 0,
  }), []);

  const orbit3: OrbitConfig = useMemo(() => ({
    count: ORB3_COUNT,
    hueBase: 0.5,
    hueRange: 0.25,
    hueSeed: 151,
    speedFactor: 0.00022,
    direction: 1,
    tiltX: Math.PI / 2.1,
    tiltZ: 0,
    tiltY: Math.PI / 3.2,
    jarvisInterval: 0,
    jarvisHueBase: 0,
    jarvisHueRange: 0,
  }), []);

  return (
    <>
      <OrbitLayer cfg={orbit1} orbR={orbR} cx={cx} cy={cy} cz={cz} />
      <OrbitLayer cfg={orbit2} orbR={orbR} cx={cx} cy={cy} cz={cz} />
      <OrbitLayer cfg={orbit3} orbR={orbR} cx={cx} cy={cy} cz={cz} />
    </>
  );
}
