import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// Mock dataset loader
vi.mock('../../../src/cli/bench/dataset.js', () => ({
  loadDataset: vi.fn().mockResolvedValue([
    {
      instance_id: 'repo__issue-1',
      repo: 'test/repo',
      base_commit: 'aaa111',
      problem_statement: 'Bug 1',
      hints_text: '',
      patch: '',
      test_patch: '',
      FAIL_TO_PASS: '[]',
      PASS_TO_PASS: '[]',
      version: '1.0',
      environment_setup_commit: '',
      created_at: '2024-01-01',
    },
    {
      instance_id: 'repo__issue-2',
      repo: 'test/repo',
      base_commit: 'bbb222',
      problem_statement: 'Bug 2',
      hints_text: '',
      patch: '',
      test_patch: '',
      FAIL_TO_PASS: '[]',
      PASS_TO_PASS: '[]',
      version: '1.0',
      environment_setup_commit: '',
      created_at: '2024-01-02',
    },
  ]),
}));

// Mock runner
const mockRunSingleTask = vi.fn().mockResolvedValue({
  instance_id: 'repo__issue-1',
  status: 'resolved',
  model_patch: 'diff',
  tokens: { input: 1000, output: 500 },
  toolCalls: 5,
  steps: [],
  errors: [],
  durationMs: 10000,
  agentText: 'Fixed.',
});

vi.mock('../../../src/cli/bench/runner.js', () => ({
  runSingleTask: (...args: any[]) => mockRunSingleTask(...args),
}));

// Mock output
const mockGetCompletedTaskIds = vi.fn().mockReturnValue(new Set<string>());

vi.mock('../../../src/cli/bench/output.js', () => ({
  appendPrediction: vi.fn(),
  appendTaskResult: vi.fn(),
  writeSummary: vi.fn(),
  getCompletedTaskIds: (...args: any[]) => mockGetCompletedTaskIds(...args),
}));

