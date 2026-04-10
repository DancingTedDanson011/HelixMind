import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrainExport } from '../../../src/cli/brain/exporter.js';

type MockEngine = { id: string };

function makeExport(
  projectName: string,
  brainScope: 'project' | 'global',
  totalNodes: number,
  totalEdges: number,
): BrainExport {
  return {
    meta: {
      projectName,
      totalNodes,
      totalEdges,
      webKnowledgeCount: 0,
      exportDate: '2026-04-04T00:00:00.000Z',
      brainScope,
    },
    nodes: [],
    edges: [],
  };
}

const mockServer = {
  port: 9420,
  url: 'http://127.0.0.1:9420',
  connectionToken: 'test-token',
  pushUpdate: vi.fn(),
  pushEvent: vi.fn(),
  pushControlEvent: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  onVoiceInput: vi.fn(),
  onScopeSwitch: vi.fn(),
  onModelActivate: vi.fn(),
  registerControlHandlers: vi.fn(),
  setInstanceMeta: vi.fn(),
  close: vi.fn(),
};

const mockStartBrainServer = vi.fn(async () => mockServer);
const mockExportBrainData = vi.fn();

vi.mock('../../../src/cli/brain/server.js', () => ({
  startBrainServer: (...args: any[]) => mockStartBrainServer(...args),
}));

vi.mock('../../../src/cli/brain/exporter.js', () => ({
  exportBrainData: (...args: any[]) => mockExportBrainData(...args),
}));

describe('startLiveBrain', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const mod = await import('../../../src/cli/brain/generator.js');
    mod.stopLiveBrain();
    vi.useRealTimers();
  });

  it('starts polling when a live server gets a spiral engine later', async () => {
    const mod = await import('../../../src/cli/brain/generator.js');
    const engine: MockEngine = { id: 'late-engine' };

    mockExportBrainData
      .mockReturnValueOnce(makeExport('HelixMind Project', 'global', 1, 0))
      .mockReturnValueOnce(makeExport('HelixMind Project', 'global', 2, 1));

    await mod.startLiveBrain(null, 'HelixMind Project', 'global');
    expect(mockStartBrainServer).toHaveBeenCalledTimes(1);
    expect(mockExportBrainData).not.toHaveBeenCalled();

    await mod.startLiveBrain(engine, 'HelixMind Project', 'global');
    expect(mockExportBrainData).toHaveBeenCalledTimes(1);
    expect(mockServer.pushUpdate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockExportBrainData).toHaveBeenCalledTimes(2);
    expect(mockServer.pushUpdate).toHaveBeenCalledTimes(2);
    expect(mockExportBrainData.mock.calls[1]?.[0]).toBe(engine);
  });

  it('rebinds polling when the spiral engine or scope changes', async () => {
    const mod = await import('../../../src/cli/brain/generator.js');
    const engineA: MockEngine = { id: 'engine-a' };
    const engineB: MockEngine = { id: 'engine-b' };
    const counts: Record<string, { nodes: number; edges: number }> = {
      'engine-a': { nodes: 1, edges: 0 },
      'engine-b': { nodes: 10, edges: 5 },
    };

    mockExportBrainData.mockImplementation((engine: MockEngine, projectName: string, brainScope: 'project' | 'global') =>
      makeExport(projectName, brainScope, counts[engine.id].nodes, counts[engine.id].edges),
    );

    await mod.startLiveBrain(engineA, 'HelixMind Project', 'project');
    await vi.advanceTimersByTimeAsync(5000);

    mockServer.pushUpdate.mockClear();
    mockExportBrainData.mockClear();

    await mod.startLiveBrain(engineB, 'HelixMind Project', 'global');
    counts['engine-b'] = { nodes: 11, edges: 6 };

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockServer.pushUpdate).toHaveBeenCalledTimes(2);
    expect(mockExportBrainData.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockExportBrainData.mock.calls.every((call) => call[0] === engineB && call[2] === 'global')).toBe(true);
  });
});
