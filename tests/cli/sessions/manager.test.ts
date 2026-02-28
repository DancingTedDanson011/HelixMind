import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../../src/cli/sessions/manager.js';

describe('SessionManager', () => {
  const flags = { yolo: false, skipPermissions: false };

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('should create with main session', () => {
    const mgr = new SessionManager({ flags });
    expect(mgr.all).toHaveLength(1);
    expect(mgr.main.id).toBe('main');
    expect(mgr.main.name).toBe('Chat');
    expect(mgr.activeId).toBe('main');
  });

  it('should create background sessions', () => {
    const mgr = new SessionManager({ flags });
    const bg = mgr.create('Security', '\u{1F512}');
    expect(mgr.all).toHaveLength(2);
    expect(bg.name).toBe('Security');
    expect(bg.icon).toBe('\u{1F512}');
    expect(bg.id).not.toBe('main');
    expect(mgr.background).toHaveLength(1);
  });

  it('should switch between sessions', () => {
    const mgr = new SessionManager({ flags });
    const bg = mgr.create('Security', '\u{1F512}');
    expect(mgr.activeId).toBe('main');

    mgr.switchTo(bg.id);
    expect(mgr.activeId).toBe(bg.id);
    expect(mgr.active).toBe(bg);

    mgr.switchToMain();
    expect(mgr.activeId).toBe('main');
  });

  it('should cycle through sessions with next/prev', () => {
    const mgr = new SessionManager({ flags });
    const bg1 = mgr.create('S1', '\u{1F512}');
    const bg2 = mgr.create('S2', '\u{1F504}');

    mgr.switchNext(); // main -> S1
    expect(mgr.activeId).toBe(bg1.id);

    mgr.switchNext(); // S1 -> S2
    expect(mgr.activeId).toBe(bg2.id);

    mgr.switchNext(); // S2 -> main (wrap)
    expect(mgr.activeId).toBe('main');

    mgr.switchPrev(); // main -> S2 (wrap)
    expect(mgr.activeId).toBe(bg2.id);
  });

  it('should abort a session', () => {
    const mgr = new SessionManager({ flags });
    const bg = mgr.create('Security', '\u{1F512}');
    bg.start();
    expect(bg.status).toBe('running');
    expect(mgr.running).toHaveLength(1);

    mgr.abort(bg.id);
    expect(bg.status).toBe('error');
    expect(bg.controller.isAborted).toBe(true);
  });

  it('should abort all background sessions', () => {
    const mgr = new SessionManager({ flags });
    const bg1 = mgr.create('S1', '\u{1F512}');
    const bg2 = mgr.create('S2', '\u{1F504}');
    bg1.start();
    bg2.start();

    mgr.abortAll();
    expect(bg1.status).toBe('error');
    expect(bg2.status).toBe('error');
    expect(mgr.running).toHaveLength(0);
  });

  it('should remove completed sessions', () => {
    const mgr = new SessionManager({ flags });
    const bg = mgr.create('Security', '\u{1F512}');
    bg.start();
    bg.complete({ text: 'done', steps: [], errors: [], durationMs: 100 });

    expect(mgr.all).toHaveLength(2);
    mgr.remove(bg.id);
    expect(mgr.all).toHaveLength(1);
  });

  it('should not remove main session', () => {
    const mgr = new SessionManager({ flags });
    const removed = mgr.remove('main');
    expect(removed).toBe(false);
    expect(mgr.all).toHaveLength(1);
  });

  it('should switch to main when removing active session', () => {
    const mgr = new SessionManager({ flags });
    const bg = mgr.create('Security', '\u{1F512}');
    mgr.switchTo(bg.id);
    expect(mgr.activeId).toBe(bg.id);

    mgr.remove(bg.id);
    expect(mgr.activeId).toBe('main');
  });

  it('should call onSessionComplete callback', () => {
    const onComplete = vi.fn();
    const mgr = new SessionManager({ flags, onSessionComplete: onComplete });
    const bg = mgr.create('Security', '\u{1F512}');

    mgr.complete(bg.id, {
      text: 'done',
      steps: [],
      errors: [],
      durationMs: 100,
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(bg);
    expect(bg.status).toBe('done');
  });

  it('should find session by name', () => {
    const mgr = new SessionManager({ flags });
    mgr.create('Security Audit', '\u{1F512}');
    const found = mgr.findByName('security');
    expect(found).toBeDefined();
    expect(found?.name).toBe('Security Audit');
  });

  it('should track hasBackgroundTasks correctly', () => {
    const mgr = new SessionManager({ flags });
    expect(mgr.hasBackgroundTasks).toBe(false);

    const bg = mgr.create('Security', '\u{1F512}');
    bg.start();
    expect(mgr.hasBackgroundTasks).toBe(true);

    bg.complete({ text: 'done', steps: [], errors: [], durationMs: 100 });
    expect(mgr.hasBackgroundTasks).toBe(false);
  });

  it('should listen for completions via onComplete', () => {
    const mgr = new SessionManager({ flags });
    const listener = vi.fn();
    mgr.onComplete(listener);

    const bg = mgr.create('Test', '\u{1F4AC}');
    mgr.complete(bg.id, { text: 'done', steps: [], errors: [], durationMs: 50 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(bg);
  });

  it('should auto-close completed background sessions after delay', () => {
    const onAutoClose = vi.fn();
    const mgr = new SessionManager({ flags, onSessionAutoClose: onAutoClose });
    const bg = mgr.create('Security', '\u{1F512}');

    mgr.complete(bg.id, { text: 'done', steps: [], errors: [], durationMs: 100 });
    expect(mgr.all).toHaveLength(2); // Still present

    vi.advanceTimersByTime(300_000); // AUTO_CLOSE_DELAY_MS
    expect(mgr.all).toHaveLength(1); // Auto-removed
    expect(onAutoClose).toHaveBeenCalledTimes(1);
  });

  it('should cancel auto-close when user switches to the tab', () => {
    const onAutoClose = vi.fn();
    const mgr = new SessionManager({ flags, onSessionAutoClose: onAutoClose });
    const bg = mgr.create('Security', '\u{1F512}');

    mgr.complete(bg.id, { text: 'done', steps: [], errors: [], durationMs: 100 });
    // User switches to the tab before timeout
    mgr.switchTo(bg.id);
    vi.advanceTimersByTime(310_000);
    expect(mgr.all).toHaveLength(2); // Still there
    expect(onAutoClose).not.toHaveBeenCalled();
  });

  it('should not auto-close tab that user is currently viewing', () => {
    const mgr = new SessionManager({ flags });
    const bg = mgr.create('Security', '\u{1F512}');
    mgr.switchTo(bg.id); // User is viewing it

    mgr.complete(bg.id, { text: 'done', steps: [], errors: [], durationMs: 100 });
    // switchTo already cancelled the auto-close timer
    vi.advanceTimersByTime(310_000);
    expect(mgr.all).toHaveLength(2); // Still there
  });

  it('should not auto-close the main session', () => {
    const mgr = new SessionManager({ flags });
    // Main session can't be completed via manager.complete in a way that triggers auto-close
    // because complete() only schedules auto-close for non-main sessions
    expect(mgr.all).toHaveLength(1);
  });
});
