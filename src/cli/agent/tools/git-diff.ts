import { execFileSync } from 'node:child_process';
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
      execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: ctx.projectRoot, encoding: 'utf-8', stdio: 'pipe' });
    } catch {
      return `Not a git repository. The current directory (${ctx.projectRoot}) is not tracked by git.`;
    }

    try {
      // Use execFileSync to prevent shell injection via file paths
      const args = ['diff'];
      if (input.staged) args.push('--cached');
      if (input.path) args.push('--', String(input.path));

      const diff = execFileSync('git', args, { cwd: ctx.projectRoot, encoding: 'utf-8', maxBuffer: 1024 * 1024 }).trim();

      if (!diff) {
        return input.staged ? 'No staged changes.' : 'No unstaged changes.';
      }

      // Truncate very long diffs
      if (diff.length > 15000) {
        return diff.slice(0, 15000) + `\n\n... diff truncated (${diff.length} chars total)`;
      }

      return diff;
    } catch (err) {
      return `Git error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
