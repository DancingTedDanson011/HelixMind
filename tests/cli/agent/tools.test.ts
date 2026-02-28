import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { initializeTools, getTool, getAllToolDefinitions, type ToolContext } from '../../../src/cli/agent/tools/registry.js';
import { UndoStack } from '../../../src/cli/agent/undo.js';

let testDir: string;
let ctx: ToolContext;

beforeAll(async () => {
  await initializeTools();
});

beforeEach(() => {
  testDir = join(tmpdir(), `helixmind-tool-test-${randomUUID()}`);
  mkdirSync(testDir, { recursive: true });
  ctx = {
    projectRoot: testDir,
    undoStack: new UndoStack(),
  };
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
});

describe('Tool Registry', () => {
  it('should have all 14 tools registered', () => {
    const defs = getAllToolDefinitions();
    expect(defs.length).toBe(14);
    expect(defs.map(d => d.name)).toContain('read_file');
    expect(defs.map(d => d.name)).toContain('write_file');
    expect(defs.map(d => d.name)).toContain('edit_file');
    expect(defs.map(d => d.name)).toContain('list_directory');
    expect(defs.map(d => d.name)).toContain('search_files');
    expect(defs.map(d => d.name)).toContain('find_files');
    expect(defs.map(d => d.name)).toContain('run_command');
    expect(defs.map(d => d.name)).toContain('git_status');
    expect(defs.map(d => d.name)).toContain('git_diff');
    expect(defs.map(d => d.name)).toContain('git_commit');
    expect(defs.map(d => d.name)).toContain('git_log');
    expect(defs.map(d => d.name)).toContain('spiral_query');
    expect(defs.map(d => d.name)).toContain('spiral_store');
    expect(defs.map(d => d.name)).toContain('web_research');
  });

  it('should have valid tool definitions with input_schema', () => {
    const defs = getAllToolDefinitions();
    for (const def of defs) {
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.input_schema.type).toBe('object');
    }
  });
});

describe('read_file', () => {
  it('should read a file with line numbers', async () => {
    writeFileSync(join(testDir, 'test.ts'), 'line 1\nline 2\nline 3', 'utf-8');
    const tool = getTool('read_file')!;
    const result = await tool.execute({ path: 'test.ts' }, ctx);
    expect(result).toContain('line 1');
    expect(result).toContain('line 2');
    expect(result).toContain('3 lines');
  });

  it('should read specific line range', async () => {
    writeFileSync(join(testDir, 'big.ts'), 'a\nb\nc\nd\ne', 'utf-8');
    const tool = getTool('read_file')!;
    const result = await tool.execute({ path: 'big.ts', start_line: 2, end_line: 4 }, ctx);
    expect(result).toContain('b');
    expect(result).toContain('c');
    expect(result).toContain('d');
    expect(result).toContain('Showing lines 2-4');
  });

  it('should reject paths outside project', async () => {
    const tool = getTool('read_file')!;
    await expect(tool.execute({ path: '../../etc/passwd' }, ctx)).rejects.toThrow('outside');
  });
});

describe('write_file', () => {
  it('should create a new file', async () => {
    const tool = getTool('write_file')!;
    const result = await tool.execute({ path: 'new.ts', content: 'hello world' }, ctx);
    expect(result).toContain('created');
    expect(readFileSync(join(testDir, 'new.ts'), 'utf-8')).toBe('hello world');
  });

  it('should overwrite existing file', async () => {
    writeFileSync(join(testDir, 'old.ts'), 'old content', 'utf-8');
    const tool = getTool('write_file')!;
    const result = await tool.execute({ path: 'old.ts', content: 'new content' }, ctx);
    expect(result).toContain('overwritten');
    expect(readFileSync(join(testDir, 'old.ts'), 'utf-8')).toBe('new content');
  });

  it('should create parent directories', async () => {
    const tool = getTool('write_file')!;
    await tool.execute({ path: 'deep/nested/file.ts', content: 'test' }, ctx);
    expect(readFileSync(join(testDir, 'deep/nested/file.ts'), 'utf-8')).toBe('test');
  });

  it('should push to undo stack', async () => {
    const tool = getTool('write_file')!;
    await tool.execute({ path: 'undo-test.ts', content: 'content' }, ctx);
    expect(ctx.undoStack.size).toBe(1);
  });
});

