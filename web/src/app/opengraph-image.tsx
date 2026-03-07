import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'HelixMind — AI Coding CLI with Spiral Memory';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #050510 0%, #0a0a2e 50%, #050510 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Glow effect */}
        <div
          style={{
            position: 'absolute',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Logo / Brand */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 72 }}>🧠</span>
          HelixMind
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: '#00d4ff',
            marginTop: 16,
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}
        >
          AI Coding CLI with Spiral Memory
        </div>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 40,
            fontSize: 18,
            color: '#9ca3af',
          }}
        >
          <span>22 Tools</span>
          <span style={{ color: '#374151' }}>|</span>
          <span>Persistent Memory</span>
          <span style={{ color: '#374151' }}>|</span>
          <span>3D Brain Viz</span>
          <span style={{ color: '#374151' }}>|</span>
          <span>Open Source</span>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            fontSize: 16,
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          npm install -g helixmind
        </div>
      </div>
    ),
    { ...size },
  );
}
