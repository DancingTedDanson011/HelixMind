import * as readline from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ConfigStore } from '../config/store.js';
import { createProvider } from '../providers/registry.js';
import type { LLMProvider, ChatMessage, ToolMessage } from '../providers/types.js';
import { analyzeProject } from '../context/project.js';
import { assembleSystemPrompt } from '../context/assembler.js';
import type { SpiralQueryResult } from '../../types.js';
import { renderLogo } from '../ui/logo.js';
import {
  renderAssistantEnd,
  renderError,
  renderInfo,
  renderSpiralStatus,
  renderMarkdown,
  renderUserMessage,
} from '../ui/chat-view.js';
import { isInsideToolBlock } from '../ui/tool-output.js';
import { renderFeedProgress, renderFeedSummary } from '../ui/progress.js';
import type { FeedProgress } from '../feed/pipeline.js';
import { ActivityIndicator } from '../ui/activity.js';
import { theme } from '../ui/theme.js';
import { detectFeedIntent } from '../feed/intent.js';
import { runFeedPipeline } from '../feed/pipeline.js';
import { showHelixMenu } from './helix-menu.js';
import { initializeTools } from '../agent/tools/registry.js';
import { runAgentLoop, AgentController, AgentAbortError } from '../agent/loop.js';
import { PermissionManager } from '../agent/permissions.js';
import { UndoStack } from '../agent/undo.js';
import { writeStatusBar, renderStatusBar, getGitInfo, truncateBar, type StatusBarData } from '../ui/statusbar.js';
import { CheckpointStore } from '../checkpoints/store.js';
import { createKeybindingState, processKeypress } from '../checkpoints/keybinding.js';
import { runCheckpointBrowser } from '../checkpoints/browser.js';
import { runFirstTimeSetup, showModelSwitcher, showKeyManagement } from './setup.js';
import { SessionBuffer } from '../context/session-buffer.js';
import { trimConversation } from '../context/trimmer.js';
import { runAutonomousLoop, SECURITY_PROMPT } from '../agent/autonomous.js';
import { SessionManager } from '../sessions/manager.js';
import { renderSessionNotification, renderSessionList } from '../sessions/tab-view.js';
import { getSuggestions, getBestCompletion, writeSuggestions, clearSuggestions } from '../ui/command-suggest.js';
import { selectMenu, type MenuItem } from '../ui/select-menu.js';
import { classifyTask } from '../validation/classifier.js';
import { generateCriteria } from '../validation/criteria.js';
import { validationLoop } from '../validation/autofix.js';
import { getValidationModelConfig, createValidationProvider } from '../validation/model.js';
import { renderValidationSummary, renderValidationStart, renderClassification, renderValidationOneLine } from '../validation/reporter.js';
import { storeValidationResult, getValidationStats, renderValidationStats } from '../validation/stats.js';
import chalk from 'chalk';

interface ChatOptions {
  message?: string;
  yolo?: boolean;
  skipPermissions?: boolean;
  validation?: boolean;
  validationVerbose?: boolean;
  validationStrict?: boolean;
}

// Interactive help menu — structured data for arrow-key navigation
interface HelpItem { cmd: string; label: string; description: string }
interface HelpCategory { category: string; color: string; items: HelpItem[] }

const HELP_CATEGORIES: HelpCategory[] = [
  {
    category: 'Chat & Interaction', color: '#00d4ff',
    items: [
      { cmd: '/clear', label: '/clear', description: 'Clear conversation history' },
      { cmd: '/model', label: '/model', description: 'Switch LLM model' },
      { cmd: '/keys', label: '/keys', description: 'Manage API keys' },
      { cmd: '/yolo', label: '/yolo', description: 'Toggle YOLO mode' },
      { cmd: '/skip-permissions', label: '/skip-permissions', description: 'Toggle skip-permissions' },
    ],
  },
  {
    category: 'Spiral Memory', color: '#00ff88',
    items: [
      { cmd: '/spiral', label: '/spiral', description: 'Show spiral status (nodes per level)' },
      { cmd: '/feed', label: '/feed', description: 'Feed files into spiral' },
      { cmd: '/context', label: '/context', description: 'Show context size & embeddings' },
      { cmd: '/compact', label: '/compact', description: 'Trigger spiral evolution' },
      { cmd: '/tokens', label: '/tokens', description: 'Show token usage & memory' },
    ],
  },
  {
    category: 'Visualization & Brain', color: '#4169e1',
    items: [
      { cmd: '/brain', label: '/brain', description: 'Brain scope + 3D visualization' },
      { cmd: '/brain local', label: '/brain local', description: 'Switch to project-local brain' },
      { cmd: '/brain global', label: '/brain global', description: 'Switch to global brain' },
      { cmd: '/helix', label: '/helix', description: 'Command Center + Brain (auto-start)' },
      { cmd: '/helixlocal', label: '/helixlocal', description: 'Command Center + local brain' },
      { cmd: '/helixglobal', label: '/helixglobal', description: 'Command Center + global brain' },
    ],
  },
  {
    category: 'Autonomous & Security', color: '#ff6600',
    items: [
      { cmd: '/auto', label: '/auto', description: 'Autonomous mode' },
      { cmd: '/stop', label: '/stop', description: 'Stop autonomous mode' },
      { cmd: '/security', label: '/security', description: 'Run security audit (background)' },
      { cmd: '/sessions', label: '/sessions', description: 'List all sessions & tabs' },
      { cmd: '/local', label: '/local', description: 'Local LLM setup (Ollama)' },
    ],
  },
  {
    category: 'Validation Matrix', color: '#00cc66',
    items: [
      { cmd: '/validation', label: '/validation', description: 'Show validation status' },
      { cmd: '/validation on', label: '/validation on', description: 'Enable output validation' },
      { cmd: '/validation off', label: '/validation off', description: 'Disable output validation' },
      { cmd: '/validation verbose', label: '/validation verbose', description: 'Toggle verbose mode' },
      { cmd: '/validation strict', label: '/validation strict', description: 'Toggle strict mode' },
      { cmd: '/validation stats', label: '/validation stats', description: 'Show validation statistics' },
    ],
  },
  {
    category: 'Code & Git', color: '#8a2be2',
    items: [
      { cmd: '/undo', label: '/undo', description: 'Undo file changes' },
      { cmd: '/diff', label: '/diff', description: 'Show uncommitted git changes' },
      { cmd: '/git', label: '/git', description: 'Show git branch & status' },
      { cmd: '/project', label: '/project', description: 'Show project info' },
      { cmd: '/export', label: '/export', description: 'Export spiral as ZIP' },
    ],
  },
  {
    category: 'Account & Auth', color: '#00d4ff',
    items: [
      { cmd: '/login', label: '/login', description: 'Log in to HelixMind web platform' },
      { cmd: '/logout', label: '/logout', description: 'Log out and revoke API key' },
      { cmd: '/whoami', label: '/whoami', description: 'Show account & plan info' },
    ],
  },
  {
    category: 'Navigation', color: '#6c757d',
    items: [
      { cmd: '/exit', label: '/exit', description: 'Exit HelixMind' },
    ],
  },
];

/** Build flat MenuItem[] with category headers as disabled separators */
function buildHelpMenuItems(): { items: MenuItem[]; commands: string[] } {
  const items: MenuItem[] = [];
  const commands: string[] = [];

  for (const cat of HELP_CATEGORIES) {
    items.push({ label: chalk.hex(cat.color).bold(cat.category), disabled: true });
    commands.push('');

    for (const item of cat.items) {
      items.push({ label: theme.primary(item.label), description: item.description });
      commands.push(item.cmd);
    }
  }

  items.push({ label: '', disabled: true });
  commands.push('');
  items.push({ label: chalk.dim('ESC  Stop Agent  |  Ctrl+C  Clear  |  Tab  Autocomplete'), disabled: true });
  commands.push('');

  return { items, commands };
}

// Keep static HELP_TEXT as fallback for non-TTY
const HELP_TEXT = `
${chalk.hex('#00d4ff').bold('  Chat & Interaction')}
  ${theme.primary('/help'.padEnd(22))} ${theme.dim('Show this help')}
  ${theme.primary('/clear'.padEnd(22))} ${theme.dim('Clear conversation history')}
  ${theme.primary('/model [name]'.padEnd(22))} ${theme.dim('Switch model (interactive or direct: /model gpt-4o)')}
  ${theme.primary('/keys'.padEnd(22))} ${theme.dim('Add/remove/update API keys')}
  ${theme.primary('/yolo [on|off]'.padEnd(22))} ${theme.dim('Toggle YOLO mode — auto-approve ALL operations')}
  ${theme.primary('/skip-permissions'.padEnd(22))} ${theme.dim('Toggle skip-permissions (auto-approve safe ops)')}

${chalk.hex('#00ff88').bold('  Spiral Memory')}
  ${theme.primary('/spiral'.padEnd(22))} ${theme.dim('Show spiral status (nodes per level)')}
  ${theme.primary('/feed [path]'.padEnd(22))} ${theme.dim('Feed files into spiral (default: current dir)')}
  ${theme.primary('/context'.padEnd(22))} ${theme.dim('Show current context size & embeddings')}
  ${theme.primary('/compact'.padEnd(22))} ${theme.dim('Trigger spiral evolution (promote/demote nodes)')}
  ${theme.primary('/tokens'.padEnd(22))} ${theme.dim('Show token usage, checkpoints, memory')}

${chalk.hex('#4169e1').bold('  Visualization & Brain')}
  ${theme.primary('/brain'.padEnd(22))} ${theme.dim('Show brain scope + open 3D visualization')}
  ${theme.primary('/brain local'.padEnd(22))} ${theme.dim('Switch to project-local brain (.helixmind/)')}
  ${theme.primary('/brain global'.padEnd(22))} ${theme.dim('Switch to global brain (~/.spiral-context/)')}
  ${theme.primary('/helix'.padEnd(22))} ${theme.dim('Command Center + Brain (auto-start local)')}
  ${theme.primary('/helixlocal'.padEnd(22))} ${theme.dim('Command Center + local brain')}
  ${theme.primary('/helixglobal'.padEnd(22))} ${theme.dim('Command Center + global brain')}

${chalk.hex('#ff6600').bold('  Autonomous & Security')}
  ${theme.primary('/auto'.padEnd(22))} ${theme.dim('Autonomous mode \u2014 find & fix issues continuously')}
  ${theme.primary('/stop'.padEnd(22))} ${theme.dim('Stop autonomous mode')}
  ${theme.primary('/security'.padEnd(22))} ${theme.dim('Run comprehensive security audit (background)')}
  ${theme.primary('/sessions'.padEnd(22))} ${theme.dim('List all sessions & tabs')}
  ${theme.primary('/local'.padEnd(22))} ${theme.dim('Local LLM setup \u2014 Ollama models')}

${chalk.hex('#00cc66').bold('  Validation Matrix')}
  ${theme.primary('/validation'.padEnd(22))} ${theme.dim('Show validation mode')}
  ${theme.primary('/validation on'.padEnd(22))} ${theme.dim('Enable output validation')}
  ${theme.primary('/validation off'.padEnd(22))} ${theme.dim('Disable output validation')}
  ${theme.primary('/validation verbose'.padEnd(22))} ${theme.dim('Show every check detail')}
  ${theme.primary('/validation strict'.padEnd(22))} ${theme.dim('Treat warnings as errors')}
  ${theme.primary('/validation stats'.padEnd(22))} ${theme.dim('Show validation statistics')}

${chalk.hex('#8a2be2').bold('  Code & Git')}
  ${theme.primary('/undo [n|list]'.padEnd(22))} ${theme.dim('Undo last n file changes (or list history)')}
  ${theme.primary('/diff'.padEnd(22))} ${theme.dim('Show all uncommitted git changes')}
  ${theme.primary('/git'.padEnd(22))} ${theme.dim('Show git branch & status')}
  ${theme.primary('/project'.padEnd(22))} ${theme.dim('Show detected project info')}
  ${theme.primary('/export [dir]'.padEnd(22))} ${theme.dim('Export spiral as ZIP archive')}

${chalk.hex('#6c757d').bold('  Navigation')}
  ${theme.primary('/exit /quit'.padEnd(22))} ${theme.dim('Exit HelixMind')}
  ${theme.dim('  ESC'.padEnd(22))} ${theme.dim('Stop agent (immediately interrupts)')}
  ${theme.dim('  Ctrl+C'.padEnd(22))} ${theme.dim('Clear input (or double to force exit)')}
  ${theme.dim('  Tab'.padEnd(22))} ${theme.dim('Autocomplete command')}
`;

