import { execSync } from 'node:child_process';
import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'git_status',
    description: 'Show current git status — modified, added, deleted files, current branch, and tracking info.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  async execute(_input, ctx) {
    try {
      const branch = execSync('git branch --show-current', { cwd: ctx.projectRoot, encoding: 'utf-8' }).trim();
      const status = execSync('git status --short', { cwd: ctx.projectRoot, encoding: 'utf-8' }).trim();
      const ahead = execSync('git rev-list --count @{upstream}..HEAD 2>/dev/null || echo 0', { cwd: ctx.projectRoot, encoding: 'utf-8', shell: 'bash' }).trim();
      const behind = execSync('git rev-list --count HEAD..@{upstream} 2>/dev/null || echo 0', { cwd: ctx.projectRoot, encoding: 'utf-8', shell: 'bash' }).trim();

      let result = `Branch: ${branch}`;
      if (ahead !== '0') result += ` (${ahead} ahead)`;
      if (behind !== '0') result += ` (${behind} behind)`;
      result += '\n';

      if (status) {
        result += `\nChanges:\n${status}`;
      } else {
        result += '\nWorking tree clean';
      }

      return result;
    } catch (err) {
      return `Error: Not a git repository or git not available. ${err}`;
    }
  },
});