// Mock SpiralEngine
const mockSpiralEvolve = vi.fn();
const mockSpiralClose = vi.fn();
const mockSpiralInitialize = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../src/spiral/engine.js', () => ({
  SpiralEngine: vi.fn().mockImplementation(() => ({
    initialize: mockSpiralInitialize,
    evolve: mockSpiralEvolve,
    close: mockSpiralClose,
    store: vi.fn().mockResolvedValue({ node_id: 'n1', level: 1, connections: 0, token_count: 10 }),
    query: vi.fn().mockResolvedValue({ level_1: [], level_2: [], level_3: [], level_4: [], level_5: [], total_tokens: 0, node_count: 0 }),
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

import type { BenchConfig } from '../../../src/cli/bench/types.js';
import { runBenchmark } from '../../../src/cli/bench/harness.js';

function makeConfig(overrides: Partial<BenchConfig> = {}): BenchConfig {
  const outputDir = join(tmpdir(), `bench-harness-${randomUUID()}`);
  mkdirSync(outputDir, { recursive: true });
  return {
    dataset: 'lite',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    apiKey: 'test-key',
    maxIterations: 10,
    timeoutSeconds: 60,
    parallelism: 1,
    outputDir,
    runId: `test-${randomUUID().slice(0, 6)}`,
    ...overrides,
  };
}

describe('runBenchmark harness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass no sharedSpiral for naked runs', async () => {
    const config = makeConfig();
    await runBenchmark(config);

    // runSingleTask should have been called without sharedSpiral (4th arg undefined)
    for (const call of mockRunSingleTask.mock.calls) {
      expect(call[3]).toBeUndefined();
    }
  });

  it('should create and pass shared spiral in learning mode', async () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'learning' });
    await runBenchmark(config);

    // SpiralEngine should have been initialized
    expect(mockSpiralInitialize).toHaveBeenCalled();

    // runSingleTask should receive a shared spiral (4th argument)
    for (const call of mockRunSingleTask.mock.calls) {
      expect(call[3]).toBeDefined();
    }
  });

  it('should evolve spiral after each task in learning mode', async () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'learning' });
    await runBenchmark(config);

    // evolve should be called once per task (2 tasks in mock dataset)
    expect(mockSpiralEvolve).toHaveBeenCalledTimes(2);
  });

  it('should NOT evolve spiral in naked mode', async () => {
    const config = makeConfig();
    await runBenchmark(config);

    expect(mockSpiralEvolve).not.toHaveBeenCalled();
  });

  it('should close shared spiral after all tasks', async () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'learning' });
    await runBenchmark(config);

    expect(mockSpiralClose).toHaveBeenCalled();
  });

  it('should NOT create shared spiral for fresh mode', async () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'fresh' });
    mockSpiralInitialize.mockClear();

    await runBenchmark(config);

    // In fresh mode, harness does NOT create a shared spiral
    // (runner creates its own per-task spiral)
    expect(mockSpiralInitialize).not.toHaveBeenCalled();
    for (const call of mockRunSingleTask.mock.calls) {
      expect(call[3]).toBeUndefined();
    }
  });

  it('should include spiralMode in metrics for spiral runs', async () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'learning' });
    const metrics = await runBenchmark(config);

    expect(metrics.spiralMode).toBe('learning');
  });

  it('should not include spiralMode in metrics for naked runs', async () => {
    const config = makeConfig();
    const metrics = await runBenchmark(config);

    expect(metrics.spiralMode).toBeUndefined();
  });

  it('should call onTaskStart and onTaskEnd callbacks', async () => {
    const config = makeConfig();
    const starts: number[] = [];
    const ends: number[] = [];

    await runBenchmark(
      config,
      (_task, i) => starts.push(i),
      (_result, i) => ends.push(i),
    );

    expect(starts).toEqual([0, 1]);
    expect(ends).toEqual([0, 1]);
  });

  it('should close shared spiral even if tasks throw', async () => {
    mockRunSingleTask.mockRejectedValueOnce(new Error('Task exploded'));

    const config = makeConfig({ withSpiral: true, spiralMode: 'learning' });

    await expect(runBenchmark(config)).rejects.toThrow('Task exploded');
    expect(mockSpiralClose).toHaveBeenCalled();
  });

  it('should skip already-completed tasks when resuming', async () => {
    // Simulate that repo__issue-1 was already completed
    mockGetCompletedTaskIds.mockReturnValue(new Set(['repo__issue-1']));

    const config = makeConfig({ resumeRunId: 'previous-run' });
    await runBenchmark(config);

    // Only repo__issue-2 should have been run
    expect(mockRunSingleTask).toHaveBeenCalledTimes(1);
    expect(mockRunSingleTask.mock.calls[0][0].instance_id).toBe('repo__issue-2');
  });

  it('should run all tasks when no resume and no completed', async () => {
    mockGetCompletedTaskIds.mockReturnValue(new Set());

    const config = makeConfig();
    await runBenchmark(config);

    expect(mockRunSingleTask).toHaveBeenCalledTimes(2);
  });

  it('should skip all tasks when all are already completed', async () => {
    mockGetCompletedTaskIds.mockReturnValue(new Set(['repo__issue-1', 'repo__issue-2']));

    const config = makeConfig({ resumeRunId: 'previous-run' });
    await runBenchmark(config);

    expect(mockRunSingleTask).not.toHaveBeenCalled();
  });

  it('should store run summary in spiral brain after learning run', async () => {
    const mockStore = vi.fn().mockResolvedValue({ node_id: 'n1', level: 1, connections: 0, token_count: 10 });
    const { SpiralEngine } = await import('../../../src/spiral/engine.js');
    // Override store for this test
    (SpiralEngine as any).mockImplementation(() => ({
      initialize: mockSpiralInitialize,
      evolve: mockSpiralEvolve,
      close: mockSpiralClose,
      store: mockStore,
      query: vi.fn().mockResolvedValue({ level_1: [], level_2: [], level_3: [], level_4: [], level_5: [], total_tokens: 0, node_count: 0 }),
    }));

    const config = makeConfig({ withSpiral: true, spiralMode: 'learning' });
    await runBenchmark(config);

    // Should have stored a summary after all tasks
    const summaryCalls = mockStore.mock.calls.filter(
      (call: any[]) => call[1] === 'summary',
    );
    expect(summaryCalls.length).toBeGreaterThanOrEqual(1);
    expect(summaryCalls[0][0]).toContain('SWE-bench run completed');
  });
});
