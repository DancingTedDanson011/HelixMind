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

    // Multi-layer Gaussian glow — creates nebula cloud effect
    float core  = exp(-d * d * 100.0);          // tight bright center
    float glow1 = exp(-d * d * 18.0)  * 0.45;   // inner glow ring
    float glow2 = exp(-d * d * 4.0)   * 0.15;   // mid-range haze
    float glow3 = exp(-d * d * 1.2)   * 0.06;   // outer nebula fringe

    float intensity = core + glow1 + glow2 + glow3;

    // Birth flash brightens the core
    vec3 color = vColor * (1.0 + vGlow * core * 1.5);

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
