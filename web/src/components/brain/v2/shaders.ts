// ─── Nebula Node Shaders ─────────────────────────────────────
// Soft gaussian glow with multi-layer falloff, additive blending
// Creates nebula-like cloud nodes instead of hard geometry

export const nodeVertexShader = `
  attribute float aSize;
  attribute float aBirth;
  attribute float aGlow;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vGlow;
  varying float vAlpha;

  uniform float uTime;

  void main() {
    vColor = aColor;

    // Birth animation: scale 0 → 1 over 1.5s with ease-out cubic
    float age = uTime - aBirth;
    float birthScale = aBirth < 0.0 ? 1.0 : clamp(age / 1.5, 0.0, 1.0);
    birthScale = 1.0 - pow(1.0 - birthScale, 3.0);

    // Birth flash: bright burst that fades over 2s
    float flash = aBirth < 0.0 ? 0.0 : max(0.0, 1.0 - age * 0.5) * 3.0;
    vGlow = aGlow + flash;
    vAlpha = birthScale;

    // Gentle breathing oscillation
    float breath = 1.0 + sin(uTime * 0.5 + position.x * 0.008 + position.z * 0.006) * 0.08;

    // Subtle vertical float
    vec3 pos = position;
    pos.y += sin(uTime * 0.3 + position.x * 0.01 + position.z * 0.015) * 3.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * birthScale * breath * (500.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const nodeFragmentShader = `
  varying vec3 vColor;
  varying float vGlow;
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float d = length(center);
    if (d > 0.5) discard;

    // Sharp saturated core with minimal glow — preserves level color
    float core = exp(-d * d * 180.0) * 0.95;
    float halo = exp(-d * d * 22.0) * 0.25;
    float outer = exp(-d * d * 6.0) * 0.06;

    float intensity = core + halo + outer;

    // Birth flash brightens the core, but keep color saturated
    vec3 color = vColor * (0.85 + core * 0.15 + vGlow * core * 0.5);

    gl_FragColor = vec4(color, intensity * vAlpha);
  }
`;

// ─── Edge Shaders ────────────────────────────────────────────
// Lines grow from source → target on birth, pulse subtly

export const edgeVertexShader = `
  attribute vec3 aColor;
  attribute vec3 aSourcePos;
  attribute float aBirth;

  varying vec3 vColor;
  varying float vAlpha;

  uniform float uTime;

  void main() {
    vColor = aColor;

    // Growth animation: target vertex lerps from source to actual position
    float age = uTime - aBirth;
    float growth = aBirth < 0.0 ? 1.0 : clamp(age / 1.2, 0.0, 1.0);
    growth = 1.0 - pow(1.0 - growth, 2.0); // ease-out quad

    vec3 pos = mix(aSourcePos, position, growth);

    // Subtle pulse for living feel
    float pulse = 0.5 + 0.5 * sin(uTime * 1.2 + length(position) * 0.008);
    vAlpha = growth * (0.12 + pulse * 0.08);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const edgeFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

// ─── Ambient Dust/Star Shaders ───────────────────────────────
// Tiny floating particles with slow drift for atmosphere

export const dustVertexShader = `
  attribute float aSize;
  attribute vec3 aColor;

  varying vec3 vColor;

  uniform float uTime;

  void main() {
    vColor = aColor;

    // Slow organic drift
    vec3 pos = position;
    pos.x += sin(uTime * 0.05 + position.y * 0.003) * 8.0;
    pos.y += cos(uTime * 0.04 + position.x * 0.002) * 5.0;
    pos.z += sin(uTime * 0.03 + position.z * 0.004) * 6.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const dustFragmentShader = `
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float alpha = exp(-d * d * 8.0) * 0.4;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// ─── Jarvis Neuron Shaders ──────────────────────────────────
// Particles that shoot from orbit positions to core center with trail fade

export const neuronVertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (400.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const neuronFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float core = exp(-d * d * 120.0) * 1.0;
    float halo = exp(-d * d * 15.0) * 0.35;

    float intensity = core + halo;
    gl_FragColor = vec4(vColor * (0.8 + core * 0.4), intensity * vAlpha);
  }
`;

// ─── Jarvis Core Shaders ────────────────────────────────────
// Golden pulsing core with warm glow

export const coreVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform float uTime;
  uniform float uPulse;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    // Breathing pulse
    float breath = 1.0 + sin(uTime * 0.8) * 0.03 * uPulse;
    vec3 pos = position * breath;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const coreFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    // Fresnel edge glow
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    fresnel = pow(fresnel, 2.0);

    // Inner warmth
    float inner = 0.3 + fresnel * 0.7;
    float pulse = 0.95 + sin(uTime * 1.2) * 0.05;

    vec3 color = uColor * inner * pulse;
    float alpha = uOpacity * (0.6 + fresnel * 0.4);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── Jarvis Orbit Shaders ───────────────────────────────────
// Ring particles with soft glow

export const orbitVertexShader = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPulse;

  varying vec3 vColor;
  varying float vPulse;

  uniform float uTime;

  void main() {
    vColor = aColor;
    vPulse = aPulse;

    float breath = 1.0 + sin(uTime * 2.0 + aPulse * 6.28) * 0.15;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * breath * (350.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const orbitFragmentShader = `
  varying vec3 vColor;
  varying float vPulse;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float core = exp(-d * d * 80.0) * 0.9;
    float halo = exp(-d * d * 12.0) * 0.3;

    float intensity = core + halo;
    gl_FragColor = vec4(vColor, intensity);
  }
`;
