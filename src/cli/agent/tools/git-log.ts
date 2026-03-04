import { execFileSync } from 'node:child_process';
import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'git_log',
    description: 'Show recent git commit history with hash, message, author, and date.',
    input_schema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of commits to show (default: 10)' },
        file: { type: 'string', description: 'Show history for a specific file (optional)' },
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
      const count = (input.count as number) ?? 10;
      // Use execFileSync to prevent shell injection via file paths
      const args = ['log', `-${count}`, '--format=%h  %s  (%ar)  <%an>'];
      if (input.file) args.push('--', String(input.file));

      const log = execFileSync('git', args, { cwd: ctx.projectRoot, encoding: 'utf-8' }).trim();

      if (!log) {
        return 'No commits found.';
      }

      return `Recent commits:\n\n${log}`;
    } catch (err) {
      return `Error: ${err}`;
    }
  },
});
