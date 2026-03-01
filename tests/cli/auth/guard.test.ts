/**
 * Tests for auth guard — the login-or-open-source choice flow.
 * Note: Interactive readline tests cannot be unit-tested easily.
 * These tests verify the structural correctness of the guard module.
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

  it('describes Login option with Jarvis and Brain Management', () => {
    expect(guardSource).toContain('Jarvis AGI');
    expect(guardSource).toContain('Brain Management');
  });

  it('describes Open Source option with full agent features', () => {
    expect(guardSource).toContain('Full AI agent');
    expect(guardSource).toContain('22 Tools');
    expect(guardSource).toContain('Spiral Memory');
    expect(guardSource).toContain('No account needed');
  });

  it('shows a [1/2] choice prompt', () => {
    expect(guardSource).toContain('[1/2]');
  });

  it('defaults to login (option 1) on empty input', () => {
    // promptChoice resolves '1' unless input is explicitly '2'
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
