import { describe, it, expect } from 'vitest';
import { generateBrainHTML } from '../../../src/cli/brain/template.js';
import type { BrainExport } from '../../../src/cli/brain/exporter.js';

describe('generateBrainHTML', () => {
  const mockData: BrainExport = {
    meta: {
      totalNodes: 5,
      totalEdges: 4,
      exportDate: '2025-02-25T00:00:00.000Z',
      projectName: 'Test Project',
    },
    nodes: [
      { id: '1', label: 'src/app.ts', content: 'Main application', type: 'code', level: 1, relevanceScore: 0.9, createdAt: '2025-02-25', lastAccessed: '2025-02-25' },
      { id: '2', label: 'Auth Module', content: 'Authentication module', type: 'module', level: 2, relevanceScore: 0.6, createdAt: '2025-02-24', lastAccessed: '2025-02-25' },
      { id: '3', label: 'Architecture', content: 'MVC pattern', type: 'architecture', level: 3, relevanceScore: 0.35, createdAt: '2025-02-23', lastAccessed: '2025-02-24' },
      { id: '4', label: 'Old Pattern', content: 'Factory pattern from Q1', type: 'pattern', level: 4, relevanceScore: 0.15, createdAt: '2025-01-15', lastAccessed: '2025-02-01' },
      { id: '5', label: 'Legacy Decision', content: 'Chose React', type: 'decision', level: 5, relevanceScore: 0.05, createdAt: '2024-12-01', lastAccessed: '2025-01-01' },
    ],
    edges: [
      { source: '1', target: '2', type: 'belongs_to', weight: 0.8 },
      { source: '2', target: '3', type: 'related_to', weight: 0.5 },
      { source: '3', target: '4', type: 'supersedes', weight: 0.3 },
      { source: '4', target: '5', type: 'related_to', weight: 0.2 },
    ],
  };

  it('should generate valid HTML', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('should include Three.js import', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('three');
    expect(html).toContain('OrbitControls');
  });

  it('should embed the data as JSON', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('"totalNodes":5');
    expect(html).toContain('"totalEdges":4');
  });

  it('should include project name', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('Test Project');
  });

  it('should include HelixMind branding', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('HelixMind');
  });

  it('should include search functionality', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('search-input');
    expect(html).toContain('Search nodes');
  });

  it('should include level filter toggles', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('data-level="1"');
    expect(html).toContain('data-level="2"');
    expect(html).toContain('data-level="3"');
  });

  it('should include sidebar for node details', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('sidebar');
    expect(html).toContain('content-preview');
  });

  it('should be self-contained (no server needed)', () => {
    const html = generateBrainHTML(mockData);
    // Should reference CDN, not local files
    expect(html).toContain('cdn.jsdelivr.net');
  });

  it('should be under 2MB even for large data', () => {
    const html = generateBrainHTML(mockData);
    const sizeKB = Buffer.byteLength(html, 'utf-8') / 1024;
    expect(sizeKB).toBeLessThan(2048); // < 2MB
  });

  it('should include all 5 level toggles', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('data-level="1"');
    expect(html).toContain('data-level="2"');
    expect(html).toContain('data-level="3"');
    expect(html).toContain('data-level="4"');
    expect(html).toContain('data-level="5"');
  });

  it('should have 6 distinct level colors', () => {
    const html = generateBrainHTML(mockData);
    // L1=Cyan, L2=Green, L3=Slate Blue, L4=Magenta, L5=Coral, L6=Gold
    expect(html).toContain('0xE040FB'); // L1 Magenta (Focus)
    expect(html).toContain('0x00FF88'); // L2 Green
    expect(html).toContain('0x7B68EE'); // L3 Medium Slate Blue
    expect(html).toContain('0x00FFFF'); // L4 Cyan (Archive)
    expect(html).toContain('0xFF6B6B'); // L5 Coral
    expect(html).toContain('0xFFD700'); // L6 Gold
  });

  it('should include all 5 levels in legend', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('Focus');
    expect(html).toContain('Active');
    expect(html).toContain('Reference');
    expect(html).toContain('Archive');
    expect(html).toContain('Deep Archive');
  });

  // --- Brain Manager UI ---

  it('should include brain-toggle button', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('brain-toggle');
    expect(html).toContain('Brains');
  });

  it('should include brain-manager panel with global/local sections', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('brain-manager');
    expect(html).toContain('bm-global');
    expect(html).toContain('bm-local');
  });

  it('should include plan-view section', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('plan-view');
    expect(html).toContain('plan-items');
  });

  it('should include brain management WS handlers', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('brain_list');
    expect(html).toContain('brain_renamed');
    expect(html).toContain('brain_switched');
    expect(html).toContain('brain_created');
    expect(html).toContain('brain_limit_reached');
  });

  it('should include brain management functions', () => {
    const html = generateBrainHTML(mockData);
    expect(html).toContain('requestBrainList');
    expect(html).toContain('renderBrainList');
    expect(html).toContain('createBrainCard');
    expect(html).toContain('renameBrain');
    expect(html).toContain('switchBrain');
  });
});
