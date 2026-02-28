import { describe, it, expect } from 'vitest';

/**
 * Tests for the Ollama proxy endpoints in brain server.
 * These test the HTML template and API endpoint structure,
 * not actual Ollama connectivity (which needs a running server).
 */

describe('Brain Server - Ollama Integration', () => {
  it('should include model management panel in template', async () => {
    // Dynamically import to get the template generator
    const { generateBrainHTML } = await import('../../../src/cli/brain/template.js');

    const mockData = {
      meta: {
        projectName: 'test',
        totalNodes: 0,
        totalEdges: 0,
        levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        brainScope: 'global' as const,
        webKnowledgeCount: 0,
      },
      nodes: [],
      edges: [],
    };

    const html = generateBrainHTML(mockData);

    // Check model management panel exists
    expect(html).toContain('id="models-panel"');
    expect(html).toContain('id="models-toggle"');
    expect(html).toContain('id="gpu-filter"');
    expect(html).toContain('id="installed-models"');
    expect(html).toContain('id="recommended-models"');
    expect(html).toContain('id="running-models"');
    expect(html).toContain('id="ollama-status"');
  });

  it('should include GPU VRAM filter options', async () => {
    const { generateBrainHTML } = await import('../../../src/cli/brain/template.js');

    const mockData = {
      meta: { projectName: 'test', totalNodes: 0, totalEdges: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, brainScope: 'global' as const, webKnowledgeCount: 0 },
      nodes: [],
      edges: [],
    };

    const html = generateBrainHTML(mockData);

    expect(html).toContain('data-vram="8"');
    expect(html).toContain('data-vram="12"');
    expect(html).toContain('data-vram="16"');
    expect(html).toContain('data-vram="24"');
    expect(html).toContain('data-vram="32"');
    expect(html).toContain('data-vram="48"');
    expect(html).toContain('RTX 5090');
  });

  it('should include findings panel with correct structure', async () => {
    const { generateBrainHTML } = await import('../../../src/cli/brain/template.js');

    const mockData = {
      meta: { projectName: 'test', totalNodes: 0, totalEdges: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, brainScope: 'global' as const, webKnowledgeCount: 0 },
      nodes: [],
      edges: [],
    };

    const html = generateBrainHTML(mockData);

    expect(html).toContain('id="findings-panel"');
    expect(html).toContain('id="findings-toggle"');
    expect(html).toContain('id="findings-badge"');
    expect(html).toContain('id="findings-list"');
    expect(html).toContain('Agent Findings');
  });

  it('should have recommended models data in JS', async () => {
    const { generateBrainHTML } = await import('../../../src/cli/brain/template.js');

    const mockData = {
      meta: { projectName: 'test', totalNodes: 0, totalEdges: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, brainScope: 'global' as const, webKnowledgeCount: 0 },
      nodes: [],
      edges: [],
    };

    const html = generateBrainHTML(mockData);

    // Recommended models in the embedded JS
    expect(html).toContain('qwen3-coder:30b');
    expect(html).toContain('qwen2.5-coder:32b');
    expect(html).toContain('deepseek-r1:32b');
    expect(html).toContain('/api/ollama/models');
    expect(html).toContain('/api/ollama/pull');
    expect(html).toContain('/api/ollama/running');
    expect(html).toContain('activate_model');
    expect(html).toContain('model_activated');
  });

  it('should include scope switcher with Local/Global buttons', async () => {
    const { generateBrainHTML } = await import('../../../src/cli/brain/template.js');

    // Test project scope
    const projectData = {
      meta: { projectName: 'test', totalNodes: 0, totalEdges: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, brainScope: 'project' as const, webKnowledgeCount: 0 },
      nodes: [],
      edges: [],
    };
    const projectHtml = generateBrainHTML(projectData);

    expect(projectHtml).toContain('id="scope-switcher"');
    expect(projectHtml).toContain('data-scope="project"');
    expect(projectHtml).toContain('data-scope="global"');
    // Project button should be active
    expect(projectHtml).toContain('project-btn active');

    // Test global scope
    const globalData = {
      meta: { projectName: 'test', totalNodes: 0, totalEdges: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, brainScope: 'global' as const, webKnowledgeCount: 0 },
      nodes: [],
      edges: [],
    };
    const globalHtml = generateBrainHTML(globalData);
    expect(globalHtml).toContain('global-btn active');
  });

  it('should include scope_switch WebSocket handler', async () => {
    const { generateBrainHTML } = await import('../../../src/cli/brain/template.js');

    const mockData = {
      meta: { projectName: 'test', totalNodes: 0, totalEdges: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, brainScope: 'global' as const, webKnowledgeCount: 0 },
      nodes: [],
      edges: [],
    };

    const html = generateBrainHTML(mockData);

    expect(html).toContain('scope_switch');
    expect(html).toContain('scope_changed');
    expect(html).toContain('updateScopeUI');
  });

  it('should not overlap findings toggle and legend', async () => {
    const { generateBrainHTML } = await import('../../../src/cli/brain/template.js');

    const mockData = {
      meta: { projectName: 'test', totalNodes: 0, totalEdges: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, brainScope: 'global' as const, webKnowledgeCount: 0 },
      nodes: [],
      edges: [],
    };

    const html = generateBrainHTML(mockData);

    // Legend should be at bottom: 56px (above the toggle buttons)
    expect(html).toContain('#legend {\n  position: fixed; bottom: 56px; left: 16px;');
    // Findings toggle at bottom: 16px
    expect(html).toContain('#findings-toggle {\n  position: fixed; left: 16px; bottom: 16px;');
  });

  it('should include Activate Model buttons in template', async () => {
    const { generateBrainHTML } = await import('../../../src/cli/brain/template.js');

    const mockData = {
      meta: { projectName: 'test', totalNodes: 0, totalEdges: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, brainScope: 'global' as const, webKnowledgeCount: 0 },
      nodes: [],
      edges: [],
    };

    const html = generateBrainHTML(mockData);

    // Activate button and handler should exist in template
    expect(html).toContain('data-activate');
    expect(html).toContain('activate_model');
    expect(html).toContain('.mc-btn.primary');
  });
});
