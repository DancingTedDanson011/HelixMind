import { execSync } from 'node:child_process';
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
      const message = input.message as string;
      const files = input.files as string[] | undefined;

      // Stage files
      if (files && files.length > 0) {
        for (const file of files) {
          execSync(`git add "${file}"`, { cwd: ctx.projectRoot });
        }
      } else {
        execSync('git add -A', { cwd: ctx.projectRoot });
      }

      // Check if there's anything staged
      const staged = execSync('git diff --cached --stat', { cwd: ctx.projectRoot, encoding: 'utf-8' }).trim();
      if (!staged) {
        return 'Nothing to commit (no staged changes).';
      }

      // Commit
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: ctx.projectRoot,
        encoding: 'utf-8',
      });

      const hash = execSync('git rev-parse --short HEAD', { cwd: ctx.projectRoot, encoding: 'utf-8' }).trim();
      return `Committed: ${hash} — ${message}\n\n${staged}`;
    } catch (err) {
      return `Error: ${err}`;
    }
  },
});
