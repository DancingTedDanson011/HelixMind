import { describe, expect, it } from 'vitest';
import { parseTurnDirectives } from '../../../src/cli/agent/turn-directives.js';

describe('parseTurnDirectives', () => {
  it('parses /fast as low-latency execution', () => {
    const parsed = parseTurnDirectives('/fast fix the failing tests');

    expect(parsed.input).toBe('fix the failing tests');
    expect(parsed.fastMode).toBe(true);
    expect(parsed.skipValidation).toBe(true);
    expect(parsed.skipSwarm).toBe(true);
    expect(parsed.forceSwarm).toBe(false);
  });

  it('lets explicit --swarm override fast mode swarm skip', () => {
    const parsed = parseTurnDirectives('/fast implement the queue --swarm');

    expect(parsed.input).toBe('implement the queue');
    expect(parsed.fastMode).toBe(true);
    expect(parsed.forceSwarm).toBe(true);
    expect(parsed.skipSwarm).toBe(false);
  });

  it('supports one-turn validation overrides', () => {
    const parsed = parseTurnDirectives('fix the form --skip-validation --validate');

    expect(parsed.input).toBe('fix the form');
    expect(parsed.forceValidation).toBe(true);
    expect(parsed.skipValidation).toBe(false);
  });

  it('forces swarm from /swarm prompt syntax', () => {
    const parsed = parseTurnDirectives('/swarm split this into workers');

    expect(parsed.input).toBe('split this into workers');
    expect(parsed.forceSwarm).toBe(true);
    expect(parsed.skipSwarm).toBe(false);
  });
});
