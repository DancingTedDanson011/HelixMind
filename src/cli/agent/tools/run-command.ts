import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { registerTool } from './registry.js';
import { validatePath } from '../sandbox.js';
import { classifyShellCommand } from '../shell/classifier.js';

registerTool({
  definition: {
    name: 'run_command',
    description: 'Execute a shell command. Uses cmd.exe on Windows and bash on Unix. Each call runs in the current execution root; cd does not persist. Prefer built-in tools over run_command when possible.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        working_dir: { type: 'string', description: 'Working directory (default: execution root)' },
        timeout: { type: 'number', description: 'Timeout in seconds (default: 60)' },
      },
      required: ['command'],
    },
  },

  async execute(input, ctx) {
    const command = input.command as string;
    const timeoutSec = (input.timeout as number) ?? 60;
    const classification = classifyShellCommand(command);

    if (classification.risk === 'blocked') {
      return `Error: This command is blocked for safety reasons. ${classification.summary}.`;
    }

    const cwd = input.working_dir
      ? validatePath(input.working_dir as string, ctx.executionRoot)
      : ctx.executionRoot;

    return new Promise<string>((resolve) => {
      let stdout = '';
      let stderr = '';

      const isWindows = platform() === 'win32';
      const shell = isWindows ? 'cmd.exe' : '/bin/bash';
      const shellArgs = isWindows ? ['/c', command] : ['-c', command];

      // Filter sensitive environment variables using a strict allowlist.
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
        setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            // Process already exited.
          }
        }, 5000);
        resolve(`Command timed out after ${timeoutSec}s.\n\nPartial stdout:\n${stdout}\n\nPartial stderr:\n${stderr}`);
      }, timeoutSec * 1000);

      const maxBuffer = 5 * 1024 * 1024;

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        if (stdout.length < maxBuffer) {
          stdout += text.slice(0, maxBuffer - stdout.length);
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        if (stderr.length < maxBuffer) {
          stderr += text.slice(0, maxBuffer - stderr.length);
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        const exitCode = code ?? 1;

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
