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

      // Filter sensitive environment variables — whitelist approach for maximum safety
      const SAFE_ENV_KEYS = new Set([
        'PATH', 'HOME', 'USERPROFILE', 'SHELL', 'TERM', 'LANG', 'LC_ALL',
        'NODE_ENV', 'NODE_PATH', 'NPM_CONFIG_PREFIX',
        'TMPDIR', 'TEMP', 'TMP', 'USER', 'USERNAME', 'LOGNAME',
        'HOSTNAME', 'PWD', 'OLDPWD', 'SHLVL', 'EDITOR', 'VISUAL',
        'COLORTERM', 'TERM_PROGRAM', 'COMSPEC', 'SystemRoot', 'SystemDrive',
        'ProgramFiles', 'ProgramFiles(x86)', 'CommonProgramFiles',
        'APPDATA', 'LOCALAPPDATA', 'WINDIR', 'OS',
        'NVM_DIR', 'NVM_BIN', 'NVM_INC',
        'GIT_EXEC_PATH', 'GIT_TEMPLATE_DIR',
        'GOPATH', 'GOROOT', 'CARGO_HOME', 'RUSTUP_HOME',
        'JAVA_HOME', 'PYTHON', 'PYTHONPATH',
      ]);
      const safeEnv: Record<string, string> = {};
      for (const [key, val] of Object.entries(process.env)) {
        if (val !== undefined && (SAFE_ENV_KEYS.has(key) || key.startsWith('npm_config_'))) {
          safeEnv[key] = val;
        }
      }

      const proc = spawn(shell, shellArgs, {
        cwd,
        env: safeEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        // Fallback SIGKILL after 5s if SIGTERM is ignored (Unix only)
        setTimeout(() => {
          try { proc.kill('SIGKILL'); } catch { /* already dead */ }
        }, 5000);
        resolve(`Command timed out after ${timeoutSec}s.\n\nPartial stdout:\n${stdout}\n\nPartial stderr:\n${stderr}`);
      }, timeoutSec * 1000);

      // Cap buffer size to prevent OOM on commands with huge output
      const MAX_BUFFER = 5 * 1024 * 1024; // 5MB

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        if (stdout.length < MAX_BUFFER) {
          stdout += text.slice(0, MAX_BUFFER - stdout.length);
        }
        // Stream to user's terminal
        process.stdout.write(text);
      });

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        if (stderr.length < MAX_BUFFER) {
          stderr += text.slice(0, MAX_BUFFER - stderr.length);
        }
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
