import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { createProvider } from '../providers/registry.js';
import { runAgentLoop, AgentAbortError, AgentController } from '../agent/loop.js';
import { PermissionManager } from '../agent/permissions.js';
import { UndoStack } from '../agent/undo.js';
import { initializeTools, type ToolContext } from '../agent/tools/registry.js';
import { SessionBuffer } from '../context/session-buffer.js';
import { buildBenchSystemPrompt, buildBenchSystemPromptWithSpiral } from './prompt.js';
import { SpiralEngine } from '../../spiral/engine.js';
import { loadConfig as loadSpiralConfig } from '../../utils/config.js';
import type { SWETask, BenchConfig, TaskResult, TaskProgressEvent } from './types.js';

let toolsInitialized = false;

/**
 * Execute a single SWE-bench task headlessly.
 * 1. Clone repo at base_commit
 * 2. (Optional) Initialize/use Spiral Memory
 * 3. Run agent loop with problem_statement
 * 4. Extract git diff as patch
 * 5. Cleanup
 *
 * @param sharedSpiral - Pre-initialized SpiralEngine for 'learning' mode (shared across tasks)
 */
export async function runSingleTask(
  task: SWETask,
  config: BenchConfig,
  onProgress?: (event: TaskProgressEvent) => void,
  sharedSpiral?: SpiralEngine,
): Promise<TaskResult> {
  const startTime = Date.now();

  // Ensure tools are loaded once
  if (!toolsInitialized) {
    await initializeTools();
    toolsInitialized = true;
  }

  // Create isolated working directory
  const taskDir = join(tmpdir(), 'helixmind-bench', config.runId, task.instance_id.replace(/\//g, '__'));
  mkdirSync(taskDir, { recursive: true });

  const repoDir = join(taskDir, 'repo');

  try {
    // Step 1: Clone repository
    onProgress?.({ type: 'status', message: 'Cloning repository...' });

    try {
      execSync(
        `git clone --quiet https://github.com/${task.repo}.git repo`,
        { cwd: taskDir, timeout: 300_000, stdio: 'pipe' },
      );
    } catch (err) {
      return makeErrorResult(task, startTime, `Clone failed: ${err}`);
    }

    // Checkout the specific base commit
    try {
      execSync(`git checkout --quiet ${task.base_commit}`, {
        cwd: repoDir,
        timeout: 30_000,
        stdio: 'pipe',
      });
    } catch (err) {
      return makeErrorResult(task, startTime, `Checkout failed: ${err}`);
    }

    // Step 2: Initialize Spiral if enabled
    let spiralEngine: SpiralEngine | null = null;
    let ownedSpiral = false; // Track if we created the spiral (for cleanup)

    if (config.withSpiral) {
      onProgress?.({ type: 'status', message: 'Initializing spiral memory...' });

      if (config.spiralMode === 'learning' && sharedSpiral) {
        // Learning mode: reuse shared spiral across tasks
        spiralEngine = sharedSpiral;
      } else {
        // Fresh mode: create new spiral per task
        const spiralDataDir = join(taskDir, 'spiral');
        mkdirSync(spiralDataDir, { recursive: true });
        const spiralConfig = loadSpiralConfig(spiralDataDir);
        spiralEngine = new SpiralEngine(spiralConfig);
        await spiralEngine.initialize();
        ownedSpiral = true;
      }

      // Pre-seed spiral with repo context
      await preSeedSpiral(spiralEngine, repoDir, task);

      onProgress?.({ type: 'status', message: 'Spiral memory ready' });
    }

    // Step 3: Run agent loop
    onProgress?.({ type: 'status', message: 'Agent working...' });

    const provider = createProvider(config.provider, config.apiKey, config.model, config.baseURL);
    const permissions = new PermissionManager();
    permissions.setYolo(true); // No interactive prompts

    const undoStack = new UndoStack();
    const controller = new AgentController();
    const sessionBuffer = new SessionBuffer();

    // Build system prompt: with or without spiral context
    let systemPrompt: string;
    if (spiralEngine) {
      const spiralContext = await spiralEngine.query(task.problem_statement, 40000);
      systemPrompt = buildBenchSystemPromptWithSpiral(task, repoDir, spiralContext);
    } else {
      systemPrompt = buildBenchSystemPrompt(task, repoDir);
    }

    const toolContext: ToolContext = {
      projectRoot: repoDir,
      undoStack,
      spiralEngine: spiralEngine ?? undefined,
    };

    let tokensInput = 0;
    let tokensOutput = 0;

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, config.timeoutSeconds * 1000);

    let agentResult;
    try {
      agentResult = await runAgentLoop(
        task.problem_statement,
        [],
        {
          provider,
          systemPrompt,
          permissions,
          toolContext,
          sessionBuffer,
          onTokensUsed: (inp, out) => {
            tokensInput += inp;
            tokensOutput += out;
            onProgress?.({ type: 'tokens', input: inp, output: out });
          },
          onToolCall: (name) => {
            onProgress?.({ type: 'tool', name });
          },
          maxIterations: config.maxIterations,
        },
        controller,
      );
    } catch (err) {
      clearTimeout(timeoutHandle);
      // Store timeout/error learnings in spiral (learning mode)
      if (spiralEngine && config.spiralMode === 'learning') {
        try {
          const isTimeout = err instanceof AgentAbortError;
          await spiralEngine.store(
            `${isTimeout ? 'Timeout' : 'Error'} on ${task.instance_id} (${task.repo}): ${String(err).slice(0, 200)}. Problem: ${task.problem_statement.slice(0, 150)}`,
            'pattern',
            { tags: [isTimeout ? 'timeout' : 'error', task.repo], file: task.instance_id },
          );
        } catch { /* non-critical */ }
      }
      if (err instanceof AgentAbortError) {
        return makeResult(task, startTime, 'timeout', '', tokensInput, tokensOutput, 0, [], ['Timeout reached']);
      }
      return makeErrorResult(task, startTime, `Agent error: ${err}`);
    }

    clearTimeout(timeoutHandle);

    // Step 3: Extract patch
    onProgress?.({ type: 'status', message: 'Extracting patch...' });

    let patch = '';
    try {
      patch = execSync(`git diff ${task.base_commit}`, {
        cwd: repoDir,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      // Also try unstaged diff as fallback
      try {
        patch = execSync('git diff', {
          cwd: repoDir,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
        });
      } catch {
        patch = '';
      }
    }

    const status = patch.trim() ? 'resolved' : 'failed';
    const steps = agentResult.steps.map(s => ({
      tool: s.tool,
      label: s.label,
      status: s.status,
    }));

    // Store learnings in spiral (learning mode) — fixes, errors, and failures
    if (spiralEngine && config.spiralMode === 'learning') {
      try {
        if (patch.trim()) {
          // Successful fix: store the pattern
          const patchSummary = patch.split('\n').slice(0, 5).join(' ').slice(0, 200);
          await spiralEngine.store(
            `Fixed ${task.instance_id}: ${patchSummary}`,
            'pattern',
            { tags: ['fix', task.repo], file: task.instance_id },
          );
        } else {
          // Failed attempt: store what the agent tried so future tasks can learn
          const agentSummary = agentResult.text?.slice(0, 300) ?? 'No output';
          const errorSummary = agentResult.errors?.slice(0, 3).join('; ') ?? '';
          await spiralEngine.store(
            `Failed ${task.instance_id} (${task.repo}): ${agentSummary}${errorSummary ? ` Errors: ${errorSummary}` : ''}`,
            'pattern',
            { tags: ['failed_attempt', task.repo], file: task.instance_id },
          );
        }
      } catch {
        // Non-critical: don't fail the task if spiral store fails
      }
    }

    // Cleanup owned spiral (fresh mode)
    if (ownedSpiral && spiralEngine) {
      try {
        spiralEngine.close();
      } catch {
        // ignore
      }
    }

    return makeResult(
      task, startTime, status, patch,
      tokensInput, tokensOutput,
      agentResult.toolCalls, steps, agentResult.errors,
      agentResult.text,
    );

  } finally {
    // Step 5: Cleanup
    try {
      rmSync(taskDir, { recursive: true, force: true });
    } catch {
      // EBUSY on Windows — ignore
    }
  }
}

function makeResult(
  task: SWETask,
  startTime: number,
  status: TaskResult['status'],
  patch: string,
  tokensIn: number,
  tokensOut: number,
  toolCalls: number,
  steps: TaskResult['steps'],
  errors: string[],
  agentText = '',
): TaskResult {
  return {
    instance_id: task.instance_id,
    status,
    model_patch: patch,
    tokens: { input: tokensIn, output: tokensOut },
    toolCalls,
    steps,
    errors,
    durationMs: Date.now() - startTime,
    agentText,
  };
}

function makeErrorResult(task: SWETask, startTime: number, error: string): TaskResult {
  return makeResult(task, startTime, 'error', '', 0, 0, 0, [], [error]);
}

/**
 * Deep-feed a SpiralEngine with repo files for contextual knowledge.
 * Scans: config files, README, source directories, __init__.py, key modules.
 * Much more thorough than just top-level files — mirrors `/feed` behavior.
 */
async function preSeedSpiral(spiral: SpiralEngine, repoDir: string, task: SWETask): Promise<void> {
  const keyFiles: string[] = [];
  const seen = new Set<string>();

  const add = (relPath: string) => {
    if (!seen.has(relPath)) {
      seen.add(relPath);
      keyFiles.push(relPath);
    }
  };

  // 1. Priority config/readme files at root
  const priorityNames = [
    'README.md', 'README.rst', 'README.txt',
    'setup.py', 'pyproject.toml', 'setup.cfg',
    'Makefile', 'tox.ini', 'MANIFEST.in',
    'requirements.txt', 'requirements-dev.txt',
    'CONTRIBUTING.md', 'CHANGES.rst', 'CHANGELOG.md',
  ];
  for (const name of priorityNames) {
    if (existsSync(join(repoDir, name))) add(name);
  }

  // 2. Top-level .py files
  try {
    const entries = readdirSync(repoDir);
    for (const e of entries) {
      if (e.endsWith('.py')) add(e);
    }
  } catch { /* ignore */ }

  // 3. Recursively scan source directories for key files (max ~80 files total)
  const MAX_FILES = 80;
  const sourceExtensions = ['.py', '.pyx', '.pxd'];
  const importantNames = ['__init__.py', 'models.py', 'views.py', 'urls.py', 'admin.py',
    'serializers.py', 'forms.py', 'signals.py', 'middleware.py', 'managers.py',
    'utils.py', 'helpers.py', 'exceptions.py', 'constants.py', 'types.py',
    'conf.py', 'settings.py', 'apps.py'];

  function scanDir(dir: string, relPrefix: string, depth: number): void {
    if (depth > 5 || keyFiles.length >= MAX_FILES) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      // Add __init__.py first (package markers)
      for (const entry of entries) {
        if (keyFiles.length >= MAX_FILES) return;
        if (entry.isFile() && entry.name === '__init__.py') {
          add(relPrefix ? `${relPrefix}/${entry.name}` : entry.name);
        }
      }
      // Add important module names
      for (const entry of entries) {
        if (keyFiles.length >= MAX_FILES) return;
        if (entry.isFile() && importantNames.includes(entry.name)) {
          add(relPrefix ? `${relPrefix}/${entry.name}` : entry.name);
        }
      }
      // Add remaining source files
      for (const entry of entries) {
        if (keyFiles.length >= MAX_FILES) return;
        if (entry.isFile() && sourceExtensions.some(ext => entry.name.endsWith(ext))) {
          add(relPrefix ? `${relPrefix}/${entry.name}` : entry.name);
        }
      }
      // Recurse into subdirectories (skip hidden, __pycache__, .git, node_modules, etc.)
      for (const entry of entries) {
        if (keyFiles.length >= MAX_FILES) return;
        if (entry.isDirectory() && !entry.name.startsWith('.') &&
            entry.name !== '__pycache__' && entry.name !== 'node_modules' &&
            entry.name !== '.git' && entry.name !== 'venv' && entry.name !== '.tox') {
          scanDir(join(dir, entry.name), relPrefix ? `${relPrefix}/${entry.name}` : entry.name, depth + 1);
        }
      }
    } catch { /* permission error or similar */ }
  }

  // Detect source directories (common patterns)
  const repo_name = task.repo.split('/')[1]?.replace(/-/g, '_');
  const sourceDirs = ['src', 'lib', repo_name ?? '', task.repo.split('/')[1] ?? ''];
  for (const dir of sourceDirs) {
    if (dir && existsSync(join(repoDir, dir))) {
      scanDir(join(repoDir, dir), dir, 0);
    }
  }
  // Also scan root level (some repos have source directly in root)
  scanDir(repoDir, '', 0);

  // 4. Store each file in spiral
  for (const fileName of keyFiles) {
    try {
      const filePath = join(repoDir, fileName);
      const content = readFileSync(filePath, 'utf-8');
      // Truncate large files
      const truncated = content.length > 4000 ? content.slice(0, 4000) + '\n... (truncated)' : content;
      await spiral.store(
        `[${task.repo}] ${fileName}:\n${truncated}`,
        'code',
        { tags: ['repo_context', task.repo], file: fileName },
      );
    } catch {
      // Skip files that can't be read
    }
  }
}
