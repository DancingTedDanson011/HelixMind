import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock process.stdout before importing the module
const writeSpy = vi.fn();
const originalWrite = process.stdout.write;
const originalColumns = process.stdout.columns;

beforeEach(() => {
  process.stdout.write = writeSpy as any;
  // Default terminal width
  Object.defineProperty(process.stdout, 'columns', { value: 80, writable: true, configurable: true });
});

afterEach(() => {
  process.stdout.write = originalWrite;
  Object.defineProperty(process.stdout, 'columns', { value: originalColumns, writable: true, configurable: true });
  writeSpy.mockClear();
});

// Dynamically import so mocks are in place
async function loadModule() {
  // Force fresh import each time
  const mod = await import('../../../src/cli/ui/progress.js');
  return mod;
}

function collectOutput(): string {
  return writeSpy.mock.calls.map((c: any[]) => c[0]).join('');
}

/** Strip ANSI escape codes for content checking */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\].*?\x07/g, '');
}

describe('renderFeedProgress', () => {
  it('should render progress line within terminal width', async () => {
    const { renderFeedProgress } = await loadModule();
    Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });

    renderFeedProgress({
      stage: 'reading',
      current: 5,
      total: 10,
      detail: 'this is a very long detail string that should be truncated to fit the terminal width properly',
      currentFile: 'src/some/very/deeply/nested/directory/structure/file.ts',
    });

    const output = stripAnsi(collectOutput());
    // Each line (split by \r) should fit within 60 chars
    const lines = output.split('\r').filter(Boolean);
    for (const line of lines) {
      const cleaned = line.replace(/\x1b\[K/, '');
      expect(cleaned.length).toBeLessThanOrEqual(60);
    }
  });

  it('should show stage label and percentage', async () => {
    const { renderFeedProgress } = await loadModule();

    renderFeedProgress({
      stage: 'parsing',
      current: 7,
      total: 10,
    });

    const output = stripAnsi(collectOutput());
    expect(output).toContain('Parsing');
    expect(output).toContain('70%');
  });

  it('should show bar characters', async () => {
    const { renderFeedProgress } = await loadModule();

    renderFeedProgress({
      stage: 'scanning',
      current: 5,
      total: 10,
    });

    const output = collectOutput();
    expect(output).toMatch(/[█░]/);
  });
});

describe('renderFeedSummary', () => {
  const baseSummary = {
    filesScanned: 42,
    filesRead: 30,
    nodesCreated: 25,
    relationsCreated: 18,
    modules: [] as Array<{ name: string; files: string[]; description: string }>,
    architecture: 'Modular',
    techStack: ['TypeScript', 'React'],
  };

  it('should render basic stats', async () => {
    const { renderFeedSummary } = await loadModule();

    renderFeedSummary(baseSummary);

    const output = stripAnsi(collectOutput());
    expect(output).toContain('42 files');
    expect(output).toContain('30 relevant');
    expect(output).toContain('25 context nodes');
    expect(output).toContain('18 connections');
  });

  it('should render modules with descriptions on separate lines', async () => {
    const { renderFeedSummary } = await loadModule();

    renderFeedSummary({
      ...baseSummary,
      modules: [
        {
          name: 'engine',
          files: ['a.ts', 'b.ts', 'c.ts'],
          description: '3 files — Classes: SpiralEngine, NodeStore — Functions: init, store, retrieve, search, compact — Patterns: Singleton, Repository',
        },
      ],
    });

    const output = stripAnsi(collectOutput());
    // Module name and file count on header line
    expect(output).toContain('engine (3 files)');
    // Description parts should be on separate lines (Classes, Functions, Patterns)
    expect(output).toContain('Classes:');
    expect(output).toContain('Functions:');
    expect(output).toContain('Patterns:');
  });

  it('should truncate long description parts to terminal width', async () => {
    const { renderFeedSummary } = await loadModule();
    Object.defineProperty(process.stdout, 'columns', { value: 50, configurable: true });

    renderFeedSummary({
      ...baseSummary,
      modules: [
        {
          name: 'test',
          files: ['a.ts'],
          description: '1 files — Functions: veryLongFunctionNameOne, veryLongFunctionNameTwo, veryLongFunctionNameThree, veryLongFunctionNameFour, veryLongFunctionNameFive',
        },
      ],
    });

    const output = stripAnsi(collectOutput());
    const lines = output.split('\n').filter(Boolean);

    // Check that description lines with Functions don't exceed terminal width
    for (const line of lines) {
      if (line.includes('Functions:')) {
        expect(line.length).toBeLessThanOrEqual(50);
      }
    }
  });

  it('should wrap tech stack across lines on narrow terminal', async () => {
    const { renderFeedSummary } = await loadModule();
    Object.defineProperty(process.stdout, 'columns', { value: 40, configurable: true });

    renderFeedSummary({
      ...baseSummary,
      techStack: ['TypeScript', 'React', 'Express', 'PostgreSQL', 'Redis', 'GraphQL', 'Prisma'],
    });

    const output = stripAnsi(collectOutput());
    // Should contain all tech items
    expect(output).toContain('TypeScript');
    expect(output).toContain('Prisma');
    // Stack line should start with "Stack:"
    expect(output).toContain('Stack:');
  });

  it('should render web enrichment info', async () => {
    const { renderFeedSummary } = await loadModule();

    renderFeedSummary({
      ...baseSummary,
      webEnrichment: {
        topics: ['React best practices', 'TypeScript patterns'],
        nodesStored: 5,
        duration_ms: 3000,
      },
    });

    const output = stripAnsi(collectOutput());
    expect(output).toContain('+5 nodes');
    expect(output).toContain('React best practices');
  });

  it('should render tree connectors for multiple modules', async () => {
    const { renderFeedSummary } = await loadModule();

    renderFeedSummary({
      ...baseSummary,
      modules: [
        { name: 'alpha', files: ['a.ts'], description: '1 files — Functions: foo' },
        { name: 'beta', files: ['b.ts'], description: '1 files — Functions: bar' },
      ],
    });

    const output = stripAnsi(collectOutput());
    // First module uses ├─, last uses └─
    expect(output).toContain('\u251C\u2500');
    expect(output).toContain('\u2514\u2500');
  });
});
