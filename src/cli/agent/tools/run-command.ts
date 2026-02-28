import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { registerTool } from './registry.js';
import { validatePath, isBlockedCommand } from '../sandbox.js';

registerTool({
  definition: {
    name: 'run_command',
    description: 'Execute a shell command. Uses cmd.exe on Windows, bash on Unix. Each call runs in the project root — cd does NOT persist. Prefer built-in tools (read_file, list_directory, search_files) over run_command when possible.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        working_dir: { type: 'string', description: 'Working directory (default: project root)' },
        timeout: { type: 'number', description: 'Timeout in seconds (default: 60)' },
      },
      required: ['command'],
    },
  },

  async execute(input, ctx) {
    const command = input.command as string;
    const timeoutSec = (input.timeout as number) ?? 60;

    if (isBlockedCommand(command)) {
      return 'Error: This command is blocked for safety reasons.';
    }

    const cwd = input.working_dir
      ? validatePath(input.working_dir as string, ctx.projectRoot)
      : ctx.projectRoot;

    return new Promise<string>((resolve) => {
      let stdout = '';
      let stderr = '';

      const isWindows = platform() === 'win32';
      const shell = isWindows ? 'cmd.exe' : '/bin/bash';
      const shellArgs = isWindows ? ['/c', command] : ['-c', command];

      const proc = spawn(shell, shellArgs, {
        cwd,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        resolve(`Command timed out after ${timeoutSec}s.\n\nPartial stdout:\n${stdout}\n\nPartial stderr:\n${stderr}`);
      }, timeoutSec * 1000);

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        // Stream to user's terminal
        process.stdout.write(text);
      });

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        process.stderr.write(text);
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        const exitCode = code ?? 1;

        // Truncate very long output
        const maxLen = 10000;
        const outTruncated = stdout.length > maxLen
          ? stdout.slice(0, maxLen) + `\n... (${stdout.length - maxLen} chars truncated)`
          : stdout;

        const errTruncated = stderr.length > maxLen
          ? stderr.slice(0, maxLen) + `\n... (${stderr.length - maxLen} chars truncated)`
          : stderr;

        let result = `Exit code: ${exitCode}\n`;
        if (outTruncated) result += `\nstdout:\n${outTruncated}`;
        if (errTruncated) result += `\nstderr:\n${errTruncated}`;

        resolve(result);
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve(`Error executing command: ${err.message}`);
      });
    });
  },
});
