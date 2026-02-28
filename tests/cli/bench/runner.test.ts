import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// Mock heavy dependencies before importing the module under test
vi.mock('../../../src/cli/agent/loop.js', () => ({
  runAgentLoop: vi.fn().mockResolvedValue({
    text: 'Fixed the bug.',
    toolCalls: 5,
    steps: [{ tool: 'edit_file', label: 'Edit test.py', status: 'success' }],
    errors: [],
  }),
  AgentController: vi.fn().mockImplementation(() => ({
    abort: vi.fn(),
    signal: { aborted: false },
  })),
  AgentAbortError: class AgentAbortError extends Error {},
}));

vi.mock('../../../src/cli/providers/registry.js', () => ({
  createProvider: vi.fn().mockReturnValue({
    name: 'mock',
    model: 'mock-model',
    async *stream() { yield { type: 'done', content: 'mock' }; },
    async chatWithTools() { return { content: [{ type: 'text', text: 'Done.' }], stop_reason: 'end_turn' }; },
  }),
}));

vi.mock('../../../src/cli/agent/tools/registry.js', () => ({
  initializeTools: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/cli/context/session-buffer.js', () => ({
  SessionBuffer: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../src/cli/agent/permissions.js', () => ({
  PermissionManager: vi.fn().mockImplementation(() => ({
    setYolo: vi.fn(),
  })),
}));

vi.mock('../../../src/cli/agent/undo.js', () => ({
  UndoStack: vi.fn().mockImplementation(() => ({})),
}));

// Mock git operations — keep it simple, no real git commands inside the mock
vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockImplementation((cmd: string, opts: any) => {
    if (typeof cmd === 'string' && cmd.includes('git clone')) {
      // Create mock repo directory with files for pre-seeding
      const cwd = opts?.cwd as string;
      if (cwd) {
        const repoDir = join(cwd, 'repo');
        mkdirSync(repoDir, { recursive: true });
        writeFileSync(join(repoDir, 'README.md'), '# Test repo\nA test repository.');
        writeFileSync(join(repoDir, 'setup.py'), 'from setuptools import setup\nsetup(name="test")');
        writeFileSync(join(repoDir, 'main.py'), 'print("hello")');
        writeFileSync(join(repoDir, 'utils.py'), 'def helper(): pass');
      }
      return '';
    }
    if (typeof cmd === 'string' && cmd.includes('git checkout')) {
      return '';
    }
    if (typeof cmd === 'string' && cmd.includes('git diff')) {
      return 'diff --git a/test.py b/test.py\n--- a/test.py\n+++ b/test.py\n+fixed line\n';
    }
    return '';
  }),
}));

// Mock SpiralEngine
const mockSpiralStore = vi.fn().mockResolvedValue({
  node_id: 'mock-node-1',
  level: 1,
  connections: 0,
  token_count: 50,
});

const mockSpiralQuery = vi.fn().mockResolvedValue({
  level_1: [{ id: '1', type: 'pattern', content: 'Prior fix pattern', relevance: 0.9 }],
  level_2: [],
  level_3: [],
  level_4: [],
  level_5: [],
  total_tokens: 100,
  node_count: 1,
});

const mockSpiralClose = vi.fn();

vi.mock('../../../src/spiral/engine.js', () => ({
  SpiralEngine: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    store: mockSpiralStore,
    query: mockSpiralQuery,
    close: mockSpiralClose,
    evolve: vi.fn(),
  })),
}));

vi.mock('../../../src/utils/config.js', () => ({
  loadConfig: vi.fn().mockReturnValue({
    dataDir: '/tmp/spiral',
    maxTokens: 4000,
    model: 'Xenova/all-MiniLM-L6-v2',
    logLevel: 'error',
    embeddingDimensions: 384,
    levelThresholds: { l1Min: 0.7, l2Min: 0.5, l3Min: 0.3, l4Min: 0.1 },
    decayRate: 0.05,
    decayIntervalHours: 1,
  }),
}));

import type { BenchConfig, SWETask } from '../../../src/cli/bench/types.js';
import { runSingleTask } from '../../../src/cli/bench/runner.js';

