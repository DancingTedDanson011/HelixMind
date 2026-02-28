import { describe, it, expect } from 'vitest';
import { PermissionManager } from '../../../src/cli/agent/permissions.js';

describe('PermissionManager', () => {
  it('should auto-allow read operations', async () => {
    const pm = new PermissionManager();
    expect(await pm.check('read_file', { path: 'test.ts' }, () => {})).toBe(true);
    expect(await pm.check('list_directory', { path: '.' }, () => {})).toBe(true);
    expect(await pm.check('search_files', { pattern: 'foo' }, () => {})).toBe(true);
    expect(await pm.check('find_files', { pattern: '*.ts' }, () => {})).toBe(true);
    expect(await pm.check('git_status', {}, () => {})).toBe(true);
    expect(await pm.check('git_log', {}, () => {})).toBe(true);
    expect(await pm.check('git_diff', {}, () => {})).toBe(true);
    expect(await pm.check('spiral_query', { query: 'test' }, () => {})).toBe(true);
  });

  it('should auto-allow write operations in YOLO mode', async () => {
    const pm = new PermissionManager();
    pm.setYolo(true);
    expect(await pm.check('edit_file', { path: 'test.ts' }, () => {})).toBe(true);
    expect(await pm.check('write_file', { path: 'test.ts' }, () => {})).toBe(true);
    expect(await pm.check('git_commit', { message: 'test' }, () => {})).toBe(true);
  });

  it('should auto-allow non-interactive without readline', async () => {
    const pm = new PermissionManager();
    // No readline = non-interactive = auto-allow all
    expect(await pm.check('edit_file', { path: 'test.ts' }, () => {})).toBe(true);
    expect(await pm.check('run_command', { command: 'npm test' }, () => {})).toBe(true);
  });

  it('should track YOLO mode', () => {
    const pm = new PermissionManager();
    expect(pm.isYolo()).toBe(false);
    pm.setYolo(true);
    expect(pm.isYolo()).toBe(true);
    pm.setYolo(false);
    expect(pm.isYolo()).toBe(false);
  });

  it('should track skip-permissions mode', () => {
    const pm = new PermissionManager();
    expect(pm.isSkipPermissions()).toBe(false);
    pm.setSkipPermissions(true);
    expect(pm.isSkipPermissions()).toBe(true);
    pm.setSkipPermissions(false);
    expect(pm.isSkipPermissions()).toBe(false);
  });

  it('should auto-allow ask-level tools in skip-permissions mode', async () => {
    const pm = new PermissionManager();
    pm.setSkipPermissions(true);
    // Without readline, these would auto-allow anyway, but skip-permissions
    // should explicitly auto-allow 'ask' level without prompting
    expect(await pm.check('edit_file', { path: 'test.ts' }, () => {})).toBe(true);
    expect(await pm.check('write_file', { path: 'test.ts' }, () => {})).toBe(true);
    expect(await pm.check('git_commit', { message: 'test' }, () => {})).toBe(true);
  });

  it('should auto-allow everything in YOLO mode including dangerous', async () => {
    const pm = new PermissionManager();
    pm.setYolo(true);
    // YOLO mode allows dangerous commands too (no readline = auto-allow as fallback)
    expect(await pm.check('run_command', { command: 'rm -rf /tmp/test' }, () => {})).toBe(true);
    expect(await pm.check('run_command', { command: 'sudo apt install foo' }, () => {})).toBe(true);
  });

  it('should format write_file detail with line count', () => {
    const pm = new PermissionManager();
    const detail = (pm as any).formatToolDetail('write_file', {
      path: 'src/main.ts',
      content: 'const x = 1;\nconst y = 2;\nconst z = 3;',
    });
    expect(detail).toContain('Write file');
    expect(detail).toContain('src/main.ts');
    expect(detail).toContain('3 lines');
  });

  it('should format edit_file detail with diff preview', () => {
    const pm = new PermissionManager();
    const detail = (pm as any).formatToolDetail('edit_file', {
      path: 'src/app.ts',
      old_string: 'const OLD = true;',
      new_string: 'const NEW = false;',
    });
    expect(detail).toContain('Edit file');
    expect(detail).toContain('src/app.ts');
    expect(detail).toContain('const OLD');
    expect(detail).toContain('const NEW');
  });

  it('should format run_command detail', () => {
    const pm = new PermissionManager();
    const detail = (pm as any).formatToolDetail('run_command', {
      command: 'npm install express',
    });
    expect(detail).toContain('Run command');
    expect(detail).toContain('npm install express');
  });

  it('should format git_commit detail', () => {
    const pm = new PermissionManager();
    const detail = (pm as any).formatToolDetail('git_commit', {
      message: 'feat: add new feature',
    });
    expect(detail).toContain('Git commit');
    expect(detail).toContain('feat: add new feature');
  });

  it('should return correct mode label', () => {
    const pm = new PermissionManager();
    expect(pm.getModeLabel()).toBe('safe');

    pm.setSkipPermissions(true);
    expect(pm.getModeLabel()).toBe('skip');

    pm.setYolo(true);
    expect(pm.getModeLabel()).toBe('yolo');

    pm.setYolo(false);
    expect(pm.getModeLabel()).toBe('skip');

    pm.setSkipPermissions(false);
    expect(pm.getModeLabel()).toBe('safe');
  });
});