describe('edit_file', () => {
  it('should replace a unique string', async () => {
    writeFileSync(join(testDir, 'edit.ts'), 'function hello() {\n  return "world";\n}', 'utf-8');
    const tool = getTool('edit_file')!;
    const result = await tool.execute({
      path: 'edit.ts',
      old_string: 'return "world"',
      new_string: 'return "universe"',
    }, ctx);
    expect(result).toContain('edited');
    expect(readFileSync(join(testDir, 'edit.ts'), 'utf-8')).toContain('universe');
  });

  it('should error if old_string not found', async () => {
    writeFileSync(join(testDir, 'nofind.ts'), 'some content', 'utf-8');
    const tool = getTool('edit_file')!;
    const result = await tool.execute({
      path: 'nofind.ts',
      old_string: 'nonexistent',
      new_string: 'replacement',
    }, ctx);
    expect(result).toContain('not found');
  });

  it('should error if old_string is not unique', async () => {
    writeFileSync(join(testDir, 'dup.ts'), 'a = 1;\nb = 1;\n', 'utf-8');
    const tool = getTool('edit_file')!;
    const result = await tool.execute({
      path: 'dup.ts',
      old_string: '= 1',
      new_string: '= 2',
    }, ctx);
    expect(result).toContain('2 times');
  });

  it('should push to undo stack', async () => {
    writeFileSync(join(testDir, 'undo-edit.ts'), 'old value', 'utf-8');
    const tool = getTool('edit_file')!;
    await tool.execute({
      path: 'undo-edit.ts',
      old_string: 'old value',
      new_string: 'new value',
    }, ctx);
    expect(ctx.undoStack.size).toBe(1);
  });
});

describe('list_directory', () => {
  it('should list files and directories', async () => {
    writeFileSync(join(testDir, 'file.ts'), 'test', 'utf-8');
    mkdirSync(join(testDir, 'subdir'));
    writeFileSync(join(testDir, 'subdir', 'inner.ts'), 'inner', 'utf-8');

    const tool = getTool('list_directory')!;
    const result = await tool.execute({ path: '.' }, ctx);
    expect(result).toContain('file.ts');
    expect(result).toContain('subdir/');
  });

  it('should list recursively', async () => {
    mkdirSync(join(testDir, 'a'));
    writeFileSync(join(testDir, 'a', 'deep.ts'), 'deep', 'utf-8');

    const tool = getTool('list_directory')!;
    const result = await tool.execute({ path: '.', recursive: true }, ctx);
    expect(result).toContain('deep.ts');
  });
});

describe('search_files', () => {
  it('should find matching lines', async () => {
    writeFileSync(join(testDir, 'app.ts'), 'function hello() {\n  console.log("world");\n}', 'utf-8');
    const tool = getTool('search_files')!;
    const result = await tool.execute({ pattern: 'console\\.log' }, ctx);
    expect(result).toContain('console.log');
    expect(result).toContain('app.ts');
  });

  it('should report no matches', async () => {
    writeFileSync(join(testDir, 'empty.ts'), 'no match here', 'utf-8');
    const tool = getTool('search_files')!;
    const result = await tool.execute({ pattern: 'zzzzz' }, ctx);
    expect(result).toContain('No matches');
  });
});

describe('find_files', () => {
  it('should find files by glob', async () => {
    writeFileSync(join(testDir, 'a.ts'), '', 'utf-8');
    writeFileSync(join(testDir, 'b.ts'), '', 'utf-8');
    writeFileSync(join(testDir, 'c.js'), '', 'utf-8');

    const tool = getTool('find_files')!;
    const result = await tool.execute({ pattern: '*.ts' }, ctx);
    expect(result).toContain('a.ts');
    expect(result).toContain('b.ts');
    expect(result).not.toContain('c.js');
  });
});

describe('run_command', () => {
  it('should execute a command and return output', async () => {
    const tool = getTool('run_command')!;
    const result = await tool.execute({ command: 'echo hello' }, ctx);
    expect(result).toContain('hello');
    expect(result).toContain('Exit code: 0');
  });

  it('should handle command failure', async () => {
    const tool = getTool('run_command')!;
    const result = await tool.execute({ command: 'exit 1' }, ctx);
    expect(result).toContain('Exit code: 1');
  });

  it('should block dangerous commands', async () => {
    const tool = getTool('run_command')!;
    // Fork bomb is blocked
    const result = await tool.execute({ command: ':(){ :|:& };' }, ctx);
    expect(result).toContain('blocked');
  });
});

describe('spiral_query', () => {
  it('should return message when spiral not available', async () => {
    const tool = getTool('spiral_query')!;
    const result = await tool.execute({ query: 'test' }, ctx);
    expect(result).toContain('not available');
  });
});

describe('spiral_store', () => {
  it('should return message when spiral not available', async () => {
    const tool = getTool('spiral_store')!;
    const result = await tool.execute({ content: 'test', type: 'code' }, ctx);
    expect(result).toContain('not available');
  });
});