export async function chatCommand(options: ChatOptions): Promise<void> {
  const configDir = join(homedir(), '.helixmind');
  const store = new ConfigStore(configDir);
  let config = store.getAll();

  // Show logo early
  process.stdout.write(renderLogo());

  // ─── Auth Gate: require login on first use ───────────────────
  // Once logged in, credentials are cached locally.
  // Offline use works with cached auth — no server needed.
  if (!store.isLoggedIn()) {
    const { requireAuth } = await import('../auth/guard.js');
    await requireAuth();
    config = store.getAll();
  } else {
    // Background auth check: verify token is still valid when online.
    // If offline or server unreachable, cached auth stays valid silently.
    import('../auth/feature-gate.js').then(({ refreshPlanInfo }) => refreshPlanInfo(store)).catch(() => {});
  }

  // First-time setup: prompt for LLM API key if none configured
  if (!store.hasApiKey()) {
    const success = await runFirstTimeSetup(store);
    if (!success) {
      process.exit(1);
    }
    config = store.getAll();
  }

  // Create provider
  let provider: LLMProvider;
  try {
    provider = createProvider(config.provider, config.apiKey, config.model, config.providers[config.provider]?.baseURL);
  } catch (err) {
    renderError(`Failed to initialize provider: ${err}`);
    process.exit(1);
  }

  // Register rate limit handler for user-visible feedback
  const { onRateLimitWait } = await import('../providers/rate-limiter.js');
  onRateLimitWait((waitMs, reason) => {
    if (waitMs > 1000) {
      process.stdout.write(`\r\x1b[K  ${chalk.yellow('\u23F3')} ${chalk.dim(`Rate limit: waiting ${Math.ceil(waitMs / 1000)}s (${reason})`)}`);
    }
  });

  // Initialize agent tools
  await initializeTools();

  // Analyze project context
  const project = await analyzeProject(process.cwd());

  // Conversation history (for agent loop, we use ToolMessage format)
  const messages: ChatMessage[] = [];
  const agentHistory: ToolMessage[] = [];

  // Permission manager
  const permissions = new PermissionManager();
  if (options.yolo) permissions.setYolo(true);
  if (options.skipPermissions) permissions.setSkipPermissions(true);

  // Undo stack
  const undoStack = new UndoStack();

  // Checkpoint store
  const checkpointStore = new CheckpointStore();

  // Session buffer (working memory)
  const sessionBuffer = new SessionBuffer();

  // Activity indicator (replaces spinner)
  const activity = new ActivityIndicator();

  // Agent controller for pause/resume
  const agentController = new AgentController();
  let agentRunning = false;
  let autonomousMode = false;

  // Forward-declared findings handler (reassigned by control protocol if active)
  let pushFindingsToBrainFn: ((session: import('../sessions/session.js').Session) => void) | null = null;

  // Session Manager — manages background sessions (security, auto, etc.)
  const sessionMgr = new SessionManager({
    flags: {
      yolo: options.yolo ?? false,
      skipPermissions: options.skipPermissions ?? false,
    },
    onSessionComplete: (session) => {
      // Show notification in the terminal when a background session finishes
      if (session.id !== 'main') {
        process.stdout.write(renderSessionNotification(session));

        // Push findings to brain visualization (if browser is open)
        if (session.result?.text && pushFindingsToBrainFn) {
          pushFindingsToBrainFn(session);
        }

        updateStatusBar();
        // Re-prompt if user is idle — use showPrompt() for full separator+hint+statusbar
        if (!agentRunning) {
          showPrompt();
        }
      }
    },
    onSessionAutoClose: () => {
      // Tab was auto-removed after timeout — refresh the tab bar
      updateStatusBar();
    },
  });

  // Validation Matrix state
  let validationEnabled = options.validation !== false; // Default ON
  let validationVerbose = options.validationVerbose ?? false;
  let validationStrict = options.validationStrict ?? false;

  // Session metrics
  let sessionTokensInput = 0;
  let sessionTokensOutput = 0;
  let sessionToolCalls = 0;
  let roundToolCalls = 0;

  // Brain scope: project-local if .helixmind/ exists, else global
  // Auto-create .helixmind/ for new projects (opt-in for local brain)
  const { detectBrainScope, resolveDataDir: resolveSpiralDir, loadConfig: loadSpiralConfig } = await import('../../utils/config.js');
  const { mkdirSync, existsSync } = await import('node:fs');
  type BrainScope = 'project' | 'global';
  let brainScope: BrainScope = detectBrainScope(process.cwd());
  
  // Auto-create .helixmind/ if it doesn't exist (local brain by default for projects)
  const helixDir = join(process.cwd(), '.helixmind');
  if (!existsSync(helixDir)) {
    mkdirSync(helixDir, { recursive: true });
    renderInfo(chalk.dim('  Created .helixmind/ directory for local brain'));
    brainScope = 'project';
  }
  let spiralEngine: any = null;

  async function initSpiralEngine(scope: BrainScope): Promise<any> {
    try {
      const { SpiralEngine } = await import('../../spiral/engine.js');
      const dataDir = resolveSpiralDir(scope, process.cwd());
      const spiralConfig = loadSpiralConfig(dataDir);
      const engine = new SpiralEngine(spiralConfig);
      await engine.initialize();
      return engine;
    } catch {
      return null;
    }
  }

  if (config.spiral.enabled) {
    spiralEngine = await initSpiralEngine(brainScope);
  }

  // Create session start checkpoint
  checkpointStore.create({
    type: 'session_start',
    label: 'Session started',
    messageIndex: 0,
  });

  // Single message mode
  if (options.message) {
    await sendAgentMessage(
      options.message, agentHistory, provider, project, spiralEngine, config,
      permissions, undoStack, checkpointStore, agentController, activity, sessionBuffer,
      (inp, out) => { sessionTokensInput += inp; sessionTokensOutput += out; },
      () => { sessionToolCalls++; },
      undefined,
      { enabled: validationEnabled, verbose: validationVerbose, strict: validationStrict },
    );
    spiralEngine?.close();
    return;
  }

  // Interactive mode
  renderInfo(`  Provider: ${config.provider} | Model: ${config.model}`);
  if (project.name !== 'unknown') {
    renderInfo(`  Project: ${project.name} (${project.type})`);
  }
  const brainLabel = brainScope === 'project'
    ? chalk.cyan('project-local') + chalk.dim(` (.helixmind/)`)
    : chalk.dim('global') + chalk.dim(` (~/.spiral-context/)`);
  renderInfo(`  Brain: ${brainLabel}`);

  // Show mode-specific startup info
  const modeLabel = permissions.getModeLabel();
  renderInfo(`  Agent mode: ${modeLabel} permissions`);

  // Show warnings for skip-permissions / yolo
  if (options.skipPermissions && options.yolo) {
    showFullAutonomousWarning();
  } else if (options.skipPermissions) {
    showSkipPermissionsWarning();
  }

  // === Start Brain Server BEFORE prompt (no async output during typing) ===
  let brainUrl: string | null = null;
  if (spiralEngine && config.spiral.enabled) {
    try {
      const { exportBrainData } = await import('../brain/exporter.js');
      const { startLiveBrain } = await import('../brain/generator.js');
      const data = exportBrainData(spiralEngine, project.name || 'HelixMind', brainScope);
      if (data.meta.totalNodes > 0) {
        brainUrl = await startLiveBrain(spiralEngine, project.name || 'HelixMind', brainScope);
        renderInfo(`  \u{1F9E0} Brain: ${chalk.dim(brainUrl)}`);
      }
    } catch { /* brain server optional */ }
  }

  // === Register CLI ↔ Web control protocol ===
  if (brainUrl) {
    try {
      const {
        registerControlHandlers,
        setInstanceMeta,
        getBrainToken,
        pushSessionCreated,
        pushSessionUpdate,
        pushSessionRemoved,
        pushOutputLine,
        startRelayClient,
      } = await import('../brain/generator.js');
      const { serializeSession, buildInstanceMeta, resetInstanceStartTime } = await import('../brain/control-protocol.js');

      resetInstanceStartTime();

      // Collected findings for getFindings() handler
      const collectedFindings: import('../brain/control-protocol.js').Finding[] = [];

      // Set instance metadata for discovery
      const instanceId = (await import('node:crypto')).randomUUID().slice(0, 8);
      const updateMeta = () => {
        const meta = buildInstanceMeta(
          project.name || 'HelixMind',
          process.cwd(),
          config.model,
          config.provider,
          '0.1.0',
          instanceId,
        );
        setInstanceMeta(meta);
        return meta;
      };
      updateMeta();

      // Wire output streaming: when any session captures output, push to control clients
      const wireSessionOutput = (session: import('../sessions/session.js').Session) => {
        session.onCapture = (line, index) => {
          pushOutputLine(session.id, line, index);
        };
      };

      // Register control handlers
      registerControlHandlers({
        listSessions: () => sessionMgr.all.map(serializeSession),

        startAuto: (goal?) => {
          const sessionName = goal ? `\u{1F504} Auto: ${goal.slice(0, 30)}` : '\u{1F504} Auto';
          const bgSession = sessionMgr.create(sessionName, '\u{1F504}', agentHistory);
          bgSession.start();
          wireSessionOutput(bgSession);
          pushSessionCreated(serializeSession(bgSession));

          // Trigger autonomous mode (same as /auto start)
          autonomousMode = true;
          (async () => {
            const completed: string[] = [];
            try {
              await runAutonomousLoop({
                sendMessage: async (prompt) => {
                  bgSession.controller.reset();
                  const resultTextHolder = { text: '' };
                  const origAddSummary = bgSession.buffer.addAssistantSummary.bind(bgSession.buffer);
                  bgSession.buffer.addAssistantSummary = (t: string) => {
                    resultTextHolder.text = t;
                    origAddSummary(t);
                  };
                  await sendAgentMessage(
                    prompt, bgSession.history, provider, project, spiralEngine, config,
                    permissions, bgSession.undoStack, checkpointStore,
                    bgSession.controller, new ActivityIndicator(), bgSession.buffer,
                    (inp, out) => { sessionTokensInput += inp; sessionTokensOutput += out; },
                    () => { sessionToolCalls++; },
                    undefined,
                    { enabled: false, verbose: false, strict: false },
                  );
                  bgSession.buffer.addAssistantSummary = origAddSummary;
                  return resultTextHolder.text;
                },
                isAborted: () => !autonomousMode || bgSession.controller.isAborted,
                onRoundStart: (round) => {
                  bgSession.controller.reset();
                  bgSession.capture(`Round ${round}...`);
                },
                onRoundEnd: (_round, summary) => {
                  completed.push(summary);
                  bgSession.capture(`\u2713 ${summary}`);
                  pushSessionUpdate(serializeSession(bgSession));
                },
                updateStatus: () => updateStatusBar(),
              }, goal);
            } catch (err) {
              if (!(err instanceof AgentAbortError)) {
                bgSession.capture(`Error: ${err}`);
              }
            }
            autonomousMode = false;
            sessionMgr.complete(bgSession.id, {
              text: completed.join('\n'),
              steps: [],
              errors: bgSession.controller.isAborted ? ['Aborted by user'] : [],
              durationMs: bgSession.elapsed,
            });
            pushSessionUpdate(serializeSession(bgSession));
          })();

          return bgSession.id;
        },

        startSecurity: () => {
          const bgSession = sessionMgr.create('\u{1F512} Security', '\u{1F512}', agentHistory);
          bgSession.start();
          wireSessionOutput(bgSession);
          pushSessionCreated(serializeSession(bgSession));

          runBackgroundSession(
            bgSession, SECURITY_PROMPT, provider, project, spiralEngine, config,
            permissions, checkpointStore,
            (inp, out) => { sessionTokensInput += inp; sessionTokensOutput += out; },
            () => { sessionToolCalls++; },
            { enabled: validationEnabled, verbose: validationVerbose, strict: validationStrict },
          ).then(result => {
            sessionMgr.complete(bgSession.id, result);
            pushSessionUpdate(serializeSession(bgSession));
          }).catch(err => {
            if (!(err instanceof AgentAbortError)) {
              sessionMgr.complete(bgSession.id, {
                text: '',
                steps: [],
                errors: [err instanceof Error ? err.message : String(err)],
                durationMs: bgSession.elapsed,
              });
              pushSessionUpdate(serializeSession(bgSession));
            }
          });

          return bgSession.id;
        },

        abortSession: (sessionId) => {
          const session = sessionMgr.get(sessionId);
          if (!session) return false;
          sessionMgr.abort(sessionId);
          pushSessionUpdate(serializeSession(session));
          return true;
        },

        sendChat: (text) => {
          // Queue chat text to be processed as if the user typed it
          typeAheadBuffer.push(text);
        },

        getFindings: () => [...collectedFindings],
      });

      // Override forward-reference to also collect findings for control protocol
      pushFindingsToBrainFn = (session) => {
        pushFindingsToBrain(session);
        // Also collect findings for the control protocol
        const text = session.result?.text || '';
        const severityPatterns = [
          { regex: /\*\*CRITICAL\*\*[:\s]*(.+?)(?:\n|$)/gi, severity: 'critical' as const },
          { regex: /\*\*HIGH\*\*[:\s]*(.+?)(?:\n|$)/gi, severity: 'high' as const },
          { regex: /\*\*MEDIUM\*\*[:\s]*(.+?)(?:\n|$)/gi, severity: 'medium' as const },
          { regex: /\*\*LOW\*\*[:\s]*(.+?)(?:\n|$)/gi, severity: 'low' as const },
          { regex: /DONE:\s*(.+?)(?:\n|$)/gi, severity: 'info' as const },
        ];
        for (const { regex, severity } of severityPatterns) {
          let match;
          while ((match = regex.exec(text)) !== null) {
            const finding = match[1].trim();
            if (finding.length > 5) {
              const fileMatch = finding.match(/(?:in |file[:\s]+|path[:\s]+)([^\s,]+\.\w+)/i);
              collectedFindings.push({
                sessionName: session.name,
                finding,
                severity,
                file: fileMatch?.[1] || '',
                timestamp: Date.now(),
              });
            }
          }
        }
      };

      // Log connection token
      const token = getBrainToken();
      if (token) {
        renderInfo(`  \u{1F511} Brain token: ${chalk.dim(token.slice(-4))} ${chalk.dim('(full token in /brain)')}`);
      }

      // Start relay client if configured
      const relayUrl = config.relay?.url as string | undefined;
      const relayApiKey = config.relay?.apiKey as string | undefined;
      if (relayUrl && relayApiKey) {
        startRelayClient(relayUrl, relayApiKey, {
          listSessions: () => sessionMgr.all.map(serializeSession),
          startAuto: (goal?) => { /* relay delegates to local handlers — already registered */ return ''; },
          startSecurity: () => '',
          abortSession: (id) => { sessionMgr.abort(id); return true; },
          sendChat: (text) => { typeAheadBuffer.push(text); },
          getFindings: () => [...collectedFindings],
        }, updateMeta).catch(() => {});
      }
    } catch { /* control protocol optional */ }
  }

  renderInfo(`  Type /help for commands, ESC = stop agent, Ctrl+C twice to exit\n`);
  process.stdout.write(theme.separator + '\n');

  // Flag: true while user is at the prompt (typing). Footer timer skips updates
  // when this is true to prevent cursor-jumping from interfering with readline.
  let isAtPrompt = false;

  // Flag: true while inline progress (\r\x1b[K) is actively writing.
  // Suppresses the footer timer to prevent cursor-jumping flicker.
  let inlineProgressActive = false;

  // Wrap renderFeedProgress to automatically suppress footer timer during feed
  const wrappedFeedProgress = (progress: FeedProgress) => {
    inlineProgressActive = progress.stage !== 'done';
    renderFeedProgress(progress);
  };

  // Guard: ignore line events shortly after a sub-menu that used its own readline
  // (e.g. /model → Add provider → askText). The sub-readline can leave phantom
  // line events on stdin that would be misinterpreted as user messages.
  let drainUntil = 0;

  /**
   * Build the readline prompt string. Must be a SINGLE line with ANSI codes
   * wrapped in \x01..\x02 so readline can correctly compute visible width
   * and position the cursor where the user types.
   */
  function makePrompt(): string {
    const ansiStart = '\x01'; // RL_PROMPT_START_IGNORE
    const ansiEnd = '\x02';   // RL_PROMPT_END_IGNORE
    // Wrap each ANSI escape sequence so readline ignores it for width calculation
    const gt = chalk.hex('#00d4ff').bold('>');
    const escaped = gt.replace(/(\x1b\[[0-9;]*m)/g, `${ansiStart}$1${ansiEnd}`);
    return `${escaped} `;
  }

  /**
   * Show the full prompt area:
   *   ──────────────────
   *   ▸▸ safe permissions · esc = stop · /help
   *   🌀 L1:... | tokens | model | git
   *   > _                    ← cursor here (last line)
   *
   * Info is written ABOVE the prompt as normal scrolling text.
   * The prompt is always the last line — no ANSI cursor tricks needed.
   */
  function showPrompt(): void {
    const w = Math.max(20, (process.stdout.columns || 80) - 2);
    const sep = chalk.hex('#00d4ff').dim('\u2500'.repeat(w));
    const data = getStatusBarData();
    const bar = renderStatusBar(data, w);
    // Build hint line
    const hints: string[] = [];
    if (data.permissionMode === 'yolo') hints.push(chalk.red('\u25B8\u25B8 yolo mode'));
    else if (data.permissionMode === 'skip') hints.push(chalk.yellow('\u25B8\u25B8 skip permissions'));
    else hints.push(chalk.green('\u25B8\u25B8 safe permissions'));
    hints.push(chalk.dim('esc = stop'));
    hints.push(chalk.dim('/help'));
    const hintLine = hints.join(chalk.dim(' \u00B7 '));
    // Write info above the prompt, then the prompt as the last line
    isAtPrompt = true;
    process.stdout.write(`\n${sep}\n ${hintLine}\n ${bar}\n`);
    rl.prompt();
  }

  /** Build current status bar data object */
  function getStatusBarData(): StatusBarData {
    const spiralStatus = spiralEngine ? spiralEngine.status() : null;
    const git = getGitInfo(process.cwd());
    const l6Count = spiralEngine ? spiralEngine.webKnowledgeCount() : 0;
    return {
      spiral: spiralStatus ? {
        l1: spiralStatus.per_level[1] ?? 0,
        l2: spiralStatus.per_level[2] ?? 0,
        l3: spiralStatus.per_level[3] ?? 0,
        l4: spiralStatus.per_level[4] ?? 0,
        l5: spiralStatus.per_level[5] ?? 0,
        l6: l6Count,
      } : { l1: 0, l2: 0, l3: 0, l4: 0, l5: 0, l6: 0 },
      sessionTokens: sessionTokensInput + sessionTokensOutput,
      tokens: {
        thisMessage: sessionTokensOutput,
        thisSession: sessionTokensInput + sessionTokensOutput,
      },
      tools: { callsThisRound: roundToolCalls },
      model: config.model,
      git,
      checkpoints: checkpointStore.count,
      permissionMode: permissions.getModeLabel(),
      autonomous: autonomousMode,
      paused: agentController.isPaused,
      plan: (store.get('relay.plan') as string | undefined) ?? undefined,
    };
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: makePrompt(),
    completer: (line: string) => {
      if (line.startsWith('/')) {
        const matches = getSuggestions(line).map(s => s.cmd);
        return [matches.length > 0 ? matches : [], line];
      }
      return [[], line];
    },
  });

  // Update prompt and activity scroll region on terminal resize
  process.stdout.on('resize', () => {
    rl.setPrompt(makePrompt());
    activity.handleResize();
  });

  // Track suggestion overlay state
  let lastSuggestionCount = 0;

  permissions.setReadline(rl);
  permissions.setPromptCallback((active) => { isAtPrompt = active; });

  // Activity indicator renders on the bottom terminal row (absolute positioned,
  // same row as statusbar). The footer timer already skips statusbar draws when
  // activity.isAnimating is true, so there's no conflict.

  // Ctrl+C behavior:
  // - If there's text on the line → clear the line (like a normal terminal)
  // - If line is empty → count towards exit (double Ctrl+C = exit)
  let ctrlCCount = 0;
  let ctrlCTimer: ReturnType<typeof setTimeout> | null = null;

  process.on('SIGINT', () => {
    // If agent is running, treat Ctrl+C as interrupt
    if (agentRunning) {
      activity.stop('Stopped');
      agentController.abort();
      autonomousMode = false;
      process.stdout.write('\n');
      renderInfo('\u23F9 Agent interrupted.');
      return;
    }

    // Check if readline has text on the current line
    const currentLine = (rl as any).line || '';
    if (currentLine.length > 0) {
      // Clear current input — write a new line and re-prompt
      process.stdout.write('\n');
      (rl as any).line = '';
      (rl as any).cursor = 0;
      isAtPrompt = true;
      rl.prompt();
      ctrlCCount = 0;
      return;
    }

    // Empty line — count towards exit
    ctrlCCount++;
    if (ctrlCCount >= 2) {
      process.stdout.write('\n');
      renderInfo('Force exit \u2014 saving state...');
      if (spiralEngine) {
        try {
          spiralEngine.saveState(messages).catch(() => {});
        } catch { /* best effort */ }
        spiralEngine.close();
      }
      // Stop brain server
      import('../brain/generator.js').then(m => m.stopLiveBrain()).catch(() => {});
      process.exit(0);
    }

    process.stdout.write('\n');
    renderInfo('Press Ctrl+C again to exit, or type a message to continue.');
    isAtPrompt = true;
    rl.prompt();

    if (ctrlCTimer) clearTimeout(ctrlCTimer);
    ctrlCTimer = setTimeout(() => { ctrlCCount = 0; }, 2000);
  });

  /** Register brain event handlers (voice, scope switch) — reusable for auto-start and /brain */
  async function registerBrainHandlers(): Promise<void> {
    const { onBrainVoiceInput, onBrainScopeSwitch, pushScopeChange, onBrainModelActivate, pushModelActivated } = await import('../brain/generator.js');

    onBrainVoiceInput((text) => {
      process.stdout.write('\r\x1b[K');
      process.stdout.write(`  ${chalk.dim('\u{1F3A4} Voice:')} ${chalk.cyan(text)}\n`);
      rl.write(null as any, { ctrl: true, name: 'u' });
      rl.write(text);
    });

    onBrainModelActivate(async (modelName) => {
      try {
        // Ensure Ollama is registered as a provider
        store.addProvider('ollama', 'ollama', 'http://localhost:11434/v1');
        store.switchProvider('ollama', modelName);
        config = store.getAll();
        provider = createProvider('ollama', 'ollama', modelName, 'http://localhost:11434/v1');
        pushModelActivated(modelName);

        process.stdout.write(`\n  ${chalk.green('\u26A1')} Model activated: ${chalk.cyan(modelName)} ${chalk.dim('(ollama)')}\n`);
        isAtPrompt = true;
        rl.prompt();
      } catch (err) {
        process.stdout.write(`\n  ${chalk.red('Model activation failed:')} ${err}\n`);
        isAtPrompt = true;
        rl.prompt();
      }
    });

    onBrainScopeSwitch(async (newScope) => {
      if (newScope === brainScope) return;
      try {
        if (spiralEngine) {
          try { spiralEngine.close(); } catch { /* best effort */ }
        }
        brainScope = newScope;
        if (newScope === 'project') {
          const { mkdirSync, existsSync } = await import('node:fs');
          const { join } = await import('node:path');
          const helixDir = join(process.cwd(), '.helixmind');
          if (!existsSync(helixDir)) mkdirSync(helixDir, { recursive: true });
        }
        spiralEngine = await initSpiralEngine(newScope);

        const { exportBrainData } = await import('../brain/exporter.js');
        const { startLiveBrain } = await import('../brain/generator.js');
        await startLiveBrain(spiralEngine, project.name || 'HelixMind', newScope);
        pushScopeChange(newScope);

        const scopeLabel = newScope === 'project'
          ? chalk.cyan('\u{1F4C1} project-local (.helixmind/)')
          : chalk.dim('\u{1F310} global (~/.spiral-context/)');
        process.stdout.write(`\n  \u{1F9E0} Brain switched to ${scopeLabel}\n`);
        isAtPrompt = true;
        rl.prompt();
      } catch (err) {
        process.stdout.write(`\n  ${chalk.red('Brain switch failed:')} ${err}\n`);
        isAtPrompt = true;
        rl.prompt();
      }
    });
  }

  // Register brain handlers if server was started during startup
  if (brainUrl) {
    registerBrainHandlers().catch(() => {});
  }

  // Keybinding state for double-ESC detection
  const keyState = createKeybindingState();

  // Handle raw keypresses for double-ESC + command suggestions
  if (process.stdin.isTTY) {
    process.stdin.on('keypress', async (_str: string, key: any) => {
      if (!key) return;

      // === Tab switching: Ctrl+PageUp / Ctrl+PageDown ===
      if (key.ctrl && key.name === 'pageup') {
        sessionMgr.switchPrev();
        writeTabBar();
        return;
      }
      if (key.ctrl && key.name === 'pagedown') {
        sessionMgr.switchNext();
        writeTabBar();
        return;
      }

      // === Command Suggestions ===
      if (!agentRunning) {
        const currentLine = ((rl as any).line || '') as string;
        if (currentLine.startsWith('/') && currentLine.length >= 2) {
          const suggestions = getSuggestions(currentLine);
          // Clear old suggestions
          if (lastSuggestionCount > 0) clearSuggestions(lastSuggestionCount);
          // Show new ones
          if (suggestions.length > 0) writeSuggestions(suggestions);
          lastSuggestionCount = suggestions.length;
        } else {
          // Clear suggestions when not typing a command
          if (lastSuggestionCount > 0) {
            clearSuggestions(lastSuggestionCount);
            lastSuggestionCount = 0;
          }
        }
      }

      // === ESC detection ===
      // Single ESC stops immediately when agent is running
      // Double ESC works as fallback anytime
      if (key.name === 'escape') {
        if (agentRunning || sessionMgr.hasBackgroundTasks || autonomousMode) {
          // Clear any suggestions
          if (lastSuggestionCount > 0) {
            clearSuggestions(lastSuggestionCount);
            lastSuggestionCount = 0;
          }

          // IMMEDIATE STOP — single ESC press
          activity.stop('Stopped');
          agentController.abort();
          sessionMgr.abortAll();
          autonomousMode = false;

          // Clear type-ahead buffer to prevent agent restarting after abort
          typeAheadBuffer.length = 0;

          // Reset agent state immediately (don't wait for async propagation)
          agentRunning = false;

          process.stdout.write('\n');
          renderInfo(chalk.red('\u23F9 STOPPED') + chalk.dim(' \u2014 All agents interrupted.'));

          // Restore prompt so user can type again
          showPrompt();
          return;
        }
      }

      // Double-ESC detection (for checkpoint browser when nothing is running)
      const result = processKeypress(key, keyState);
      if (result.action === 'open_browser' && !agentRunning) {
        // Open checkpoint browser
        rl.pause();
        try {
          const browserResult = await runCheckpointBrowser({
            store: checkpointStore,
            agentHistory,
            simpleMessages: messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' })),
            isPaused: false,
          });

          if (browserResult.action === 'revert') {
            const r = browserResult.result;
            process.stdout.write('\n');
            if (r.messagesRemoved > 0) renderInfo(chalk.yellow(`${r.messagesRemoved} message(s) reverted`));
            if (r.filesReverted > 0) renderInfo(chalk.yellow(`${r.filesReverted} file(s) reverted`));
          }
        } catch {
          // Browser closed unexpectedly
        }
        rl.resume();
        showPrompt();
      }
    });
  }

  // Update statusbar — uses save/restore cursor (DECSC/DECRC).
  // Only called during agent work to update token counts etc.
  function updateStatusBar(): void {
    if (!process.stdout.isTTY) return;
    const data = getStatusBarData();
    writeStatusBar(data);

    // Draw tab bar if there are background sessions, otherwise clear stale tab bar
    if (sessionMgr.all.length > 1) {
      writeTabBar();
    } else {
      // Clear the tab bar row when no background sessions remain
      clearTabBarRow();
    }
  }

  /** Clear the tab bar row (row N-1) to remove stale tab bar text */
  function clearTabBarRow(): void {
    if (!process.stdout.isTTY) return;
    const termHeight = process.stdout.rows || 24;
    process.stdout.write(
      `\x1b7` +                           // Save cursor
      `\x1b[${termHeight - 1};0H` +       // Move to tab bar row
      `\x1b[2K` +                          // Clear line
      `\x1b8`,                             // Restore cursor
    );
  }

  /** Draw the session tab bar above the statusbar */
  function writeTabBar(): void {
    if (!process.stdout.isTTY) return;
    if (sessionMgr.all.length <= 1) return;

    const tabBar = sessionMgr.renderTabs();
    const termHeight = process.stdout.rows || 24;
    const termWidth = (process.stdout.columns || 80) - 2;

    // Truncate tab bar to terminal width to prevent overflow into other rows
    const safeTabBar = truncateBar(tabBar, termWidth);

    // Write tab bar above the statusbar (termHeight - 1)
    // Layout: ..., tabbar(N-1), statusbar(N)
    process.stdout.write(
      `\x1b7` +                           // Save cursor
      `\x1b[${termHeight - 1};0H` +       // Move to row above statusbar
      `\x1b[2K` +                          // Clear line
      ` ${safeTabBar}` +                   // Tab bar (truncated to fit)
      `\x1b8`,                             // Restore cursor
    );
  }

  /** Push session findings to brain visualization */
  function pushFindingsToBrain(session: import('../sessions/session.js').Session): void {
    import('../brain/generator.js').then(mod => {
      if (!mod.isBrainServerRunning()) return;
      const text = session.result?.text || '';
      const sessionName = session.name;

      // Parse findings from security/auto output — look for severity markers
      const severityPatterns = [
        { regex: /\*\*CRITICAL\*\*[:\s]*(.+?)(?:\n|$)/gi, severity: 'critical' as const },
        { regex: /\*\*HIGH\*\*[:\s]*(.+?)(?:\n|$)/gi, severity: 'high' as const },
        { regex: /\*\*MEDIUM\*\*[:\s]*(.+?)(?:\n|$)/gi, severity: 'medium' as const },
        { regex: /\*\*LOW\*\*[:\s]*(.+?)(?:\n|$)/gi, severity: 'low' as const },
        { regex: /DONE:\s*(.+?)(?:\n|$)/gi, severity: 'info' as const },
      ];

      for (const { regex, severity } of severityPatterns) {
        let match;
        while ((match = regex.exec(text)) !== null) {
          const finding = match[1].trim();
          if (finding.length > 5) {
            // Try to extract file path from the finding text
            const fileMatch = finding.match(/(?:in |file[:\s]+|path[:\s]+)([^\s,]+\.\w+)/i);
            mod.pushAgentFinding(sessionName, finding, severity, fileMatch?.[1]);
          }
        }
      }

      // If no structured findings found but text exists, push a summary
      if (text.length > 20) {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          const summary = lines[0].slice(0, 120);
          mod.pushAgentFinding(sessionName, summary, 'info');
        }
      }
    }).catch(() => {});
  }
  // Set forward-reference for session completion callback
  pushFindingsToBrainFn = pushFindingsToBrain;

  // Type-ahead buffer: stores user input submitted while agent is running
  const typeAheadBuffer: string[] = [];

  // Paste detection — collects rapid-fire line events into a buffer
  let pasteBuffer: string[] = [];
  let pasteTimer: ReturnType<typeof setTimeout> | null = null;
  const PASTE_THRESHOLD_MS = 50; // Lines arriving faster than this = paste

  // Show full prompt area on startup (separator + status + > prompt)
  showPrompt();

  // Footer timer — redraws status bar during agent work (absolute positioning).
  // Skipped when:
  //   - user is at readline prompt (isAtPrompt) — prevents cursor-jumping
  //   - activity indicator is animating — prevents flicker collision
  //   - inline progress active (inlineProgressActive) — prevents flicker over feed progress
  const footerTimer = setInterval(() => {
    if (process.stdout.isTTY && !isAtPrompt && !activity.isAnimating && !inlineProgressActive) updateStatusBar();
  }, 500);
  footerTimer.unref();

  /** Process a complete input (single line or assembled paste block) */
  async function processInput(input: string): Promise<void> {

    // Handle /feed directly here (needs access to inlineProgressActive flag)
    if (input.startsWith('/feed')) {
      if (spiralEngine) {
        const feedPath = input.split(/\s+/)[1];
        const rootDir = process.cwd();
        renderInfo('\u{1F300} Feeding project...\n');
        try {
          const result = await runFeedPipeline(rootDir, spiralEngine, {
            targetPath: feedPath,
            onProgress: wrappedFeedProgress,
          });
          renderFeedSummary(result);
          checkpointStore.create({
            type: 'feed',
            label: `Feed ${feedPath || './'}`,
            messageIndex: agentHistory.length,
          });
        } catch (err) {
          inlineProgressActive = false;
          renderError(`Feed failed: ${err}`);
        }
      } else {
        renderInfo('Spiral engine not available.');
      }
      showPrompt();
      return;
    }

    // Handle slash commands
    if (input.startsWith('/')) {
      const handled = await handleSlashCommand(
        input, messages, agentHistory, config, spiralEngine, store, rl,
        permissions, undoStack, checkpointStore, sessionBuffer,
        { input: sessionTokensInput, output: sessionTokensOutput },
        sessionToolCalls,
        (newProvider) => { provider = newProvider; config = store.getAll(); },
        async (newScope) => {
          // Switch brain scope
          if (spiralEngine) {
            try { spiralEngine.close(); } catch { /* best effort */ }
          }
          brainScope = newScope;
          // Create .helixmind/ dir if switching to project and it doesn't exist
          if (newScope === 'project') {
            const { mkdirSync, existsSync } = await import('node:fs');
            const projDir = join(process.cwd(), '.helixmind');
            if (!existsSync(projDir)) {
              mkdirSync(projDir, { recursive: true });
              renderInfo(chalk.dim('  Created .helixmind/ directory'));
            }
          }
          spiralEngine = await initSpiralEngine(newScope);
        },
        brainScope,
        async (action, goal?) => {
          if (action === 'stop') {
            // Stop all background sessions + autonomous mode
            const running = sessionMgr.running;
            if (running.length > 0) {
              for (const s of running) {
                s.abort();
                renderInfo(`\u23F9 Stopped: ${s.icon} ${s.name}`);
              }
              autonomousMode = false;
              updateStatusBar();
            } else if (autonomousMode) {
              autonomousMode = false;
              agentController.abort();
              renderInfo('\u23F9 Stopping autonomous mode...');
            } else {
              renderInfo('No background sessions running.');
            }
            return;
          }

          if (action === 'security') {
            // Security audit — runs as BACKGROUND SESSION
            const bgSession = sessionMgr.create('\u{1F512} Security', '\u{1F512}', agentHistory);
            bgSession.start();
            renderInfo(`${chalk.hex('#00d4ff')('\u{1F512}')} Security audit started ${chalk.dim(`[session ${bgSession.id}]`)}`);
            updateStatusBar();

            // Run in background — don't await, user gets prompt back immediately
            runBackgroundSession(
              bgSession, SECURITY_PROMPT, provider, project, spiralEngine, config,
              permissions, checkpointStore,
              (inp, out) => { sessionTokensInput += inp; sessionTokensOutput += out; },
              () => { sessionToolCalls++; },
              { enabled: validationEnabled, verbose: validationVerbose, strict: validationStrict },
            ).then(result => {
              sessionMgr.complete(bgSession.id, result);
            }).catch(err => {
              if (!(err instanceof AgentAbortError)) {
                sessionMgr.complete(bgSession.id, {
                  text: '',
                  steps: [],
                  errors: [err instanceof Error ? err.message : String(err)],
                  durationMs: bgSession.elapsed,
                });
              }
            });
            return;
          }

          if (action === 'start') {
            // Check if autonomous is already running
            const existingAuto = sessionMgr.background.find(
              s => s.name.includes('Auto') && s.status === 'running',
            );
            if (existingAuto) {
              renderInfo('Autonomous mode already running.');
              return;
            }

            // Enter autonomous mode as BACKGROUND SESSION
            autonomousMode = true;
            const sessionName = goal ? `\u{1F504} Auto: ${goal.slice(0, 30)}` : '\u{1F504} Auto';
            const bgSession = sessionMgr.create(sessionName, '\u{1F504}', agentHistory);
            bgSession.start();
            const goalHint = goal ? ` \u2014 ${chalk.white(goal.length > 50 ? goal.slice(0, 47) + '...' : goal)}` : '';
            renderInfo(`${chalk.hex('#ff6600')('\u{1F504}')} Autonomous mode started${goalHint} ${chalk.dim(`[session ${bgSession.id}]`)}`);
            updateStatusBar();

            // Run in background — user keeps their prompt
            (async () => {
              const completed: string[] = [];
              try {
                await runAutonomousLoop({
                  sendMessage: async (prompt) => {
                    bgSession.controller.reset();

                    const resultTextHolder = { text: '' };
                    const origAddSummary = bgSession.buffer.addAssistantSummary.bind(bgSession.buffer);
                    bgSession.buffer.addAssistantSummary = (t: string) => {
                      resultTextHolder.text = t;
                      origAddSummary(t);
                    };

                    await sendAgentMessage(
                      prompt, bgSession.history, provider, project, spiralEngine, config,
                      permissions, bgSession.undoStack, checkpointStore,
                      bgSession.controller, new ActivityIndicator(), bgSession.buffer,
                      (inp, out) => { sessionTokensInput += inp; sessionTokensOutput += out; },
                      () => { sessionToolCalls++; },
                      undefined,
                      { enabled: false, verbose: false, strict: false },
                    );

                    bgSession.buffer.addAssistantSummary = origAddSummary;
                    return resultTextHolder.text;
                  },
                  isAborted: () => !autonomousMode || bgSession.controller.isAborted,
                  onRoundStart: (round) => {
                    bgSession.controller.reset();
                    bgSession.capture(`Round ${round}...`);
                  },
                  onRoundEnd: (_round, summary) => {
                    completed.push(summary);
                    bgSession.capture(`\u2713 ${summary}`);
                    updateStatusBar();
                  },
                  updateStatus: () => updateStatusBar(),
                }, goal);
              } catch (err) {
                if (!(err instanceof AgentAbortError)) {
                  bgSession.capture(`Error: ${err}`);
                }
              }

              autonomousMode = false;
              sessionMgr.complete(bgSession.id, {
                text: completed.join('\n'),
                steps: [],
                errors: bgSession.controller.isAborted ? ['Aborted by user'] : [],
                durationMs: bgSession.elapsed,
              });
              updateStatusBar();
            })();
          }
        },
        (action) => {
          // /validation handler
          switch (action) {
            case 'on':
              validationEnabled = true;
              renderInfo('Validation Matrix: ON');
              break;
            case 'off':
              validationEnabled = false;
              renderInfo('Validation Matrix: OFF');
              break;
            case 'verbose':
              validationVerbose = !validationVerbose;
              renderInfo(`Validation verbose: ${validationVerbose ? 'ON' : 'OFF'}`);
              break;
            case 'strict':
              validationStrict = !validationStrict;
              renderInfo(`Validation strict: ${validationStrict ? 'ON' : 'OFF'}`);
              break;
            case 'stats':
              getValidationStats(spiralEngine).then(stats => {
                if (stats) {
                  process.stdout.write(renderValidationStats(stats));
                } else {
                  renderInfo('No validation statistics yet.');
                }
              }).catch(() => renderInfo('Could not load stats.'));
              break;
            default:
              renderInfo(`Validation Matrix: ${validationEnabled ? 'ON' : 'OFF'} | Verbose: ${validationVerbose ? 'ON' : 'OFF'} | Strict: ${validationStrict ? 'ON' : 'OFF'}`);
          }
        },
        sessionMgr,
        registerBrainHandlers,
        (active) => { isAtPrompt = active; },
      );
      if (handled === 'exit') {
        spiralEngine?.close();
        rl.close();
        process.exit(0);
      }
      if (handled === 'drain') {
        // Sub-menu used its own readline — ignore line events for 500ms
        drainUntil = Date.now() + 500;
      }
      showPrompt();
      return;
    }

    // Render user message explicitly so it persists in the chat scroll history.
    // Readline's prompt echo can be overwritten by activity indicator / agent output.
    renderUserMessage(input);

    // Track user message in session buffer
    sessionBuffer.addUserMessage(input);

    // Create checkpoint for user message
    checkpointStore.createForChat(input, agentHistory.length);

    // === TYPE-AHEAD SUPPORT ===
    // Don't pause readline — let user type next prompt while agent works.
    // Buffer submitted lines during agent execution for processing after.
    // Show hint so user knows they can still type.
    process.stdout.write(chalk.dim('  \u{1F4AC} Type-ahead active \u2014 input queued for after agent finishes\n'));

    // Send message through agent loop
    roundToolCalls = 0;
    agentRunning = true;
    agentController.reset();
    updateStatusBar();

    await sendAgentMessage(
      input, agentHistory, provider, project, spiralEngine, config,
      permissions, undoStack, checkpointStore, agentController, activity, sessionBuffer,
      (inp, out) => {
        sessionTokensInput += inp;
        sessionTokensOutput += out;
      },
      () => {
        sessionToolCalls++;
        roundToolCalls++;
      },
      () => {
        // Activity started — readline stays active for type-ahead buffering
        // but we do NOT show a visible prompt (it would collide with tool output)
        isAtPrompt = false;
      },
      { enabled: validationEnabled, verbose: validationVerbose, strict: validationStrict },
    );

    agentRunning = false;

    // Keep simple message history for state persistence
    messages.push({ role: 'user', content: input });

    // Process any type-ahead input that was buffered during agent work
    // Skip if agent was aborted (ESC already cleared the buffer, but guard against race)
    while (typeAheadBuffer.length > 0 && !agentController.isAborted) {
      const buffered = typeAheadBuffer.shift()!;
      if (buffered.trim()) {
        // Process the buffered input as if user just typed it
        sessionBuffer.addUserMessage(buffered.trim());
        checkpointStore.createForChat(buffered.trim(), agentHistory.length);

        roundToolCalls = 0;
        agentRunning = true;
        agentController.reset();
        updateStatusBar();

        await sendAgentMessage(
          buffered.trim(), agentHistory, provider, project, spiralEngine, config,
          permissions, undoStack, checkpointStore, agentController, activity, sessionBuffer,
          (inp, out) => { sessionTokensInput += inp; sessionTokensOutput += out; },
          () => { sessionToolCalls++; roundToolCalls++; },
          () => { isAtPrompt = true; rl.prompt(); },
          { enabled: validationEnabled, verbose: validationVerbose, strict: validationStrict },
        );

        agentRunning = false;
        messages.push({ role: 'user', content: buffered.trim() });
      }
    }

    showPrompt();
  }

  // === Paste-aware line handler ===
  // Rapid-fire line events (< 50ms apart) = multi-line paste.
  // We collect them and show a preview instead of sending immediately.
  rl.on('line', (line) => {
    isAtPrompt = false;
    ctrlCCount = 0;

    // Guard: skip phantom line events from sub-readline
    if (Date.now() < drainUntil) {
      showPrompt();
      return;
    }

    // Clear command suggestions on submit
    if (lastSuggestionCount > 0) {
      clearSuggestions(lastSuggestionCount);
      lastSuggestionCount = 0;
    }

    const trimmed = line.trim();

    // If paste buffer has content and user pressed Enter on empty line → send it
    if (!trimmed && pasteBuffer.length > 0) {
      const assembled = pasteBuffer.join('\n');
      pasteBuffer = [];
      if (pasteTimer) { clearTimeout(pasteTimer); pasteTimer = null; }
      // Show full pasted text as user message
      process.stdout.write(`\x1b[2K\r`);
      processInput(assembled);
      return;
    }

    if (!trimmed) {
      isAtPrompt = true;
      rl.prompt();
      return;
    }

    // If agent is running, buffer for type-ahead (no paste detection needed)
    if (agentRunning) {
      typeAheadBuffer.push(trimmed);
      process.stdout.write(`  ${theme.dim('\u23F3 Queued:')} ${theme.dim(trimmed)}\n`);
      // Re-show prompt for further type-ahead input
      rl.prompt();
      return;
    }

    // Paste detection: if a timer is already running, this is a continuation
    if (pasteTimer) {
      pasteBuffer.push(line);
      clearTimeout(pasteTimer);
      // Show updated preview
      const count = pasteBuffer.length;
      process.stdout.write(`\x1b[2K\r  ${chalk.dim(`(${count} Zeilen eingefuegt — Enter zum Senden, Esc zum Verwerfen)`)}`);
      pasteTimer = setTimeout(() => {
        // Paste ended — show final preview and wait for Enter
        pasteTimer = null;
        const count = pasteBuffer.length;
        const preview = pasteBuffer[0].slice(0, 60);
        process.stdout.write(`\x1b[2K\r  ${chalk.cyan(`[${count} Zeilen]`)} ${chalk.dim(preview + (pasteBuffer[0].length > 60 ? '...' : ''))}\n`);
        process.stdout.write(`  ${chalk.dim('Enter = senden | Esc = verwerfen')}\n`);
        rl.prompt();
      }, PASTE_THRESHOLD_MS);
      return;
    }

    // First line — start the paste timer
    pasteBuffer = [line];
    pasteTimer = setTimeout(() => {
      // Timer expired without more lines → this was a normal single-line input
      pasteTimer = null;
      const singleInput = pasteBuffer.join('\n').trim();
      pasteBuffer = [];
      if (singleInput) {
        processInput(singleInput);
      } else {
        isAtPrompt = true;
        rl.prompt();
      }
    }, PASTE_THRESHOLD_MS);
  });

  // Handle Esc to discard paste buffer
  if (process.stdin.isTTY) {
    const origKeypress = process.stdin.listeners('keypress') as Array<(...args: any[]) => void>;
    // Insert paste-cancel before the existing ESC handler
    process.stdin.prependListener('keypress', (_str: string, key: any) => {
      if (key?.name === 'escape' && pasteBuffer.length > 0 && !agentRunning) {
        pasteBuffer = [];
        if (pasteTimer) { clearTimeout(pasteTimer); pasteTimer = null; }
        process.stdout.write(`\x1b[2K\r  ${chalk.dim('Paste verworfen.')}\n`);
        showPrompt();
      }
    });
  }

  rl.on('close', async () => {
    clearInterval(footerTimer);
    if (spiralEngine) {
      // Persist session buffer (goals, entities, decisions) into spiral brain
      // so next session with the same brain can recall them
      try {
        const goals = sessionBuffer.getGoals();
        const entities = sessionBuffer.getEntities();
        if (goals.length > 0) {
          await spiralEngine.store(
            `[Session Goals] ${goals.join(' | ')}`,
            'decision',
            { tags: ['session', 'goals'] },
          );
        }
        if (entities.size > 0) {
          const entryList = [...entities.entries()].map(([k, v]) => `${k}=${v}`).join(', ');
          await spiralEngine.store(
            `[Session Refs] ${entryList}`,
            'summary',
            { tags: ['session', 'entities'] },
          );
        }
      } catch { /* best effort */ }

      try {
        await spiralEngine.saveState(messages);
      } catch { /* best effort */ }
      spiralEngine.close();
    }
    process.stdout.write('\n');
    process.exit(0);
  });
}

