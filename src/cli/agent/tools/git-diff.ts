import { execSync } from 'node:child_process';
import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'git_diff',
    description: 'Show git diff for a specific file or all changes. Shows unified diff format.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Specific file to diff (optional, default: all)' },
        staged: { type: 'boolean', description: 'Show staged changes (default: false)' },
      },
      required: [],
    },
  },

  async execute(input, ctx) {
    try {
      const staged = (input.staged as boolean) ? '--cached' : '';
      const filePath = input.path ? ` -- "${input.path}"` : '';
      const cmd = `git diff ${staged}${filePath}`.trim();

      const diff = execSync(cmd, { cwd: ctx.projectRoot, encoding: 'utf-8', maxBuffer: 1024 * 1024 }).trim();

      if (!diff) {
        return staged ? 'No staged changes.' : 'No unstaged changes.';
      }

      // Truncate very long diffs
      if (diff.length > 15000) {
        return diff.slice(0, 15000) + `\n\n... diff truncated (${diff.length} chars total)`;
      }

      return diff;
    } catch (err) {
      return `Error: ${err}`;
    }
  },
});
