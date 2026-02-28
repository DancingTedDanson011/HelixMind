import { describe, it, expect } from 'vitest';
import { buildBenchSystemPrompt, buildBenchSystemPromptWithSpiral } from '../../../src/cli/bench/prompt.js';
import type { SWETask } from '../../../src/cli/bench/types.js';
import type { SpiralQueryResult } from '../../../src/types.js';

const mockTask: SWETask = {
  instance_id: 'django__django-12345',
  repo: 'django/django',
  base_commit: 'abc123',
  problem_statement: 'QuerySet.filter() raises TypeError when using nested lookups with __in',
  hints_text: 'Check the query compiler for nested lookups',
  patch: '',
  test_patch: '',
  FAIL_TO_PASS: '["tests.test_queryset.TestFilter"]',
  PASS_TO_PASS: '["tests.test_queryset.TestBasic"]',
  version: '4.0',
  environment_setup_commit: 'def456',
  created_at: '2024-01-01',
};

const taskNoHints: SWETask = {
  ...mockTask,
  instance_id: 'flask__flask-9999',
  repo: 'pallets/flask',
  hints_text: '',
};

const emptySpiralResult: SpiralQueryResult = {
  level_1: [],
  level_2: [],
  level_3: [],
  level_4: [],
  level_5: [],
  total_tokens: 0,
  node_count: 0,
};

const richSpiralResult: SpiralQueryResult = {
  level_1: [
    { id: '1', type: 'pattern', content: 'Django ORM uses lazy evaluation for querysets', relevance: 0.95 },
    { id: '2', type: 'code', content: 'def resolve_lookup(self, lookup): ...', relevance: 0.9 },
  ],
  level_2: [
    { id: '3', type: 'pattern', content: 'Fixed django__django-11000: similar nested lookup issue', relevance: 0.7 },
  ],
  level_3: [
    { id: '4', type: 'architecture', content: 'Django query compilation pipeline', relevance: 0.4 },
  ],
  level_4: [],
  level_5: [],
  total_tokens: 500,
  node_count: 4,
};

describe('buildBenchSystemPrompt', () => {
  it('should include repo info', () => {
    const prompt = buildBenchSystemPrompt(mockTask, '/tmp/repo');
    expect(prompt).toContain('django/django');
    expect(prompt).toContain('/tmp/repo');
  });

  it('should include problem statement', () => {
    const prompt = buildBenchSystemPrompt(mockTask, '/tmp/repo');
    expect(prompt).toContain('QuerySet.filter()');
    expect(prompt).toContain('nested lookups');
  });

  it('should include hints when available', () => {
    const prompt = buildBenchSystemPrompt(mockTask, '/tmp/repo');
    expect(prompt).toContain('Hints');
    expect(prompt).toContain('query compiler');
  });

  it('should omit hints section when empty', () => {
    const prompt = buildBenchSystemPrompt(taskNoHints, '/tmp/repo');
    expect(prompt).not.toContain('## Hints');
  });

  it('should include SWE-bench rules', () => {
    const prompt = buildBenchSystemPrompt(mockTask, '/tmp/repo');
    expect(prompt).toContain('MINIMAL changes');
    expect(prompt).toContain('Do NOT modify any test files');
    expect(prompt).toContain('Do NOT run the test suite');
  });

  it('should include basic tool list', () => {
    const prompt = buildBenchSystemPrompt(mockTask, '/tmp/repo');
    expect(prompt).toContain('read_file');
    expect(prompt).toContain('edit_file');
    expect(prompt).toContain('search_files');
  });

  it('should NOT include spiral tools', () => {
    const prompt = buildBenchSystemPrompt(mockTask, '/tmp/repo');
    expect(prompt).not.toContain('spiral_query');
    expect(prompt).not.toContain('spiral_store');
  });
});

