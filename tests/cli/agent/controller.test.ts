import { describe, it, expect } from 'vitest';
import { AgentController, AgentAbortError } from '../../../src/cli/agent/loop.js';

describe('AgentController', () => {
  it('should start in non-paused, non-aborted state', () => {
    const ctrl = new AgentController();
    expect(ctrl.isPaused).toBe(false);
    expect(ctrl.isAborted).toBe(false);
  });

  it('should set paused state', () => {
    const ctrl = new AgentController();
    ctrl.pause();
    expect(ctrl.isPaused).toBe(true);
  });

  it('should resume from paused state', async () => {
    const ctrl = new AgentController();
    ctrl.pause();

    // Start checkPause in background (will block)
    let resolved = false;
    const promise = ctrl.checkPause().then(() => { resolved = true; });

    // Verify it's still waiting
    await new Promise(r => setTimeout(r, 10));
    expect(resolved).toBe(false);

    // Resume
    ctrl.resume();
    await promise;
    expect(resolved).toBe(true);
    expect(ctrl.isPaused).toBe(false);
  });

  it('should throw AgentAbortError when aborted', async () => {
    const ctrl = new AgentController();
    ctrl.pause();

    // Start checkPause in background
    const promise = ctrl.checkPause();

    // Abort
    ctrl.abort();

    await expect(promise).rejects.toThrow(AgentAbortError);
  });

  it('should throw immediately if already aborted', async () => {
    const ctrl = new AgentController();
    ctrl.abort();

    await expect(ctrl.checkPause()).rejects.toThrow(AgentAbortError);
  });

  it('should reset all state', () => {
    const ctrl = new AgentController();
    ctrl.pause();
    ctrl.reset();

    expect(ctrl.isPaused).toBe(false);
    expect(ctrl.isAborted).toBe(false);
  });

  it('should not block if not paused', async () => {
    const ctrl = new AgentController();
    // Should resolve immediately
    await ctrl.checkPause();
    expect(ctrl.isPaused).toBe(false);
  });
});