interface ValidationOptions {
  enabled: boolean;
  verbose: boolean;
  strict: boolean;
}

/**
 * Run an agent task in a background session.
 * Uses the session's own history, buffer, controller, and undo stack.
 * Output goes to the session's capture buffer (not stdout).
 */
async function runBackgroundSession(
  session: import('../sessions/session.js').Session,
  prompt: string,
  provider: LLMProvider,
  project: any,
  spiralEngine: any,
  config: any,
  permissions: PermissionManager,
  checkpointStore: CheckpointStore,
  onTokens: (input: number, output: number) => void,
  onToolCall: () => void,
  validationOpts: ValidationOptions,
): Promise<import('../sessions/session.js').SessionResult> {
  const bgActivity = new ActivityIndicator();

  await sendAgentMessage(
    prompt, session.history, provider, project, spiralEngine, config,
    permissions, session.undoStack, checkpointStore,
    session.controller, bgActivity, session.buffer,
    onTokens, onToolCall, undefined, validationOpts,
  );

  // Build result from the session buffer
  const steps = session.buffer.getRecentErrors().map((e, i) => ({
    num: i + 1,
    tool: 'background',
    label: e.summary,
    status: 'error' as const,
    error: e.summary,
  }));

  return {
    text: session.buffer.buildContext(),
    steps,
    errors: [],
    durationMs: session.elapsed,
  };
}