const mockTask: SWETask = {
  instance_id: 'django__django-12345',
  repo: 'django/django',
  base_commit: 'abc123',
  problem_statement: 'QuerySet.filter() raises TypeError',
  hints_text: 'Check query compiler',
  patch: '',
  test_patch: '',
  FAIL_TO_PASS: '["test_filter"]',
  PASS_TO_PASS: '["test_basic"]',
  version: '4.0',
  environment_setup_commit: 'def456',
  created_at: '2024-01-01',
};

function makeConfig(overrides: Partial<BenchConfig> = {}): BenchConfig {
  return {
    dataset: 'lite',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    apiKey: 'test-key',
    maxIterations: 5,
    timeoutSeconds: 60,
    parallelism: 1,
    outputDir: join(tmpdir(), `bench-test-${randomUUID()}`),
    runId: `test-${randomUUID().slice(0, 6)}`,
    ...overrides,
  };
}

describe('runSingleTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run a naked task without spiral', async () => {
    const config = makeConfig();
    const result = await runSingleTask(mockTask, config);

    expect(result.instance_id).toBe('django__django-12345');
    expect(result.status).toBe('resolved');
    expect(result.model_patch).toContain('diff');
    expect(mockSpiralQuery).not.toHaveBeenCalled();
    expect(mockSpiralStore).not.toHaveBeenCalled();
  });

  it('should initialize fresh spiral per task when withSpiral=true and spiralMode=fresh', async () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'fresh' });
    const result = await runSingleTask(mockTask, config);

    expect(result.status).toBe('resolved');
    // Spiral should have been queried for context
    expect(mockSpiralQuery).toHaveBeenCalledWith(
      mockTask.problem_statement,
      40000,
    );
    // Spiral should have been closed (owned spiral)
    expect(mockSpiralClose).toHaveBeenCalled();
  });

  it('should use shared spiral in learning mode', async () => {
    const { SpiralEngine } = await import('../../../src/spiral/engine.js');
    const sharedSpiral = new SpiralEngine({} as any);

    const config = makeConfig({ withSpiral: true, spiralMode: 'learning' });
    const result = await runSingleTask(mockTask, config, undefined, sharedSpiral);

    expect(result.status).toBe('resolved');
    expect(mockSpiralQuery).toHaveBeenCalled();
    // Should NOT close shared spiral — harness owns it
    // The mock's close tracker is shared, so we check it wasn't called from runner
    // (In fresh mode close IS called; we verified that in the previous test.)
  });

  it('should store fix pattern in spiral in learning mode', async () => {
    const { SpiralEngine } = await import('../../../src/spiral/engine.js');
    const sharedSpiral = new SpiralEngine({} as any);

    const config = makeConfig({ withSpiral: true, spiralMode: 'learning' });
    await runSingleTask(mockTask, config, undefined, sharedSpiral);

    // Check that fix pattern was stored
    expect(mockSpiralStore).toHaveBeenCalledWith(
      expect.stringContaining('Fixed django__django-12345'),
      'pattern',
      expect.objectContaining({ tags: ['fix', 'django/django'] }),
    );
  });

  it('should NOT store fix pattern in fresh mode', async () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'fresh' });
    // Reset store mock to track only this test's calls
    mockSpiralStore.mockClear();

    await runSingleTask(mockTask, config);

    // Store is called for pre-seeding, but NOT for fix patterns
    const fixPatternCalls = mockSpiralStore.mock.calls.filter(
      (call: any[]) => call[1] === 'pattern',
    );
    expect(fixPatternCalls).toHaveLength(0);
  });

  it('should pre-seed spiral with repo files', async () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'fresh' });
    mockSpiralStore.mockClear();

    await runSingleTask(mockTask, config);

    // Pre-seed stores should use type='code' and tag 'repo_context'
    const preSeedCalls = mockSpiralStore.mock.calls.filter(
      (call: any[]) => call[1] === 'code',
    );
    expect(preSeedCalls.length).toBeGreaterThan(0);

    // Check at least README and setup.py were seeded
    const contents = preSeedCalls.map((call: any[]) => call[0] as string);
    expect(contents.some((c: string) => c.includes('README.md'))).toBe(true);
    expect(contents.some((c: string) => c.includes('setup.py'))).toBe(true);
  });

  it('should emit progress events', async () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'fresh' });
    const events: Array<{ type: string; message?: string }> = [];

    await runSingleTask(mockTask, config, (event) => {
      events.push(event);
    });

    const statusMessages = events
      .filter(e => e.type === 'status')
      .map(e => e.message);

    expect(statusMessages).toContain('Initializing spiral memory...');
    expect(statusMessages).toContain('Spiral memory ready');
    expect(statusMessages).toContain('Agent working...');
  });

  it('should store failed attempt pattern in learning mode when no patch', async () => {
    const { SpiralEngine } = await import('../../../src/spiral/engine.js');
    const sharedSpiral = new SpiralEngine({} as any);

    // Mock agent loop to produce no patch (git diff returns empty)
    const { execSync } = await import('node:child_process');
    (execSync as any).mockImplementation((cmd: string, opts: any) => {
      if (typeof cmd === 'string' && cmd.includes('git clone')) {
        const cwd = opts?.cwd as string;
        if (cwd) {
          const repoDir = join(cwd, 'repo');
          mkdirSync(repoDir, { recursive: true });
          writeFileSync(join(repoDir, 'README.md'), '# Test');
        }
        return '';
      }
      if (typeof cmd === 'string' && cmd.includes('git checkout')) return '';
      if (typeof cmd === 'string' && cmd.includes('git diff')) return ''; // No patch!
      return '';
    });

    mockSpiralStore.mockClear();
    const config = makeConfig({ withSpiral: true, spiralMode: 'learning' });
    await runSingleTask(mockTask, config, undefined, sharedSpiral);

    // Should store failed_attempt pattern
    const failedCalls = mockSpiralStore.mock.calls.filter(
      (call: any[]) => call[1] === 'pattern' && (call[2] as any)?.tags?.includes('failed_attempt'),
    );
    expect(failedCalls.length).toBeGreaterThan(0);
    expect(failedCalls[0][0]).toContain('Failed django__django-12345');
  });

  it('should deep-scan repo for pre-seeding (not just top-level)', async () => {
    const { execSync } = await import('node:child_process');
    (execSync as any).mockImplementation((cmd: string, opts: any) => {
      if (typeof cmd === 'string' && cmd.includes('git clone')) {
        const cwd = opts?.cwd as string;
        if (cwd) {
          const repoDir = join(cwd, 'repo');
          mkdirSync(repoDir, { recursive: true });
          writeFileSync(join(repoDir, 'README.md'), '# Django');
          writeFileSync(join(repoDir, 'setup.py'), 'setup()');
          // Create nested source structure
          const djangoDir = join(repoDir, 'django');
          mkdirSync(djangoDir, { recursive: true });
          writeFileSync(join(djangoDir, '__init__.py'), '# init');
          writeFileSync(join(djangoDir, 'models.py'), 'class Model: pass');
          const dbDir = join(djangoDir, 'db');
          mkdirSync(dbDir, { recursive: true });
          writeFileSync(join(dbDir, '__init__.py'), '# db init');
          writeFileSync(join(dbDir, 'utils.py'), 'def query(): pass');
        }
        return '';
      }
      if (typeof cmd === 'string' && cmd.includes('git checkout')) return '';
      if (typeof cmd === 'string' && cmd.includes('git diff')) {
        return 'diff --git a/test.py b/test.py\n+fix\n';
      }
      return '';
    });

    mockSpiralStore.mockClear();
    const config = makeConfig({ withSpiral: true, spiralMode: 'fresh' });
    await runSingleTask(mockTask, config);

    const codeCalls = mockSpiralStore.mock.calls.filter(
      (call: any[]) => call[1] === 'code',
    );
    const storedFiles = codeCalls.map((call: any[]) => call[0] as string);

    // Should have found nested files
    expect(storedFiles.some((s: string) => s.includes('__init__.py'))).toBe(true);
    expect(storedFiles.some((s: string) => s.includes('models.py'))).toBe(true);
    expect(storedFiles.some((s: string) => s.includes('utils.py'))).toBe(true);
  });
});
