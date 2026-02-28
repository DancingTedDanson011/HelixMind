import { readFileSync, statSync } from 'node:fs';
import { registerTool } from './registry.js';
import { validatePath } from '../sandbox.js';

registerTool({
  definition: {
    name: 'read_file',
    description: 'Read the contents of a file. Returns content with line numbers. Can read specific line ranges.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the file' },
        start_line: { type: 'number', description: 'Start line (1-based, optional)' },
        end_line: { type: 'number', description: 'End line (inclusive, optional)' },
      },
      required: ['path'],
    },
  },

  async execute(input, ctx) {
    const filePath = validatePath(input.path as string, ctx.projectRoot);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      return `Error: ${input.path} is a directory, not a file. Use list_directory instead.`;
    }

    if (stat.size > 1024 * 1024) {
      return `Error: File is too large (${(stat.size / 1024).toFixed(0)} KB). Use start_line/end_line to read a portion.`;
    }

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const startLine = (input.start_line as number | undefined) ?? 1;
    const endLine = (input.end_line as number | undefined) ?? lines.length;

    const start = Math.max(1, startLine) - 1;
    const end = Math.min(lines.length, endLine);
    const selectedLines = lines.slice(start, end);

    const numbered = selectedLines.map((line, i) => {
      const lineNum = String(start + i + 1).padStart(4);
      return `${lineNum} │ ${line}`;
    }).join('\n');

    const header = `File: ${input.path} (${lines.length} lines, ${(stat.size / 1024).toFixed(1)} KB)`;
    if (start > 0 || end < lines.length) {
      return `${header}\nShowing lines ${start + 1}-${end} of ${lines.length}\n\n${numbered}`;
    }
    return `${header}\n\n${numbered}`;
  },
});