async function sendAgentMessage(
  input: string,
  agentHistory: ToolMessage[],
  provider: LLMProvider,
  project: any,
  spiralEngine: any,
  config: any,
  permissions: PermissionManager,
  undoStack: UndoStack,
  checkpointStore: CheckpointStore,
  controller: AgentController,
  activity: ActivityIndicator,
  sessionBuffer: SessionBuffer,
  onTokens: (input: number, output: number) => void,
  onToolCall: () => void,
  onAgentStart?: () => void,
  validationOpts?: ValidationOptions,
): Promise<void> {
  // User message was rendered by renderUserMessage() in the caller before entering here.

  // Intent Detection: Check if user wants to feed the codebase
  const feedIntent = detectFeedIntent(input);
  if (feedIntent.detected && feedIntent.confidence > 0.7 && spiralEngine) {
    renderInfo('\u{1F300} Analyzing project in the background...\n');
    const rootDir = process.cwd();
    // Background feed runs silently (no progress output) to avoid colliding
    // with the activity indicator which also writes \r\x1b[K on the same line.
    runFeedPipeline(rootDir, spiralEngine, {
      targetPath: feedIntent.path,
    }).then(result => {
      if (result.nodesCreated > 0) {
        process.stdout.write(
          chalk.dim(`  \u{1F300} Feed: +${result.nodesCreated} nodes from ${result.filesRead} files\n`),
        );
      }
    }).catch(() => {});
  }

  // === WEB ENRICHMENT (background) ===
  // Automatically fetch web knowledge about the topic while the agent works.
  // Runs in background — results are stored in spiral brain for this + future queries.
  // Available for ALL tiers — this is the core intelligence that makes HelixMind useful.
  let enrichmentPromise: Promise<any> | null = null;
  if (spiralEngine) {
    try {
      const { enrichFromWeb } = await import('../../spiral/cloud/web-enricher.js');
      const { pushWebKnowledge, isBrainServerRunning } = await import('../brain/generator.js');
      enrichmentPromise = enrichFromWeb(input, spiralEngine, {
        maxTopics: 2,
        maxPagesPerTopic: 2,
        minQuality: 0.4,
        onKnowledgeFound: (topic, summary, source) => {
          // Push live update to brain visualization (if open in browser)
          if (isBrainServerRunning()) {
            pushWebKnowledge(topic, summary, source);
          }
        },
      }).catch(() => null);
    } catch {
      // Web enrichment module not available, continue without
    }
  }

  // Query spiral context for system prompt enrichment
  let spiralContext: SpiralQueryResult = {
    level_1: [], level_2: [], level_3: [], level_4: [], level_5: [],
    total_tokens: 0, node_count: 0,
  };

  if (spiralEngine) {
    try {
      spiralContext = await spiralEngine.query(input, config.spiral.maxTokensBudget);
    } catch {
      // Spiral query failed, continue without
    }
  }

  // Assemble system prompt with spiral context + project info + session memory
  const sessionContext = sessionBuffer.buildContext();
  const systemPrompt = assembleSystemPrompt(
    project.name !== 'unknown' ? project : null,
    spiralContext,
    sessionContext || undefined,
    { provider: provider.name, model: provider.model },
  );

  // Auto-trim context when approaching budget limit
  const maxBudget = config.spiral.maxTokensBudget || 200000;
  trimConversation(agentHistory, maxBudget, sessionBuffer);

  // Start the glowing activity indicator (reserves bottom row via scroll region)
  activity.start();
  // Notify caller so it can show the readline prompt for type-ahead
  onAgentStart?.();

  try {
    const result = await runAgentLoop(input, agentHistory, {
      provider,
      systemPrompt,
      permissions,
      toolContext: {
        projectRoot: process.cwd(),
        undoStack,
        spiralEngine,
      },
      checkpointStore,
      sessionBuffer,
      onThinking: () => {
        // Resume animation before each LLM call (timer keeps running)
        activity.setBlockMode(isInsideToolBlock());
        if (!activity.isAnimating) {
          activity.resumeAnimation();
        }
      },
      onTokensUsed: (inp, out) => {
        onTokens(inp, out);
      },
      onToolCall: () => {
        activity.pauseAnimation(); // Pause animation during tool execution (timer keeps running)
        onToolCall();
      },
      onStepStart: (num, _tool, label) => {
        activity.setStep(num, label);
      },
      onStepEnd: (_num, _tool, status) => {
        if (status === 'error') activity.setError();
      },
      onBeforeAnswer: () => {
        activity.stop(); // Writes colorful "HelixMind Done" replacing animation
      },
    }, controller);

    // activity.stop() was already called via onBeforeAnswer (shows colorful "Done" line)
    // Ensure stopped if onBeforeAnswer wasn't reached (e.g. no tools, direct answer)
    if (activity.isRunning) activity.stop();

    // CRITICAL: Adopt updated conversation history from agent loop.
    // runAgentLoop works on a copy — we must sync it back so the next turn
    // sees the full conversation (user message + assistant + tool results).
    agentHistory.length = 0;
    agentHistory.push(...result.updatedHistory);

    // ═══ PHASE 3: VALIDATION MATRIX ═══
    if (validationOpts?.enabled && result.text) {
      try {
        // Phase 1: Classify
        const classification = classifyTask(input);

        if (classification.category !== 'chat_only') {
          // Generate criteria
          let spiralContextStr = '';
          if (spiralEngine) {
            try {
              const sq = await spiralEngine.query(input, undefined, [3, 4, 5]);
              spiralContextStr = [...sq.level_3, ...sq.level_4, ...sq.level_5]
                .map((n: any) => n.content).join('\n');
            } catch { /* ignore */ }
          }

          const criteria = generateCriteria(classification, input, spiralContextStr || undefined);

          if (criteria.length > 0) {
            if (validationOpts.verbose) {
              process.stdout.write(renderClassification(classification.category, classification.complexity, criteria.length) + '\n');
            }
            process.stdout.write(renderValidationStart());

            // Create validation provider (smaller/faster model)
            let valProvider: LLMProvider | undefined;
            try {
              valProvider = createValidationProvider(config.model, config.provider, config.apiKey);
            } catch { /* use without dynamic checks */ }

            // Run validation loop
            const valResult = await validationLoop(result.text, {
              criteria,
              userRequest: input,
              spiralContext: spiralContextStr,
              spiralEngine: spiralEngine || undefined,
              validationProvider: valProvider,
              maxLoops: 3,
            });

            // If strict mode, promote warnings to effective errors
            if (validationOpts.strict) {
              for (const r of valResult.results) {
                if (!r.passed && r.severity === 'warning') {
                  r.severity = 'error';
                }
              }
            }

            // Show summary
            process.stdout.write(renderValidationSummary(valResult, validationOpts.verbose) + '\n');

            // Store stats in spiral
            await storeValidationResult(valResult, classification.category, spiralEngine || undefined);
          }
        }
      } catch {
        // Validation should never block the user
      }
    }

    // Track assistant response in session buffer
    if (result.text) {
      sessionBuffer.addAssistantSummary(result.text);
    }

    // Create checkpoint for agent response
    if (result.text) {
      checkpointStore.createForChat(
        result.text.length > 60 ? result.text.slice(0, 60) + '...' : result.text,
        agentHistory.length,
      );
    }

    // Store turn summary in spiral (user request + agent response)
    if (spiralEngine && config.spiral.autoStore && result.text) {
      const turnSummary = `User: ${input.slice(0, 100)} → Agent: ${result.text.slice(0, 400)}`;
      spiralEngine.store(turnSummary, 'summary', { tags: ['session', 'turn'] }).catch(() => {});
    }

    // Show web enrichment results (if any arrived while agent worked)
    if (enrichmentPromise) {
      try {
        const enrichResult = await enrichmentPromise;
        if (enrichResult && enrichResult.nodesStored > 0) {
          const topicList = enrichResult.topics.join(', ');
          process.stdout.write(
            chalk.dim(`  \u{1F310} Web: +${enrichResult.nodesStored} knowledge nodes stored `) +
            chalk.dim(`(${topicList})`) +
            chalk.dim(` [${enrichResult.duration_ms}ms]\n`),
          );
        }
      } catch {
        // Enrichment error — silent, never block the user
      }
    }
  } catch (err) {
    if (activity.isRunning) activity.stop('Stopped');
    if (err instanceof AgentAbortError) {
      renderInfo('\n\u23F9 Agent aborted.');
    } else {
      const errMsg = err instanceof Error ? err.message : String(err);

      // Categorize and show user-friendly error
      const { isRateLimitError: isRL } = await import('../providers/rate-limiter.js');
      if (isRL(err)) {
        process.stdout.write('\n');
        renderError('Rate limit reached. Waiting and retrying automatically next time.');
        renderInfo(chalk.dim('  Tip: Use /compact to reduce spiral nodes, or wait a moment before retrying.'));
      } else if (errMsg.includes('authentication') || errMsg.includes('401') || errMsg.includes('invalid.*key')) {
        renderError('Authentication failed. Your API key may be invalid or expired.');
        renderInfo(chalk.dim('  Fix: /keys to update your API key.'));
      } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('ECONNREFUSED') || errMsg.includes('network')) {
        renderError('Network error — cannot reach the API server.');
        renderInfo(chalk.dim('  Check your internet connection and try again.'));
      } else if (errMsg.includes('context_length') || errMsg.includes('too many tokens') || errMsg.includes('maximum context')) {
        renderError('Context too large for the model.');
        renderInfo(chalk.dim('  Fix: /clear to reset conversation, or /compact to reduce spiral size.'));
      } else if (errMsg.includes('Max retries exceeded')) {
        renderError('API temporarily unavailable after multiple retries.');
        renderInfo(chalk.dim('  Wait a moment and try again. The rate limiter will auto-recover.'));
      } else {
        renderError(errMsg.length > 200 ? errMsg.slice(0, 200) + '...' : errMsg);
      }

      // Track error in session buffer
      sessionBuffer.addToolError('agent_loop', errMsg);
    }
  }
}

