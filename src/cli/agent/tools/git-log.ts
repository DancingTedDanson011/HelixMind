import { execSync } from 'node:child_process';
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
      const count = (input.count as number) ?? 10;
      const filePath = input.file ? ` -- "${input.file}"` : '';
      const format = '--format=%h  %s  (%ar)  <%an>';

      const log = execSync(
        `git log -${count} "${format}"${filePath}`,
        { cwd: ctx.projectRoot, encoding: 'utf-8' },
      ).trim();

      if (!log) {
        return 'No commits found.';
      }

      return `Recent commits:\n\n${log}`;
    } catch (err) {
      return `Error: ${err}`;
    }
  },
});