describe('buildBenchSystemPromptWithSpiral', () => {
  it('should include repo info and problem statement', () => {
    const prompt = buildBenchSystemPromptWithSpiral(mockTask, '/tmp/repo', emptySpiralResult);
    expect(prompt).toContain('django/django');
    expect(prompt).toContain('QuerySet.filter()');
  });

  it('should include hints when available', () => {
    const prompt = buildBenchSystemPromptWithSpiral(mockTask, '/tmp/repo', emptySpiralResult);
    expect(prompt).toContain('Hints');
    expect(prompt).toContain('query compiler');
  });

  it('should omit hints when empty', () => {
    const prompt = buildBenchSystemPromptWithSpiral(taskNoHints, '/tmp/repo', emptySpiralResult);
    expect(prompt).not.toContain('## Hints');
  });

  it('should include spiral context sections when non-empty', () => {
    const prompt = buildBenchSystemPromptWithSpiral(mockTask, '/tmp/repo', richSpiralResult);
    expect(prompt).toContain('Spiral Memory Context');
    expect(prompt).toContain('Focus (highly relevant)');
    expect(prompt).toContain('Active (recent patterns)');
    expect(prompt).toContain('Reference (background)');
  });

  it('should include spiral node content', () => {
    const prompt = buildBenchSystemPromptWithSpiral(mockTask, '/tmp/repo', richSpiralResult);
    expect(prompt).toContain('Django ORM uses lazy evaluation');
    expect(prompt).toContain('resolve_lookup');
    expect(prompt).toContain('django__django-11000');
    expect(prompt).toContain('query compilation pipeline');
  });

  it('should include node type tags', () => {
    const prompt = buildBenchSystemPromptWithSpiral(mockTask, '/tmp/repo', richSpiralResult);
    expect(prompt).toContain('[pattern]');
    expect(prompt).toContain('[code]');
    expect(prompt).toContain('[architecture]');
  });

  it('should NOT include spiral context section heading when empty', () => {
    const prompt = buildBenchSystemPromptWithSpiral(mockTask, '/tmp/repo', emptySpiralResult);
    // The "## Spiral Memory Context" section with nodes should not appear
    expect(prompt).not.toContain('Focus (highly relevant)');
    expect(prompt).not.toContain('Active (recent patterns)');
    expect(prompt).not.toContain('Reference (background)');
  });

  it('should include spiral tools in the tool list', () => {
    const prompt = buildBenchSystemPromptWithSpiral(mockTask, '/tmp/repo', emptySpiralResult);
    expect(prompt).toContain('spiral_query');
    expect(prompt).toContain('spiral_store');
  });

  it('should mention spiral memory in agent identity', () => {
    const prompt = buildBenchSystemPromptWithSpiral(mockTask, '/tmp/repo', emptySpiralResult);
    expect(prompt).toContain('spiral memory');
  });

  it('should include instruction to use spiral_query and spiral_store', () => {
    const prompt = buildBenchSystemPromptWithSpiral(mockTask, '/tmp/repo', emptySpiralResult);
    expect(prompt).toContain('spiral_query');
    expect(prompt).toContain('spiral_store');
    expect(prompt).toContain('fix patterns');
  });

  it('should still include core SWE-bench rules', () => {
    const prompt = buildBenchSystemPromptWithSpiral(mockTask, '/tmp/repo', richSpiralResult);
    expect(prompt).toContain('MINIMAL changes');
    expect(prompt).toContain('Do NOT modify any test files');
    expect(prompt).toContain('Do NOT run the test suite');
    expect(prompt).toContain('edit_file');
  });

  it('should only include L1-L3 in spiral context (not L4/L5)', () => {
    const resultWithL4L5: SpiralQueryResult = {
      ...richSpiralResult,
      level_4: [{ id: '10', type: 'summary', content: 'Deep archive info', relevance: 0.1 }],
      level_5: [{ id: '11', type: 'summary', content: 'Very old info', relevance: 0.05 }],
    };
    const prompt = buildBenchSystemPromptWithSpiral(mockTask, '/tmp/repo', resultWithL4L5);
    // L4/L5 should not appear — they are too noisy for bench prompts
    expect(prompt).not.toContain('Deep archive info');
    expect(prompt).not.toContain('Very old info');
  });
});
