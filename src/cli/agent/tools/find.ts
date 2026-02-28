import fg from 'fast-glob';
import { relative } from 'node:path';
import { registerTool } from './registry.js';
import { validatePath } from '../sandbox.js';

registerTool({
  definition: {
    name: 'find_files',
    description: 'Find files by name pattern using glob. For example "**/*.test.ts" finds all test files.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g. "**/*.ts", "src/**/*.test.ts")' },
        path: { type: 'string', description: 'Base directory to search in (default: project root)' },
      },
      required: ['pattern'],
    },
  },

  async execute(input, ctx) {
    const baseDir = validatePath((input.path as string) || '.', ctx.projectRoot);
    const pattern = input.pattern as string;

    const files = await fg(pattern, {
      cwd: baseDir,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'coverage/**'],
      onlyFiles: true,
      dot: false,
    });

    if (files.length === 0) {
      return `No files found matching pattern: ${pattern}`;
    }

    const sorted = files.sort();
    const display = sorted.slice(0, 100).join('\n');
    const extra = sorted.length > 100 ? `\n... and ${sorted.length - 100} more` : '';

    return `Found ${sorted.length} file(s) matching "${pattern}":\n\n${display}${extra}`;
  },
});
