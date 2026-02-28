import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderMarkdown } from '../../../src/cli/ui/chat-view.js';

// Mock process.stdout.columns for deterministic tests
beforeEach(() => {
  Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true });
});

describe('renderMarkdown', () => {
  it('should render plain text', () => {
    const result = renderMarkdown('Hello world');
    expect(result).toContain('Hello world');
  });

  it('should render inline code', () => {
    const result = renderMarkdown('Use `npm install` here');
    expect(result).toContain('npm install');
  });
});

describe('table rendering', () => {
  it('should render a simple table within terminal width', () => {
    const md = [
      '| Name | Value |',
      '|------|-------|',
      '| foo  | bar   |',
      '| baz  | qux   |',
    ].join('\n');

    const result = renderMarkdown(md);
    // Table should contain borders and content
    expect(result).toContain('foo');
    expect(result).toContain('bar');
    expect(result).toContain('\u2502'); // │ border char
    expect(result).toContain('\u2500'); // ─ border char
  });

  it('should constrain wide tables to terminal width', () => {
    // Create a table with very long cell content
    const md = [
      '| Short | Very Long Content Column |',
      '|-------|-------------------------|',
      `| A | ${'X'.repeat(200)} |`,
      `| B | ${'Y'.repeat(200)} |`,
    ].join('\n');

    const result = renderMarkdown(md);
    const lines = result.split('\n');

    // No line should exceed terminal width (80 cols - 8 margin = 72)
    const termWidth = 80 - 8; // matches getTermWidth()
    for (const line of lines) {
      const visibleLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
      expect(visibleLen).toBeLessThanOrEqual(termWidth + 1); // +1 for rounding
    }
  });

  it('should handle <br> tags as line breaks in cells', () => {
    const md = [
      '| Key | Value |',
      '|-----|-------|',
      '| Cost | 100€<br>per month<br>billed annually |',
    ].join('\n');

    const result = renderMarkdown(md);
    // Content should appear (split by line breaks inside the cell)
    expect(result).toContain('100');
    expect(result).toContain('per month');
  });

  it('should handle multi-column tables', () => {
    const md = [
      '| A | B | C | D |',
      '|---|---|---|---|',
      '| 1 | 2 | 3 | 4 |',
    ].join('\n');

    const result = renderMarkdown(md);
    const lines = result.split('\n');

    const termWidth = 80 - 8;
    for (const line of lines) {
      const visibleLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
      expect(visibleLen).toBeLessThanOrEqual(termWidth + 1);
    }
  });

  it('should word-wrap long cell content instead of truncating', () => {
    const longText = 'This is a fairly long description that should be word wrapped inside the table cell boundary';
    const md = [
      '| Name | Description |',
      '|------|-------------|',
      `| Item | ${longText} |`,
    ].join('\n');

    const result = renderMarkdown(md);
    // All words should appear (word-wrapped, not truncated)
    expect(result).toContain('word');
    expect(result).toContain('wrapped');
    expect(result).toContain('boundary');
  });
});
