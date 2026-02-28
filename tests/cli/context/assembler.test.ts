import { describe, it, expect } from 'vitest';
import { assembleSystemPrompt } from '../../../src/cli/context/assembler.js';
import type { ProjectInfo } from '../../../src/cli/context/project.js';
import type { SpiralQueryResult } from '../../../src/types.js';

const mockProject: ProjectInfo = {
  name: 'test-app',
  type: 'node',
  frameworks: ['react', 'tailwindcss'],
  files: [
    { path: 'src/index.ts', size: 100 },
    { path: 'src/app.tsx', size: 200 },
  ],
  summary: 'Project: test-app\nType: node\nFrameworks: react, tailwindcss',
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
    { id: '1', type: 'code', content: 'useState hook pattern', relevance: 0.9 },
  ],
  level_2: [
    { id: '2', type: 'pattern', content: 'Component structure convention', relevance: 0.5 },
  ],
  level_3: [
    { id: '3', type: 'decision', content: 'Chose React over Vue', relevance: 0.2 },
  ],
  level_4: [],
  level_5: [],
  total_tokens: 150,
  node_count: 3,
};

describe('assembleSystemPrompt', () => {
  it('should include base instructions', () => {
    const prompt = assembleSystemPrompt(null, emptySpiralResult);
    expect(prompt).toContain('HelixMind');
    expect(prompt).toContain('coding');
  });

  it('should include project context when available', () => {
    const prompt = assembleSystemPrompt(mockProject, emptySpiralResult);
    expect(prompt).toContain('test-app');
    expect(prompt).toContain('react');
    expect(prompt).toContain('tailwindcss');
  });

  it('should include spiral L1 context', () => {
    const prompt = assembleSystemPrompt(null, richSpiralResult);
    expect(prompt).toContain('useState hook pattern');
  });

  it('should include spiral L2 context', () => {
    const prompt = assembleSystemPrompt(null, richSpiralResult);
    expect(prompt).toContain('Component structure convention');
  });

  it('should include spiral L3 context', () => {
    const prompt = assembleSystemPrompt(null, richSpiralResult);
    expect(prompt).toContain('Chose React over Vue');
  });

  it('should work with no project and no spiral', () => {
    const prompt = assembleSystemPrompt(null, emptySpiralResult);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('should combine project + spiral', () => {
    const prompt = assembleSystemPrompt(mockProject, richSpiralResult);
    expect(prompt).toContain('test-app');
    expect(prompt).toContain('useState hook pattern');
    expect(prompt).toContain('Component structure convention');
  });
});
