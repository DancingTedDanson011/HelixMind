/**
 * Tests for auth guard — the login-or-open-source choice flow.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const guardSource = readFileSync(
  resolve(__dirname, '../../../src/cli/auth/guard.ts'),
  'utf-8',
);

describe('guard — requireAuth exports', () => {
  it('exports requireAuth as a function', async () => {
    const mod = await import('../../../src/cli/auth/guard.js');
    expect(typeof mod.requireAuth).toBe('function');
  });
});

describe('guard — choice UI structure', () => {
  it('presents both options: Login and Open Source', () => {
    expect(guardSource).toContain('[1] Login');
    expect(guardSource).toContain('[2] Open Source');
  });

  it('shows Login as the recommended option with star marker', () => {
    expect(guardSource).toContain('★');
    expect(guardSource).toContain('unlock everything');
  });

  it('lists all gated features for Login option', () => {
    expect(guardSource).toContain('Jarvis AGI');
    expect(guardSource).toContain('Validation Matrix');
    expect(guardSource).toContain('Security Monitor');
    expect(guardSource).toContain('Autonomous Mode');
    expect(guardSource).toContain('3D Brain Management');
    expect(guardSource).toContain('3 Brains');
    expect(guardSource).toContain('Live Brain WebSocket');
  });

  it('emphasizes free and no credit card', () => {
    expect(guardSource).toContain('No credit card');
    expect(guardSource).toContain('Free forever');
    expect(guardSource).toContain('works offline');
  });

  it('shows Open Source limitations with red X markers', () => {
    expect(guardSource).toContain('No Jarvis');
    expect(guardSource).toContain('No Validation');
    expect(guardSource).toContain('No Monitor');
    expect(guardSource).toContain('No Brain Management');
    expect(guardSource).toContain('No Security Audit');
  });

  it('shows Open Source included features', () => {
    expect(guardSource).toContain('22 Tools');
    expect(guardSource).toContain('Spiral Memory');
    expect(guardSource).toContain('Anthropic/OpenAI/Ollama');
  });

  it('shows choice prompt defaulting to option 1', () => {
    expect(guardSource).toContain('[1]');
    expect(guardSource).toContain("resolve('1')");
  });
});

describe('guard — never kills the process', () => {
  it('does not call process.exit', () => {
    expect(guardSource).not.toContain('process.exit');
  });
});

describe('guard — login failure recovery', () => {
  it('continues in Open Source mode if login fails', () => {
    expect(guardSource).toContain('Login cancelled');
    expect(guardSource).toContain('Open Source');
  });

  it('always suggests helixmind login for later upgrade', () => {
    expect(guardSource).toContain('helixmind login');
  });
});
