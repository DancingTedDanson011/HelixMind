import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the menu logic by simulating stdin data events.
// selectMenu puts stdin in raw mode and listens for 'data' events.

describe('selectMenu', () => {
  let dataListeners: ((data: Buffer) => void)[];
  let stdoutOutput: string;

  beforeEach(() => {
    stdoutOutput = '';
    dataListeners = [];

    // Mock stdout.write
    vi.spyOn(process.stdout, 'write').mockImplementation((data: any) => {
      stdoutOutput += String(data);
      return true;
    });

    // Ensure isTTY is set
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    // Track stdin.on('data') listeners
    vi.spyOn(process.stdin, 'on').mockImplementation((event: string, fn: any) => {
      if (event === 'data') dataListeners.push(fn);
      return process.stdin;
    });

    vi.spyOn(process.stdin, 'removeListener').mockImplementation(() => process.stdin);
    vi.spyOn(process.stdin, 'resume').mockImplementation(() => process.stdin);

    // Make stdin think it's a TTY with setRawMode
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdin, 'isRaw', { value: false, configurable: true, writable: true });

    // Define setRawMode if it doesn't exist (test env)
    if (!(process.stdin as any).setRawMode) {
      (process.stdin as any).setRawMode = () => process.stdin;
    }
    vi.spyOn(process.stdin as any, 'setRawMode').mockImplementation(() => process.stdin);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function sendKey(key: string): void {
    const buf = Buffer.from(key);
    for (const fn of dataListeners) fn(buf);
  }

  it('should return selected index on Enter', async () => {
    const { selectMenu } = await import('../../../src/cli/ui/select-menu.js');

    const promise = selectMenu([
      { label: 'Option A' },
      { label: 'Option B' },
      { label: 'Option C' },
    ]);

    // Default cursor is at 0 — press Enter
    sendKey('\r');
    const result = await promise;
    expect(result).toBe(0);
  });

  it('should navigate down and select', async () => {
    const { selectMenu } = await import('../../../src/cli/ui/select-menu.js');

    const promise = selectMenu([
      { label: 'Option A' },
      { label: 'Option B' },
    ]);

    // Arrow down then Enter
    sendKey('\x1b[B'); // down
    sendKey('\r');      // enter
    const result = await promise;
    expect(result).toBe(1);
  });

  it('should return -1 on ESC', async () => {
    const { selectMenu } = await import('../../../src/cli/ui/select-menu.js');

    const promise = selectMenu([
      { label: 'Option A' },
    ]);

    sendKey('\x1b');
    const result = await promise;
    expect(result).toBe(-1);
  });

  it('should return -1 on Ctrl+C', async () => {
    const { selectMenu } = await import('../../../src/cli/ui/select-menu.js');

    const promise = selectMenu([
      { label: 'Option A' },
    ]);

    sendKey('\x03');
    const result = await promise;
    expect(result).toBe(-1);
  });

  it('should return -1 on q key', async () => {
    const { selectMenu } = await import('../../../src/cli/ui/select-menu.js');

    const promise = selectMenu([
      { label: 'Option A' },
    ]);

    sendKey('q');
    const result = await promise;
    expect(result).toBe(-1);
  });

  it('should select item by shortcut key', async () => {
    const { selectMenu } = await import('../../../src/cli/ui/select-menu.js');

    const promise = selectMenu([
      { label: 'Add', key: 'a' },
      { label: 'Delete', key: 'd' },
    ]);

    sendKey('d');
    const result = await promise;
    expect(result).toBe(1);
  });

  it('should skip disabled items when navigating', async () => {
    const { selectMenu } = await import('../../../src/cli/ui/select-menu.js');

    const promise = selectMenu([
      { label: 'A' },
      { label: 'B (disabled)', disabled: true },
      { label: 'C' },
    ]);

    // Down from A should skip B and land on C
    sendKey('\x1b[B');
    sendKey('\r');
    const result = await promise;
    expect(result).toBe(2);
  });

  it('should not go below last enabled item', async () => {
    const { selectMenu } = await import('../../../src/cli/ui/select-menu.js');

    const promise = selectMenu([
      { label: 'A' },
      { label: 'B' },
    ]);

    // Press down 5 times — should clamp to last item
    sendKey('\x1b[B');
    sendKey('\x1b[B');
    sendKey('\x1b[B');
    sendKey('\x1b[B');
    sendKey('\x1b[B');
    sendKey('\r');
    const result = await promise;
    expect(result).toBe(1);
  });

  it('should render item labels', async () => {
    const { selectMenu } = await import('../../../src/cli/ui/select-menu.js');

    const promise = selectMenu([
      { label: 'Alpha', description: 'First option' },
      { label: 'Beta' },
    ]);

    // Give it a tick to render
    await new Promise(r => setTimeout(r, 10));

    sendKey('\r');
    await promise;

    expect(stdoutOutput).toContain('Alpha');
    expect(stdoutOutput).toContain('Beta');
  });

  it('should return -1 for empty enabled items', async () => {
    const { selectMenu } = await import('../../../src/cli/ui/select-menu.js');

    const result = await selectMenu([
      { label: 'Disabled', disabled: true },
    ]);

    expect(result).toBe(-1);
  });
});
