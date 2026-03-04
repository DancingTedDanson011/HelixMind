import { execSync, execFileSync } from 'node:child_process';
import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'git_commit',
    description: 'Stage files and create a git commit. If no files specified, stages all modified files.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message' },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific files to stage (default: all modified files)',
        },
      },
      required: ['message'],
    },
  },

  async execute(input, ctx) {
    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: ctx.projectRoot, encoding: 'utf-8', stdio: 'pipe' });
    } catch {
      return `Not a git repository. The current directory (${ctx.projectRoot}) is not tracked by git.`;
    }

    try {
      const message = input.message as string;
      const files = input.files as string[] | undefined;

      // Stage files (use execFileSync to prevent shell injection via file names)
      if (files && files.length > 0) {
        for (const file of files) {
          execFileSync('git', ['add', '--', file], { cwd: ctx.projectRoot });
        }
      } else {
        execFileSync('git', ['add', '-A'], { cwd: ctx.projectRoot });
      }

      // Check if there's anything staged
      const staged = execFileSync('git', ['diff', '--cached', '--stat'], { cwd: ctx.projectRoot, encoding: 'utf-8' }).trim();
      if (!staged) {
        return 'Nothing to commit (no staged changes).';
      }

      // Commit (use execFileSync to prevent shell injection via commit message)
      execFileSync('git', ['commit', '-m', message], {
        cwd: ctx.projectRoot,
        encoding: 'utf-8',
      });

      const hash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ctx.projectRoot, encoding: 'utf-8' }).trim();
      return `Committed: ${hash} — ${message}\n\n${staged}`;
    } catch (err) {
      return `Error: ${err}`;
    }
  },
});
