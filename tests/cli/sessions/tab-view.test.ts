import { describe, it, expect } from 'vitest';
import { Session } from '../../../src/cli/sessions/session.js';
import { renderTabBar, renderSessionList, renderSessionNotification } from '../../../src/cli/sessions/tab-view.js';

describe('Tab View', () => {
  const flags = { yolo: false, skipPermissions: false };

  it('should return empty string for single session', () => {
    const main = new Session('main', 'Chat', '\u{1F4AC}', flags);
    const result = renderTabBar([main], 'main');
    expect(result).toBe('');
  });

  it('should render tabs for multiple sessions', () => {
    const main = new Session('main', 'Chat', '\u{1F4AC}', flags);
    const bg = new Session('abc', 'Security', '\u{1F512}', flags);
    bg.status = 'running';

    const result = renderTabBar([main, bg], 'main');
    expect(result).toContain('Chat');
    expect(result).toContain('Security');
  });

  it('should highlight the active tab', () => {
    const main = new Session('main', 'Chat', '\u{1F4AC}', flags);
    const bg = new Session('abc', 'Security', '\u{1F512}', flags);
    bg.status = 'done';

    const result = renderTabBar([main, bg], 'main');
    // Active tab should have box characters
    expect(result).toContain('\u250C');
    expect(result).toContain('\u2510');
  });

  it('should render session notification', () => {
    const session = new Session('abc', 'Security', '\u{1F512}', flags);
    session.start();
    session.complete({
      text: 'Found 3 issues and fixed 2.',
      steps: [
        { num: 1, tool: 'read_file', label: 'reading file', status: 'done' },
        { num: 2, tool: 'edit_file', label: 'editing file', status: 'done' },
      ],
      errors: [],
      durationMs: 5000,
    });

    const notification = renderSessionNotification(session);
    expect(notification).toContain('Security');
    expect(notification).toContain('\u2705'); // checkmark for done
    expect(notification).toContain('2 steps completed');
    expect(notification).toContain('/sessions');
  });

  it('should render session list', () => {
    const main = new Session('main', 'Chat', '\u{1F4AC}', flags);
    const bg = new Session('abc', 'Security', '\u{1F512}', flags);
    bg.status = 'done';

    const list = renderSessionList([main, bg], 'main');
    expect(list).toContain('Sessions');
    expect(list).toContain('Chat');
    expect(list).toContain('Security');
    expect(list).toContain('[main]');
    expect(list).toContain('[abc]');
    expect(list).toContain('\u25B6'); // Active marker
  });
});
