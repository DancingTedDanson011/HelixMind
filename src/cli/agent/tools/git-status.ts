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
    // Quick check: is this a git repository?
    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: ctx.executionRoot, encoding: 'utf-8', stdio: 'pipe' });
    } catch {
      return `Not a git repository. The current directory (${ctx.executionRoot}) is not tracked by git. Use \`git init\` to initialize one, or navigate to a project that uses git.`;
    }

    try {
      const branch = execSync('git branch --show-current', { cwd: ctx.executionRoot, encoding: 'utf-8', stdio: 'pipe' }).trim();
      const status = execSync('git status --short', { cwd: ctx.executionRoot, encoding: 'utf-8', stdio: 'pipe' }).trim();

      let ahead = '0';
      let behind = '0';
      try {
        ahead = execSync('git rev-list --count @{upstream}..HEAD', { cwd: ctx.executionRoot, encoding: 'utf-8', stdio: 'pipe' }).trim();
        behind = execSync('git rev-list --count HEAD..@{upstream}', { cwd: ctx.executionRoot, encoding: 'utf-8', stdio: 'pipe' }).trim();
      } catch {
        // No upstream configured — skip ahead/behind
      }

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
      return `Git error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
