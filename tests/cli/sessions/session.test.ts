import { describe, it, expect } from 'vitest';
import { Session, type SessionResult } from '../../../src/cli/sessions/session.js';

describe('Session', () => {
  const flags = { yolo: false, skipPermissions: false };

  it('should create with correct initial state', () => {
    const session = new Session('test-1', 'Test', '\u{1F4AC}', flags);
    expect(session.id).toBe('test-1');
    expect(session.name).toBe('Test');
    expect(session.icon).toBe('\u{1F4AC}');
    expect(session.status).toBe('idle');
    expect(session.history).toHaveLength(0);
    expect(session.output).toHaveLength(0);
    expect(session.result).toBeNull();
  });

  it('should copy base history without sharing references', () => {
    const baseHistory = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi' },
    ];
    const session = new Session('test-2', 'Test', '\u{1F4AC}', flags, baseHistory);
    expect(session.history).toHaveLength(2);
    expect(session.history[0]).not.toBe(baseHistory[0]); // Different reference
    expect(session.history[0].content).toBe('hello');
  });

  it('should track start/complete lifecycle', () => {
    const session = new Session('test-3', 'Test', '\u{1F4AC}', flags);
    expect(session.status).toBe('idle');
    expect(session.elapsed).toBe(0);

    session.start();
    expect(session.status).toBe('running');
    expect(session.startTime).toBeGreaterThan(0);

    const result: SessionResult = {
      text: 'done',
      steps: [],
      errors: [],
      durationMs: 1000,
    };
    session.complete(result);
    expect(session.status).toBe('done');
    expect(session.result).toBe(result);
    expect(session.endTime).toBeGreaterThan(0);
  });

  it('should set error status when result has errors', () => {
    const session = new Session('test-4', 'Test', '\u{1F4AC}', flags);
    session.start();
    session.complete({
      text: 'failed',
      steps: [],
      errors: ['something broke'],
      durationMs: 500,
    });
    expect(session.status).toBe('error');
  });

  it('should abort correctly', () => {
    const session = new Session('test-5', 'Test', '\u{1F4AC}', flags);
    session.start();
    session.abort();
    expect(session.status).toBe('error');
    expect(session.controller.isAborted).toBe(true);
  });

  it('should capture output lines with max limit', () => {
    const session = new Session('test-6', 'Test', '\u{1F4AC}', flags);
    for (let i = 0; i < 600; i++) {
      session.capture(`line ${i}`);
    }
    expect(session.output).toHaveLength(500);
    expect(session.output[0]).toBe('line 100'); // Oldest kept
    expect(session.output[499]).toBe('line 599'); // Newest
  });

  it('should track elapsed time', () => {
    const session = new Session('test-7', 'Test', '\u{1F4AC}', flags);
    session.start();
    // Elapsed should be > 0 when running (uses Date.now())
    expect(session.elapsed).toBeGreaterThanOrEqual(0);
  });
});