function showSkipPermissionsWarning(): void {
  const w = chalk.yellow;
  const g = chalk.green;
  const d = chalk.dim;

  process.stdout.write('\n');
  process.stdout.write(d('\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E') + '\n');
  process.stdout.write(d('\u2502  ') + w('\u26A0\uFE0F  SKIP-PERMISSIONS MODE') + d('                  \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                             \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + 'HelixMind will automatically:' + d('              \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + g('\u2713') + ' Read and write files' + d('                   \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + g('\u2713') + ' Edit existing code' + d('                    \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + g('\u2713') + ' Run shell commands (safe ones)' + d('        \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + g('\u2713') + ' Create git commits' + d('                    \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                             \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + 'Still requires confirmation for:' + d('           \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + w('\u26A0') + ' Dangerous commands (rm -rf, sudo)' + d('     \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                             \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + d('ESC = stop agent  --yolo = skip all') + d('      \u2502') + '\n');
  process.stdout.write(d('\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F') + '\n\n');
}

function showFullAutonomousWarning(): void {
  const r = chalk.red;
  const d = chalk.dim;

  process.stdout.write('\n');
  process.stdout.write(d('\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E') + '\n');
  process.stdout.write(d('\u2502  ') + r('\u{1F525} FULL AUTONOMOUS MODE') + d('                    \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                             \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + 'HelixMind will execute ALL actions' + d('          \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + 'without asking. No confirmations.' + d('           \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                             \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + d('ESC = stop agent if needed.') + d('              \u2502') + '\n');
  process.stdout.write(d('\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F') + '\n\n');
}

async function handleSlashCommand(
  input: string,
  messages: ChatMessage[],
  agentHistory: ToolMessage[],
  config: any,
  spiralEngine: any,
  store: ConfigStore,
  rl: readline.Interface,
  permissions: PermissionManager,
  undoStack: UndoStack,
  checkpointStore: CheckpointStore,
  sessionBuffer: SessionBuffer,
  sessionTokens: { input: number; output: number },
  sessionToolCalls: number,
  onProviderSwitch?: (provider: LLMProvider) => void,
  onBrainSwitch?: (scope: 'project' | 'global') => Promise<void>,
  currentBrainScope?: 'project' | 'global',
  onAutonomous?: (action: 'start' | 'stop' | 'security', goal?: string) => Promise<void>,
  onValidation?: (action: string) => void,
  sessionManager?: SessionManager,
  onRegisterBrainHandlers?: () => Promise<void>,
  onSubPrompt?: (active: boolean) => void,
): Promise<string | void> {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case '/help': {
      if (!process.stdin.isTTY) {
        // Non-interactive: show static text
        process.stdout.write(HELP_TEXT);
        break;
      }
      // Pause readline so selectMenu can take raw input
      onSubPrompt?.(true);
      rl.pause();
      process.stdout.write('\n');
      const { items: helpItems, commands: helpCmds } = buildHelpMenuItems();
      const helpIdx = await selectMenu(helpItems, {
        title: chalk.hex('#00d4ff').bold('HelixMind Commands'),
        cancelLabel: 'Close',
        pageSize: 15,
      });
      rl.resume();
      if (helpIdx >= 0 && helpCmds[helpIdx]) {
        // Execute the selected command
        return handleSlashCommand(
          helpCmds[helpIdx], messages, agentHistory, config, spiralEngine,
          store, rl, permissions, undoStack, checkpointStore, sessionBuffer,
          sessionTokens, sessionToolCalls,
          onProviderSwitch, onBrainSwitch, currentBrainScope, onAutonomous, onValidation,
          sessionManager, onRegisterBrainHandlers, onSubPrompt,
        );
      }
      break;
    }

    case '/clear':
      messages.length = 0;
      agentHistory.length = 0;
      renderInfo('Conversation cleared.');
      break;

    case '/model': {
      const directModel = parts[1];
      if (directModel) {
        // Check if it looks like an Ollama model (contains ':' or is a known local model pattern)
        const isOllamaModel = directModel.includes(':') || directModel.match(/^(qwen|llama|deepseek|codellama|mistral|phi|gemma|starcoder)/i);
        if (isOllamaModel) {
          // Switch to Ollama provider
          store.addProvider('ollama', 'ollama', 'http://localhost:11434/v1');
          store.switchProvider('ollama', directModel);
          try {
            const newProvider = createProvider('ollama', 'ollama', directModel, 'http://localhost:11434/v1');
            onProviderSwitch?.(newProvider);
            renderInfo(`Switched to: ollama / ${directModel}`);
          } catch (err) {
            renderError(`Failed to switch: ${err}`);
          }
        } else {
          // Regular provider model switch
          store.switchModel(directModel);
          const newConfig = store.getAll();
          try {
            const newProvider = createProvider(
              newConfig.provider,
              newConfig.apiKey,
              newConfig.model,
              newConfig.providers[newConfig.provider]?.baseURL,
            );
            onProviderSwitch?.(newProvider);
            renderInfo(`Switched to: ${newConfig.provider} / ${newConfig.model}`);
          } catch (err) {
            renderError(`Failed to switch: ${err}`);
          }
        }
      } else {
        // Interactive picker — suppress statusbar to prevent cursor interference
        onSubPrompt?.(true);
        rl.pause();
        const configBefore = store.getAll();
        const result = await showModelSwitcher(store, rl);
        rl.resume();
        // Always refresh provider if config changed (covers "Add new provider" path too)
        const newConfig = store.getAll();
        const configChanged = newConfig.provider !== configBefore.provider
          || newConfig.model !== configBefore.model
          || newConfig.apiKey !== configBefore.apiKey;
        if ((result || configChanged) && onProviderSwitch && newConfig.apiKey) {
          try {
            const newProvider = createProvider(
              newConfig.provider,
              newConfig.apiKey,
              newConfig.model,
              newConfig.providers[newConfig.provider]?.baseURL,
            );
            onProviderSwitch(newProvider);
          } catch (err) {
            renderError(`Failed to switch: ${err}`);
          }
        }
      }
      return 'drain'; // Sub-readline may leave phantom line events
    }

    case '/keys': {
      // Suppress statusbar to prevent cursor interference during text input
      onSubPrompt?.(true);
      rl.pause();
      await showKeyManagement(store, rl);
      rl.resume();
      // Refresh provider after key changes
      const newConfig = store.getAll();
      if (newConfig.apiKey && onProviderSwitch) {
        try {
          const newProvider = createProvider(
            newConfig.provider,
            newConfig.apiKey,
            newConfig.model,
            newConfig.providers[newConfig.provider]?.baseURL,
          );
          onProviderSwitch(newProvider);
        } catch { /* ignore */ }
      }
      return 'drain'; // Sub-readline may leave phantom line events
    }

    case '/spiral':
      if (spiralEngine) {
        try {
          const status = spiralEngine.status();
          renderSpiralStatus(
            status.total_nodes,
            status.per_level[1] ?? 0,
            status.per_level[2] ?? 0,
            status.per_level[3] ?? 0,
            status.per_level[4] ?? 0,
            status.per_level[5] ?? 0,
          );
        } catch {
          renderInfo('Spiral engine not available.');
        }
      } else {
        renderInfo('Spiral engine disabled.');
      }
      break;

    case '/helix':
    case '/helixlocal':
      // Always use local brain for /helix and /helixlocal
      if (onBrainSwitch && currentBrainScope !== 'project') {
        await onBrainSwitch('project');
        renderInfo(chalk.cyan('\u{1F4C1} Switched to project-local brain (.helixmind/)'));
        try {
          const { pushScopeChange, isBrainServerRunning } = await import('../brain/generator.js');
          if (isBrainServerRunning()) pushScopeChange('project');
        } catch { /* optional */ }
      }
      // Auto-start brain visualization
      if (spiralEngine) {
        try {
          const { exportBrainData } = await import('../brain/exporter.js');
          const { startLiveBrain, isBrainServerRunning } = await import('../brain/generator.js');
          const { exec } = await import('node:child_process');
          const { platform } = await import('node:os');

          const data = exportBrainData(spiralEngine, 'HelixMind Project', 'project');
          if (data.meta.totalNodes > 0 && !isBrainServerRunning()) {
            const url = await startLiveBrain(spiralEngine, 'HelixMind Project', 'project');
            if (onRegisterBrainHandlers) await onRegisterBrainHandlers();
            const openCmd = platform() === 'win32' ? `start "" "${url}"`
              : platform() === 'darwin' ? `open "${url}"`
              : `xdg-open "${url}"`;
            exec(openCmd, () => {});
            process.stdout.write(`  ${theme.success('\u{1F9E0} Brain View started:')} ${url}\n`);
          }
        } catch { /* brain optional */ }
      }
      onSubPrompt?.(true);
      rl.pause();
      await showHelixMenu(spiralEngine, store, 'project');
      rl.resume();
      return 'drain';

    case '/helixglobal':
      // Use global brain for /helixglobal
      if (onBrainSwitch && currentBrainScope !== 'global') {
        await onBrainSwitch('global');
        renderInfo(chalk.dim('\u{1F310} Switched to global brain (~/.spiral-context/)'));
        try {
          const { pushScopeChange, isBrainServerRunning } = await import('../brain/generator.js');
          if (isBrainServerRunning()) pushScopeChange('global');
        } catch { /* optional */ }
      }
      // Auto-start brain visualization
      if (spiralEngine) {
        try {
          const { exportBrainData } = await import('../brain/exporter.js');
          const { startLiveBrain, isBrainServerRunning } = await import('../brain/generator.js');
          const { exec } = await import('node:child_process');
          const { platform } = await import('node:os');

          const data = exportBrainData(spiralEngine, 'HelixMind Project', 'global');
          if (data.meta.totalNodes > 0 && !isBrainServerRunning()) {
            const url = await startLiveBrain(spiralEngine, 'HelixMind Project', 'global');
            if (onRegisterBrainHandlers) await onRegisterBrainHandlers();
            const openCmd = platform() === 'win32' ? `start "" "${url}"`
              : platform() === 'darwin' ? `open "${url}"`
              : `xdg-open "${url}"`;
            exec(openCmd, () => {});
            process.stdout.write(`  ${theme.success('\u{1F9E0} Brain View started:')} ${url}\n`);
          }
        } catch { /* brain optional */ }
      }
      onSubPrompt?.(true);
      rl.pause();
      await showHelixMenu(spiralEngine, store, 'global');
      rl.resume();
      return 'drain';

    case '/brain': {
      const brainArg = parts[1]?.toLowerCase();

      // /brain local — switch to project-local brain
      if (brainArg === 'local' || brainArg === 'project') {
        if (currentBrainScope === 'project') {
          renderInfo('Already using project-local brain.');
        } else if (onBrainSwitch) {
          await onBrainSwitch('project');
          renderInfo(chalk.cyan('\u{1F4C1} Switched to project-local brain (.helixmind/)'));
          // Update browser if open
          try {
            const { pushScopeChange, isBrainServerRunning } = await import('../brain/generator.js');
            if (isBrainServerRunning()) pushScopeChange('project');
          } catch { /* optional */ }
        }
        break;
      }

      // /brain global — switch to global brain
      if (brainArg === 'global') {
        if (currentBrainScope === 'global') {
          renderInfo('Already using global brain.');
        } else if (onBrainSwitch) {
          await onBrainSwitch('global');
          renderInfo(chalk.dim('\u{1F310} Switched to global brain (~/.spiral-context/)'));
          // Update browser if open
          try {
            const { pushScopeChange, isBrainServerRunning } = await import('../brain/generator.js');
            if (isBrainServerRunning()) pushScopeChange('global');
          } catch { /* optional */ }
        }
        break;
      }

      // /brain (no arg) — show status + open 3D view
      if (!brainArg) {
        const scopeLabel = currentBrainScope === 'project'
          ? chalk.cyan('project-local') + chalk.dim(' (.helixmind/)')
          : chalk.dim('global') + chalk.dim(' (~/.spiral-context/)');
        renderInfo(`Brain scope: ${scopeLabel}`);
        renderInfo(chalk.dim('  /brain local  — switch to project brain'));
        renderInfo(chalk.dim('  /brain global — switch to global brain'));
        process.stdout.write('\n');
      }

      // Open 3D visualization (for /brain or /brain view)
      if (!brainArg || brainArg === 'view') {
        if (spiralEngine) {
          try {
            const { exportBrainData } = await import('../brain/exporter.js');
            const { startLiveBrain } = await import('../brain/generator.js');
            const { exec } = await import('node:child_process');
            const { platform } = await import('node:os');

            const data = exportBrainData(spiralEngine, 'HelixMind Project', currentBrainScope);
            if (data.meta.totalNodes === 0) {
              renderInfo('Spiral is empty. Feed some files first: /feed');
              break;
            }
            const url = await startLiveBrain(spiralEngine, 'HelixMind Project', currentBrainScope);

            // Register voice + scope switch handlers
            if (onRegisterBrainHandlers) await onRegisterBrainHandlers();

            const openCmd = platform() === 'win32' ? `start "" "${url}"`
              : platform() === 'darwin' ? `open "${url}"`
              : `xdg-open "${url}"`;
            exec(openCmd, () => {});
            process.stdout.write(`  ${theme.success('\u{1F9E0} Brain View live at:')} ${url}\n`);
            renderInfo('Auto-updates when spiral changes. Voice input enabled via browser mic.');
          } catch (err) {
            renderError(`Brain view failed: ${err}`);
          }
        } else {
          renderInfo('Spiral engine not available.');
        }
      }
      break;
    }

    case '/feed':
      // Handled directly in chatCommand() for access to inlineProgressActive flag
      break;

    case '/context':
      if (spiralEngine) {
        const status = spiralEngine.status();
        renderInfo(`Context: ${status.total_nodes} spiral nodes, ${status.total_edges} edges`);
        renderInfo(`  Storage: ${(status.storage_size_bytes / 1024).toFixed(1)} KB`);
        renderInfo(`  Embeddings: ${status.embedding_status}`);
        renderInfo(`  Session buffer: ${sessionBuffer.eventCount} events, ${sessionBuffer.totalErrors} errors`);
        renderInfo(`  Files modified: ${sessionBuffer.getModifiedFiles().length}`);
      } else {
        renderInfo('Spiral engine not available.');
      }
      break;

    case '/project': {
      const { analyzeProject } = await import('../context/project.js');
      const proj = await analyzeProject(process.cwd());
      renderInfo(`Project: ${proj.name} (${proj.type})`);
      if (proj.frameworks?.length) renderInfo(`  Frameworks: ${proj.frameworks.join(', ')}`);
      renderInfo(`  Files: ${proj.files?.length ?? 'unknown'}`);
      break;
    }

    case '/compact':
      if (spiralEngine) {
        const result = spiralEngine.evolve();
        renderInfo(`Evolution: ${result.promoted} promoted, ${result.demoted} demoted, ${result.summarized} summarized`);
      } else {
        renderInfo('Spiral engine not available.');
      }
      break;

    case '/tokens':
      renderInfo(`Session tokens: ${sessionTokens.input} in, ${sessionTokens.output} out (${sessionTokens.input + sessionTokens.output} total)`);
      renderInfo(`Tool calls: ${sessionToolCalls}`);
      renderInfo(`Checkpoints: ${checkpointStore.count}`);
      renderInfo(`Memory (snapshots): ${(checkpointStore.memoryUsage / 1024).toFixed(1)} KB`);
      renderInfo(`Session buffer: ${sessionBuffer.eventCount} events`);
      break;

    case '/yolo': {
      const arg = parts[1]?.toLowerCase();
      if (arg === 'on') {
        permissions.setYolo(true);
        renderInfo('YOLO mode ON \u2014 ALL operations auto-approved');
      } else if (arg === 'off') {
        permissions.setYolo(false);
        renderInfo('YOLO mode OFF');
      } else {
        renderInfo(`YOLO mode: ${permissions.isYolo() ? 'ON' : 'OFF'}`);
      }
      break;
    }

    case '/skip-permissions': {
      const arg = parts[1]?.toLowerCase();
      if (arg === 'on') {
        permissions.setSkipPermissions(true);
        renderInfo('Skip-permissions ON \u2014 write operations auto-approved (dangerous still asks)');
      } else if (arg === 'off') {
        permissions.setSkipPermissions(false);
        renderInfo('Skip-permissions OFF \u2014 write operations require confirmation');
      } else {
        renderInfo(`Skip-permissions: ${permissions.isSkipPermissions() ? 'ON' : 'OFF'}`);
      }
      break;
    }

    case '/undo': {
      const countArg = parts[1];
      if (countArg === 'list') {
        const entries = undoStack.list();
        if (entries.length === 0) {
          renderInfo('No undo history.');
        } else {
          renderInfo(`Undo history (${entries.length} entries):`);
          for (const entry of entries.slice(0, 10)) {
            const age = Math.round((Date.now() - entry.timestamp) / 1000);
            renderInfo(`  ${entry.tool}: ${entry.path} (${age}s ago)`);
          }
        }
      } else {
        const count = parseInt(countArg) || 1;
        const result = undoStack.undo(count);
        if (result.undone === 0) {
          renderInfo('Nothing to undo.');
        } else {
          renderInfo(`Undone ${result.undone} change(s):`);
          for (const entry of result.entries) {
            renderInfo(`  Reverted: ${entry.path}`);
          }
        }
      }
      break;
    }

    case '/validation': {
      const vArg = parts[1]?.toLowerCase();
      if (onValidation) {
        onValidation(vArg || 'status');
      }
      break;
    }

    case '/diff':
      try {
        const { execSync } = await import('node:child_process');
        const diff = execSync('git diff', { cwd: process.cwd(), encoding: 'utf-8' }).trim();
        if (diff) {
          process.stdout.write(`\n${diff}\n\n`);
        } else {
          renderInfo('No uncommitted changes.');
        }
      } catch {
        renderInfo('Not a git repository.');
      }
      break;

    case '/git':
      try {
        const { execSync } = await import('node:child_process');
        const status = execSync('git status --short', { cwd: process.cwd(), encoding: 'utf-8' }).trim();
        const branch = execSync('git branch --show-current', { cwd: process.cwd(), encoding: 'utf-8' }).trim();
        renderInfo(`Branch: ${branch}`);
        if (status) {
          process.stdout.write(`\n${status}\n\n`);
        } else {
          renderInfo('Working tree clean.');
        }
      } catch {
        renderInfo('Not a git repository.');
      }
      break;

    case '/export': {
      const outputDir = parts[1] || process.cwd();
      if (spiralEngine) {
        try {
          const { exportToZip } = await import('../brain/archive.js');
          const zipPath = exportToZip(spiralEngine, outputDir);
          renderInfo(`Exported to: ${zipPath}`);
        } catch (err) {
          renderError(`Export failed: ${err}`);
        }
      } else {
        renderInfo('Spiral engine not available.');
      }
      break;
    }

    case '/login': {
      const { loginCommand } = await import('./auth.js');
      await loginCommand({});
      return 'drain';
    }

    case '/logout': {
      const { logoutCommand } = await import('./auth.js');
      await logoutCommand({});
      return 'drain';
    }

    case '/whoami': {
      const { whoamiCommand } = await import('./auth.js');
      await whoamiCommand();
      return;
    }

    case '/exit':
    case '/quit': {
      // Stop live brain server
      try {
        const { stopLiveBrain } = await import('../brain/generator.js');
        stopLiveBrain();
      } catch { /* ignore */ }
      if (spiralEngine) {
        renderInfo('Saving state...');
        try {
          await spiralEngine.saveState(messages);
        } catch { /* best effort */ }
      }
      renderInfo('Goodbye!');
      return 'exit';
    }

    case '/auto':
    case '/dontstop': {
      if (!onAutonomous) break;
      // Extract goal text after "/auto " (e.g. "/auto fix all TypeScript errors")
      const autoGoal = input.replace(/^\/(auto|dontstop)\s*/i, '').trim() || undefined;

      if (autoGoal) {
        // Goal provided — start directly without confirmation menu
        await onAutonomous('start', autoGoal);
      } else {
        // No goal — show confirmation menu
        rl.pause();
        process.stdout.write('\n');
        const autoConfirm = await selectMenu(
          [
            { label: chalk.hex('#ff6600').bold('Start autonomous mode'), description: 'HelixMind will continuously scan and fix issues' },
            { label: 'Cancel', description: 'Go back' },
          ],
          { title: chalk.hex('#ff6600').bold('Autonomous Mode'), cancelLabel: 'Cancel' },
        );
        rl.resume();
        if (autoConfirm === 0) {
          await onAutonomous('start');
        } else {
          renderInfo('Autonomous mode cancelled.');
        }
      }
      break;
    }

    case '/stop':
      if (onAutonomous) {
        await onAutonomous('stop');
      } else {
        renderInfo('No autonomous mode running.');
      }
      break;

    case '/security':
      if (onAutonomous) {
        await onAutonomous('security');
      }
      break;

    case '/sessions':
    case '/session': {
      if (!sessionManager) break;
      const subCmd = parts[1]?.toLowerCase();

      if (subCmd === 'close' || subCmd === 'remove') {
        const targetId = parts[2];
        if (!targetId) {
          renderInfo('Usage: /session close <id>');
          break;
        }
        const removed = sessionManager.remove(targetId);
        if (removed) {
          renderInfo(`Session ${targetId} closed.`);
        } else {
          renderInfo(`Session "${targetId}" not found or is the main session.`);
        }
      } else if (subCmd === 'stop') {
        const targetId = parts[2];
        if (targetId) {
          const session = sessionManager.get(targetId);
          if (session && session.status === 'running') {
            session.abort();
            renderInfo(`Stopped: ${session.icon} ${session.name}`);
          } else {
            renderInfo(`Session "${targetId}" not found or not running.`);
          }
        } else {
          // Stop all background
          sessionManager.abortAll();
          renderInfo('All background sessions stopped.');
        }
      } else if (subCmd === 'switch') {
        const targetId = parts[2];
        if (targetId && sessionManager.switchTo(targetId)) {
          const s = sessionManager.active;
          renderInfo(`Switched to: ${s.icon} ${s.name}`);
          // Replay captured output
          if (s.output.length > 0) {
            process.stdout.write('\n' + chalk.dim('--- Session output ---') + '\n');
            for (const line of s.output.slice(-20)) {
              process.stdout.write('  ' + chalk.dim(line) + '\n');
            }
            process.stdout.write(chalk.dim('--- End ---') + '\n');
          }
        } else {
          renderInfo(`Session "${targetId || '?'}" not found.`);
        }
      } else {
        // Show session list
        process.stdout.write(renderSessionList(sessionManager.all, sessionManager.activeId));
      }
      break;
    }

    case '/local': {
      // Local LLM setup via Ollama
      rl.pause();
      const { isOllamaRunning, listOllamaModels, pullOllamaModel, formatModelSize, RECOMMENDED_MODELS } =
        await import('../providers/ollama.js');

      process.stdout.write('\n');
      const d = chalk.dim;
      const c = chalk.hex('#00d4ff');

      // Step 1: Check if Ollama is running
      const running = await isOllamaRunning();
      if (!running) {
        process.stdout.write(
          d('\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E') + '\n' +
          d('\u2502  ') + chalk.yellow('\u26A0 Ollama not detected') + d('                      \u2502') + '\n' +
          d('\u2502') + d('                                             \u2502') + '\n' +
          d('\u2502  ') + '1. Install: ' + c('https://ollama.com') + d('          \u2502') + '\n' +
          d('\u2502  ') + '2. Start:   ' + c('ollama serve') + d('                \u2502') + '\n' +
          d('\u2502  ') + '3. Run:     ' + c('/local') + ' again' + d('                  \u2502') + '\n' +
          d('\u2502') + d('                                             \u2502') + '\n' +
          d('\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F') + '\n\n',
        );
        rl.resume();
        break;
      }

      // Step 2: Get installed models
      const installed = await listOllamaModels();
      const installedNames = new Set(installed.map(m => m.name));

      // Build menu: installed models first, then recommended to download
      const menuItems: MenuItem[] = [];
      const menuActions: Array<{ action: 'use' | 'pull'; model: string }> = [];

      if (installed.length > 0) {
        menuItems.push({ label: c.bold('Installed Models'), disabled: true });
        menuActions.push({ action: 'use', model: '' });

        for (const m of installed) {
          const size = formatModelSize(m.size);
          const quant = m.details?.quantization_level || '';
          const active = config.provider === 'ollama' && config.model === m.name;
          menuItems.push({
            label: theme.primary(m.name),
            description: `${size} ${quant}`,
            marker: active ? chalk.green('\u25C0 active') : undefined,
          });
          menuActions.push({ action: 'use', model: m.name });
        }
      }

      // Recommended models not yet installed
      const notInstalled = RECOMMENDED_MODELS.filter(r => !installedNames.has(r.name));
      if (notInstalled.length > 0) {
        menuItems.push({ label: '', disabled: true });
        menuActions.push({ action: 'pull', model: '' });
        menuItems.push({ label: chalk.hex('#00ff88').bold('Download New Model'), disabled: true });
        menuActions.push({ action: 'pull', model: '' });

        for (const r of notInstalled) {
          menuItems.push({
            label: chalk.hex('#00ff88')(r.name),
            description: `${r.size} \u2014 ${r.description}`,
          });
          menuActions.push({ action: 'pull', model: r.name });
        }
      }

      menuItems.push({ label: '', disabled: true });
      menuActions.push({ action: 'use', model: '' });
      menuItems.push({
        label: d(`Ollama running \u2713  |  ${installed.length} model(s) installed`),
        disabled: true,
      });
      menuActions.push({ action: 'use', model: '' });

      const idx = await selectMenu(menuItems, {
        title: c.bold('\u{1F916} Local LLM Setup (Ollama)'),
        cancelLabel: 'Back',
        pageSize: 14,
      });

      rl.resume();

      if (idx < 0 || !menuActions[idx]?.model) break;

      const selected = menuActions[idx];

      if (selected.action === 'use') {
        // Switch to Ollama with selected model
        store.addProvider('ollama', 'ollama', 'http://localhost:11434/v1');
        store.switchProvider('ollama', selected.model);
        config = store.getAll();

        try {
          const newProvider = createProvider('ollama', 'ollama', selected.model, 'http://localhost:11434/v1');
          onProviderSwitch?.(newProvider);
          renderInfo(`\u2705 Switched to local: ${chalk.bold(selected.model)}`);
        } catch (err) {
          renderError(`Failed to switch: ${err}`);
        }
      } else if (selected.action === 'pull') {
        // Download model
        renderInfo(`\u{2B07}\uFE0F  Downloading ${chalk.bold(selected.model)}...`);
        process.stdout.write(d('  This may take a few minutes depending on model size.\n\n'));

        let lastPct = -1;
        const success = await pullOllamaModel(selected.model, (status, completed, total) => {
          if (completed && total && total > 0) {
            const pct = Math.round((completed / total) * 100);
            if (pct !== lastPct) {
              lastPct = pct;
              const bar = '\u2588'.repeat(Math.floor(pct / 5)) + '\u2591'.repeat(20 - Math.floor(pct / 5));
              process.stdout.write(`\r  ${c(bar)} ${pct}% ${d(status || '')}`);
            }
          } else if (status) {
            process.stdout.write(`\r\x1b[K  ${d(status)}`);
          }
        });

        process.stdout.write('\r\x1b[K');
        if (success) {
          renderInfo(`\u2705 Downloaded ${chalk.bold(selected.model)}`);

          // Auto-switch to the new model
          store.addProvider('ollama', 'ollama', 'http://localhost:11434/v1');
          store.switchProvider('ollama', selected.model);
          config = store.getAll();

          try {
            const newProvider = createProvider('ollama', 'ollama', selected.model, 'http://localhost:11434/v1');
            onProviderSwitch?.(newProvider);
            renderInfo(`\u2705 Active model: ${chalk.bold(selected.model)}`);
          } catch (err) {
            renderError(`Model downloaded but failed to switch: ${err}`);
          }
        } else {
          renderError(`Failed to download ${selected.model}. Check Ollama logs.`);
        }
      }
      break;
    }

    default:
      renderError(`Unknown command: ${cmd}. Type /help for available commands.`);
  }
}
