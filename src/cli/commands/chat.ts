import * as readline from 'node:readline';
import { Writable } from 'node:stream';
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
import { isInsideToolBlock, renderThinkingText } from '../ui/tool-output.js';
import { renderFeedProgress, renderFeedSummary } from '../ui/progress.js';
import type { FeedProgress } from '../feed/pipeline.js';
import { ActivityIndicator } from '../ui/activity.js';
import { BottomChrome } from '../ui/bottom-chrome.js';
import { theme } from '../ui/theme.js';
import { detectFeedIntent } from '../feed/intent.js';
import { runFeedPipeline } from '../feed/pipeline.js';
import { showHelixMenu } from './helix-menu.js';
import { initializeTools } from '../agent/tools/registry.js';
import { runAgentLoop, AgentController, AgentAbortError } from '../agent/loop.js';
import { PermissionManager } from '../agent/permissions.js';
import { UndoStack } from '../agent/undo.js';
import { writeStatusBar, renderStatusBar, getGitInfo, truncateBar, visibleLength, type StatusBarData } from '../ui/statusbar.js';
import { CheckpointStore } from '../checkpoints/store.js';
import { createKeybindingState, processKeypress } from '../checkpoints/keybinding.js';
import { runCheckpointBrowser } from '../checkpoints/browser.js';
import { runFirstTimeSetup, showModelSwitcher, showKeyManagement } from './setup.js';
import { SessionBuffer } from '../context/session-buffer.js';
import { trimConversation, estimateTokens } from '../context/trimmer.js';
import { runAutonomousLoop, SECURITY_PROMPT } from '../agent/autonomous.js';
import { SessionManager } from '../sessions/manager.js';
import { renderSessionNotification, renderSessionList } from '../sessions/tab-view.js';
import { getSuggestions, getBestCompletion, writeSuggestions, clearSuggestions } from '../ui/command-suggest.js';
import { selectMenu, type MenuItem } from '../ui/select-menu.js';
import { BugJournal } from '../bugs/journal.js';
import { detectBugReport } from '../bugs/detector.js';
import { JarvisQueue } from '../jarvis/queue.js';
import { runJarvisDaemon } from '../jarvis/daemon.js';
import { JarvisIdentityManager } from '../jarvis/identity.js';
import { runOnboarding, showReturningGreeting, type OnboardingResult } from '../jarvis/onboarding.js';
import { ProposalJournal } from '../jarvis/proposals.js';
import { JarvisScheduler } from '../jarvis/scheduler.js';
import { TriggerManager } from '../jarvis/triggers.js';
import { WorldModelManager } from '../jarvis/world-model.js';
import { AutonomyManager } from '../jarvis/autonomy.js';
import { NotificationManager } from '../jarvis/notifications.js';
import type { ThinkingCallbacks } from '../jarvis/types.js';
import { BrowserController } from '../browser/controller.js';
import { VisionProcessor } from '../browser/vision.js';
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
      { cmd: '/connect', label: '/connect', description: 'Reconnect brain server for web dashboard' },
    ],
  },
  {
    category: 'Autonomous & Security', color: '#ff6600',
    items: [
      { cmd: '/auto', label: '/auto', description: 'Autonomous mode' },
      { cmd: '/stop', label: '/stop', description: 'Stop autonomous mode' },
      { cmd: '/security', label: '/security', description: 'Run security audit (background)' },
      { cmd: '/monitor', label: '/monitor', description: 'Continuous security monitoring' },
      { cmd: '/sessions', label: '/sessions', description: 'List all sessions & tabs' },
      { cmd: '/local', label: '/local', description: 'Local LLM setup (Ollama)' },
    ],
  },
  {
    category: 'Jarvis', color: '#ff00ff',
    items: [
      { cmd: '/jarvis', label: '/jarvis', description: 'Start Jarvis daemon' },
      { cmd: '/jarvis task', label: '/jarvis task "..."', description: 'Add task to queue' },
      { cmd: '/jarvis tasks', label: '/jarvis tasks', description: 'List all tasks' },
      { cmd: '/jarvis status', label: '/jarvis status [id]', description: 'Show task/daemon status' },
      { cmd: '/jarvis stop', label: '/jarvis stop', description: 'Stop Jarvis daemon' },
      { cmd: '/jarvis pause', label: '/jarvis pause', description: 'Pause daemon' },
      { cmd: '/jarvis resume', label: '/jarvis resume', description: 'Resume daemon' },
      { cmd: '/jarvis clear', label: '/jarvis clear', description: 'Clear completed tasks' },
      { cmd: '/jarvis local', label: '/jarvis local', description: 'Switch to project-local Jarvis' },
      { cmd: '/jarvis global', label: '/jarvis global', description: 'Switch to global Jarvis' },
      { cmd: '/jarvis name', label: '/jarvis name "..."', description: 'Set Jarvis name' },
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
    category: 'Bug Journal', color: '#ff4444',
    items: [
      { cmd: '/bugs', label: '/bugs', description: 'List all tracked bugs' },
      { cmd: '/bugs open', label: '/bugs open', description: 'Show only open bugs' },
      { cmd: '/bugfix', label: '/bugfix', description: 'Review & fix all open bugs' },
    ],
  },
  {
    category: 'Browser', color: '#ff8800',
    items: [
      { cmd: '/browser', label: '/browser [url]', description: 'Open browser (optional URL)' },
      { cmd: '/browser close', label: '/browser close', description: 'Close the browser' },
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
  ${theme.primary('/connect'.padEnd(22))} ${theme.dim('Reconnect brain server for web dashboard')}

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

  // Bug journal (persistent bug tracking)
  const bugJournal = new BugJournal(process.cwd());

  // Jarvis AGI modules — scope-aware init happens below after brainScope detection
  let jarvisQueue: JarvisQueue;
  let jarvisIdentity: JarvisIdentityManager;
  let jarvisProposals: ProposalJournal;
  let jarvisScheduler: JarvisScheduler;
  let jarvisTriggers: TriggerManager;
  let jarvisWorldModel: WorldModelManager;
  let jarvisAutonomy: AutonomyManager;
  let jarvisNotifications: NotificationManager;
  let jarvisScope: BrainScope;
  let jarvisDaemonSession: import('../sessions/session.js').Session | null = null;
  let jarvisPaused = false;
  const resolveJarvisRoot = (scope: BrainScope) =>
    scope === 'project' ? process.cwd() : join(homedir(), '.spiral-context');

  // Browser controller (lazy — instantiated on /browser or agent tool use)
  let browserController: BrowserController | undefined;
  let visionProcessor: VisionProcessor | undefined;

  // Bottom chrome (3 fixed rows at terminal bottom: separator, hints, statusbar)
  const chrome = new BottomChrome();

  // Activity indicator (renders on chrome row 0 during agent work)
  const activity = new ActivityIndicator(chrome);

  // Agent controller for pause/resume
  const agentController = new AgentController();
  let agentRunning = false;
  let autonomousMode = false;

  // Forward-declared findings handler (reassigned by control protocol if active)
  let pushFindingsToBrainFn: ((session: import('../sessions/session.js').Session) => void) | null = null;

  // Forward-declared browser screenshot handler (reassigned when brain server is active)
  let pushScreenshotToBrainFn: ((info: { url: string; title?: string; imageBase64?: string; analysis?: string }) => void) | null = null;

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
  // Requires directory trust before creating .helixmind/
  const { detectBrainScope, resolveDataDir: resolveSpiralDir, loadConfig: loadSpiralConfig } = await import('../../utils/config.js');
  const { mkdirSync, existsSync } = await import('node:fs');
  const { isSystemDirectory, isDirectoryTrusted, trustDirectory } = await import('../config/trust.js');
  type BrainScope = 'project' | 'global';
  let brainScope: BrainScope = detectBrainScope(process.cwd());

  // Determine if we can create .helixmind/ in this directory
  const cwd = process.cwd();
  const helixDir = join(cwd, '.helixmind');
  if (!existsSync(helixDir)) {
    if (isSystemDirectory(cwd)) {
      // System directory — never create .helixmind/, use global brain silently
      brainScope = 'global';
    } else if (isDirectoryTrusted(cwd)) {
      // Already trusted — create .helixmind/
      try {
        mkdirSync(helixDir, { recursive: true });
        renderInfo(chalk.dim('  Created .helixmind/ directory for local brain'));
        brainScope = 'project';
      } catch {
        // Permission error — fall back to global brain
        brainScope = 'global';
      }
    } else {
      // New directory — ask for trust
      const { confirmMenu } = await import('../ui/select-menu.js');
      process.stdout.write('\n');
      renderInfo(chalk.hex('#ff6600').bold('  New directory detected'));
      renderInfo(chalk.dim(`  ${cwd}`));
      const trusted = await confirmMenu(
        `Do you trust this directory? ${chalk.dim('(HelixMind will create .helixmind/ for local brain data)')}`,
        false,
      );
      if (trusted) {
        trustDirectory(cwd);
        try {
          mkdirSync(helixDir, { recursive: true });
          renderInfo(chalk.dim('  Created .helixmind/ directory for local brain'));
          brainScope = 'project';
        } catch {
          renderInfo(chalk.yellow('  Could not create .helixmind/ — using global brain'));
          brainScope = 'global';
        }
      } else {
        renderInfo(chalk.dim('  Using global brain (no local data)'));
        brainScope = 'global';
      }
    }
  }
  // Jarvis scope follows brain scope — init after brainScope detection
  jarvisScope = brainScope;
  jarvisQueue = new JarvisQueue(resolveJarvisRoot(jarvisScope));
  jarvisIdentity = new JarvisIdentityManager(resolveJarvisRoot(jarvisScope));
  jarvisProposals = new ProposalJournal(resolveJarvisRoot(jarvisScope));
  jarvisScheduler = new JarvisScheduler(resolveJarvisRoot(jarvisScope));
  jarvisTriggers = new TriggerManager(resolveJarvisRoot(jarvisScope));
  jarvisWorldModel = new WorldModelManager(resolveJarvisRoot(jarvisScope));
  jarvisAutonomy = new AutonomyManager(jarvisIdentity.getIdentity().autonomyLevel);
  jarvisNotifications = new NotificationManager(resolveJarvisRoot(jarvisScope));

  let spiralEngine: any = null;

  async function initSpiralEngine(scope: BrainScope): Promise<any> {
    try {
      const { SpiralEngine } = await import('../../spiral/engine.js');
      const dataDir = resolveSpiralDir(scope, process.cwd());
      const spiralConfig = loadSpiralConfig(dataDir);
      const engine = new SpiralEngine(spiralConfig);
      await engine.initialize();
      return engine;
    } catch (err) {
      console.error('[Spiral] Init failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  if (config.spiral.enabled) {
    spiralEngine = await initSpiralEngine(brainScope);
  }

  // Build ThinkingCallbacks for Jarvis AGI thinking loop
  function buildThinkingCallbacks(
    bgSession: import('../sessions/session.js').Session,
  ): ThinkingCallbacks {
    return {
      sendMessage: async (prompt) => {
        bgSession.controller.reset();
        const rth = { text: '' };
        const orig = bgSession.buffer.addAssistantSummary.bind(bgSession.buffer);
        bgSession.buffer.addAssistantSummary = (t: string) => { rth.text = t; orig(t); };
        await sendAgentMessage(
          prompt, bgSession.history, provider, project, spiralEngine, config,
          permissions, bgSession.undoStack, checkpointStore,
          bgSession.controller, new ActivityIndicator(), bgSession.buffer,
          (inp, out) => { sessionTokensInput += inp; sessionTokensOutput += out; },
          () => { sessionToolCalls++; },
          undefined, { enabled: false, verbose: false, strict: false },
        );
        bgSession.buffer.addAssistantSummary = orig;
        return rth.text;
      },
      isAborted: () => bgSession.controller.isAborted,
      isPaused: () => jarvisPaused,
      querySpiral: async (query, maxTokens) => {
        if (!spiralEngine) return '';
        try {
          const results = await spiralEngine.query(query, { maxResults: maxTokens ?? 50 });
          return results.level_1.concat(results.level_2, results.level_3)
            .map((n: any) => `[${n.type}] ${n.content}`)
            .join('\n')
            .slice(0, 4000);
        } catch { return ''; }
      },
      storeInSpiral: async (content, type, tags) => {
        if (!spiralEngine) return;
        try { await spiralEngine!.add(content, { type: type as any, tags }); } catch {}
      },
      createProposal: (title, desc, rationale, opts) => {
        return jarvisProposals.create(title, desc, rationale, opts);
      },
      wouldLikelyBeDenied: (cat, files) => {
        return jarvisProposals.wouldLikelyBeDenied(cat, files);
      },
      getIdentity: () => jarvisIdentity.getIdentity(),
      updateIdentity: (event) => jarvisIdentity.recordEvent(event),
      pushEvent: (type, payload) => {
        import('../brain/generator.js').then(mod => {
          if (mod.isBrainServerRunning?.()) {
            mod.pushNeuronFired?.(
              payload.fromOrbit as string || 'green',
              payload.color as string || '#00ff88',
              payload.trigger as string || type,
            );
          }
        }).catch(() => {});
      },
      captureProjectState: () => jarvisWorldModel.captureProjectState(),
      getScheduledTasks: () => jarvisScheduler.listSchedules().filter(s => s.enabled),
      checkTriggers: (delta) => jarvisTriggers.checkTriggers(delta),
      updateStatus: () => updateStatusBar(),
    };
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
      bugJournal, browserController, visionProcessor, pushScreenshotToBrainFn,
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
        pushBugCreated,
        pushBugUpdated,
        pushBrowserScreenshot,
        pushControlEvent,
        startRelayClient,
        pushJarvisTaskCreated,
        pushJarvisTaskUpdated,
        pushJarvisStatusChanged,
      } = await import('../brain/generator.js');
      const { serializeSession, buildInstanceMeta, resetInstanceStartTime, serializeJarvisTask } = await import('../brain/control-protocol.js');

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

        sendChat: (text, chatId, mode) => {
          const effectiveChatId = chatId || `web-${Date.now()}`;
          // Import web chat handler and run asynchronously
          import('../brain/web-chat-handler.js').then(({ handleWebChat }) => {
            handleWebChat(text, effectiveChatId, {
              provider,
              spiralEngine,
              project,
              config,
              checkpointStore,
              bugJournal,
            }, {
              onStarted: (cid) => {
                pushControlEvent({ type: 'chat_started', chatId: cid, timestamp: Date.now() });
              },
              onTextChunk: (cid, chunk) => {
                pushControlEvent({ type: 'chat_text_chunk', chatId: cid, text: chunk, timestamp: Date.now() });
              },
              onToolStart: (cid, stepNum, toolName, toolInput) => {
                pushControlEvent({ type: 'chat_tool_start', chatId: cid, stepNum, toolName, toolInput, timestamp: Date.now() });
              },
              onToolEnd: (cid, stepNum, toolName, status, result) => {
                pushControlEvent({ type: 'chat_tool_end', chatId: cid, stepNum, toolName, status, result, timestamp: Date.now() });
              },
              onComplete: (cid, fullText, steps, tokensUsed) => {
                pushControlEvent({ type: 'chat_complete', chatId: cid, text: fullText, steps, tokensUsed, timestamp: Date.now() });
              },
              onError: (cid, error) => {
                pushControlEvent({ type: 'chat_error', chatId: cid, error, timestamp: Date.now() });
              },
            }).catch((err) => {
              pushControlEvent({ type: 'chat_error', chatId: effectiveChatId, error: err?.message || 'Unknown error', timestamp: Date.now() });
            });
          }).catch(() => {});
        },

        startMonitor: (mode) => {
          const existingMonitor = sessionMgr.background.find(
            s => s.name.includes('Monitor') && s.status === 'running',
          );
          if (existingMonitor) return existingMonitor.id;

          const modeIcons: Record<string, string> = { passive: '\u{1F50D}', defensive: '\u{1F6E1}\uFE0F', active: '\u2694\uFE0F' };
          const icon = modeIcons[mode] || '\u{1F6E1}\uFE0F';
          const bgSession = sessionMgr.create(`${icon} Monitor`, icon, agentHistory);
          bgSession.start();
          wireSessionOutput(bgSession);
          pushSessionCreated(serializeSession(bgSession));

          // Start monitor in background (same as /monitor command)
          (async () => {
            try {
              const { scanSystem } = await import('../agent/monitor/scanner.js');
              const { buildBaseline } = await import('../agent/monitor/baseline.js');
              const { runMonitorLoop } = await import('../agent/monitor/watcher.js');
              const { pushMonitorStatus: pushStatus } = await import('../brain/generator.js');

              // Helper: log to both session buffer and terminal
              const mLog = (msg: string) => { bgSession.capture(msg); renderInfo(`${chalk.hex('#ff6600')(icon)} ${chalk.dim(msg)}`); };

              mLog('Phase 1: Scanning system...');
              const scanResult = await scanSystem({
                sendMessage: async (prompt) => {
                  bgSession.controller.reset();
                  const rth = { text: '' };
                  const orig = bgSession.buffer.addAssistantSummary.bind(bgSession.buffer);
                  bgSession.buffer.addAssistantSummary = (t: string) => { rth.text = t; orig(t); };
                  await sendAgentMessage(
                    prompt, bgSession.history, provider, project, spiralEngine, config,
                    permissions, bgSession.undoStack, checkpointStore,
                    bgSession.controller, new ActivityIndicator(), bgSession.buffer,
                    (inp, out) => { sessionTokensInput += inp; sessionTokensOutput += out; },
                    () => { sessionToolCalls++; },
                    undefined, { enabled: false, verbose: false, strict: false },
                  );
                  bgSession.buffer.addAssistantSummary = orig;
                  return rth.text;
                },
                isAborted: () => bgSession.controller.isAborted,
                onThreat: () => {}, onDefense: () => {},
                onScanComplete: (p) => mLog(`Scan: ${p}`),
                onStatusUpdate: () => {}, updateStatus: () => {},
              });
              if (bgSession.controller.isAborted) return;

              mLog('Phase 2: Building baseline...');
              const baseline = buildBaseline(scanResult);
              mLog(`Baseline: ${baseline.processes.length} processes, ${baseline.ports.length} ports`);
              if (bgSession.controller.isAborted) return;

              mLog(`Phase 3: Monitoring (${mode} mode)...`);
              await runMonitorLoop({
                sendMessage: async (prompt) => {
                  bgSession.controller.reset();
                  const rth = { text: '' };
                  const orig = bgSession.buffer.addAssistantSummary.bind(bgSession.buffer);
                  bgSession.buffer.addAssistantSummary = (t: string) => { rth.text = t; orig(t); };
                  await sendAgentMessage(
                    prompt, bgSession.history, provider, project, spiralEngine, config,
                    permissions, bgSession.undoStack, checkpointStore,
                    bgSession.controller, new ActivityIndicator(), bgSession.buffer,
                    (inp, out) => { sessionTokensInput += inp; sessionTokensOutput += out; },
                    () => { sessionToolCalls++; },
                    undefined, { enabled: false, verbose: false, strict: false },
                  );
                  bgSession.buffer.addAssistantSummary = orig;
                  return rth.text;
                },
                isAborted: () => bgSession.controller.isAborted,
                onThreat: (t) => {
                  const msg = `THREAT [${t.severity}]: ${t.title}`;
                  bgSession.capture(msg);
                  const sc = t.severity === 'critical' ? '#ff0000' : t.severity === 'high' ? '#ff6600' : t.severity === 'medium' ? '#ffaa00' : '#888888';
                  renderInfo(`${chalk.hex(sc)('\u26A0')} ${chalk.hex(sc)(msg)}`);
                },
                onDefense: (d) => {
                  const msg = `DEFENSE: ${d.action} \u2192 ${d.target}`;
                  bgSession.capture(msg);
                  renderInfo(`${chalk.green('\u{1F6E1}\uFE0F')} ${chalk.green(msg)}`);
                },
                onScanComplete: (p) => mLog(`Check: ${p}`),
                onStatusUpdate: (state) => {
                  pushStatus({ mode: state.mode, uptime: state.uptime, threatCount: state.threats.length, defenseCount: state.defenses.length, lastScan: state.lastScan });
                },
                updateStatus: () => updateStatusBar(),
              }, mode, baseline);
            } catch (err) {
              if (!(err instanceof AgentAbortError)) bgSession.capture(`Monitor error: ${err}`);
            }
            sessionMgr.complete(bgSession.id, { text: 'Monitor ended', steps: [], errors: bgSession.controller.isAborted ? ['Stopped'] : [], durationMs: bgSession.elapsed });
            pushSessionUpdate(serializeSession(bgSession));
          })();

          return bgSession.id;
        },

        stopMonitor: () => {
          const monitorSession = sessionMgr.background.find(
            s => s.name.includes('Monitor') && s.status === 'running',
          );
          if (!monitorSession) return false;
          monitorSession.abort();
          pushSessionUpdate(serializeSession(monitorSession));
          return true;
        },

        handleMonitorCommand: (command, params) => {
          if (command === 'stop_monitor') {
            const ms = sessionMgr.background.find(s => s.name.includes('Monitor') && s.status === 'running');
            if (ms) { ms.abort(); pushSessionUpdate(serializeSession(ms)); }
          }
          // Other commands (set_mode, rescan, unblock_ip) can be extended here
        },

        handleApprovalResponse: (requestId, approved) => {
          import('../agent/monitor/alerter.js').then(({ resolveApproval }) => {
            resolveApproval(requestId, approved);
          }).catch(() => {});
        },

        getFindings: () => [...collectedFindings],

        getBugs: () => bugJournal.getAllBugs().map(b => ({
          id: b.id,
          description: b.description,
          file: b.file,
          line: b.line,
          status: b.status,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
          fixedAt: b.fixedAt,
          fixDescription: b.fixDescription,
        })),

        startJarvis: () => {
          if (jarvisDaemonSession && jarvisDaemonSession.status === 'running') return jarvisDaemonSession.id;
          const jName = jarvisIdentity.getIdentity().name;
          const bgSession = sessionMgr.create(`\u{1F916} ${jName}`, '\u{1F916}', agentHistory);
          bgSession.start();
          wireSessionOutput(bgSession);
          pushSessionCreated(serializeSession(bgSession));
          jarvisDaemonSession = bgSession;
          jarvisPaused = false;

          (async () => {
            try {
              await runJarvisDaemon(jarvisQueue, {
                sendMessage: async (prompt) => {
                  bgSession.controller.reset();
                  const rth = { text: '' };
                  const orig = bgSession.buffer.addAssistantSummary.bind(bgSession.buffer);
                  bgSession.buffer.addAssistantSummary = (t: string) => { rth.text = t; orig(t); };
                  await sendAgentMessage(
                    prompt, bgSession.history, provider, project, spiralEngine, config,
                    permissions, bgSession.undoStack, checkpointStore,
                    bgSession.controller, new ActivityIndicator(), bgSession.buffer,
                    (inp, out) => { sessionTokensInput += inp; sessionTokensOutput += out; },
                    () => { sessionToolCalls++; },
                    undefined, { enabled: false, verbose: false, strict: false },
                  );
                  bgSession.buffer.addAssistantSummary = orig;
                  return rth.text;
                },
                isAborted: () => bgSession.controller.isAborted,
                isPaused: () => jarvisPaused,
                onTaskStart: (task) => { bgSession.capture(`\u25B6 Task #${task.id}: ${task.title}`); pushSessionUpdate(serializeSession(bgSession)); },
                onTaskComplete: (task, result) => {
                  bgSession.capture(`\u2713 Task #${task.id} done: ${result.slice(0, 100)}`);
                  jarvisIdentity.recordEvent({ type: 'task_completed', taskId: task.id, summary: result });
                  const evalResult = jarvisAutonomy.evaluate(jarvisIdentity.getIdentity());
                  if (evalResult.changed) {
                    jarvisIdentity.recordEvent({
                      type: 'autonomy_changed',
                      oldLevel: (evalResult.newLevel === jarvisIdentity.getIdentity().autonomyLevel
                        ? evalResult.newLevel : jarvisIdentity.getIdentity().autonomyLevel) as any,
                      newLevel: evalResult.newLevel,
                      reason: evalResult.reason,
                    });
                    jarvisIdentity.setAutonomyLevel(evalResult.newLevel);
                    renderInfo(chalk.hex('#ff00ff')(`\u2B06 ${jName} Autonomy: L${evalResult.newLevel} \u2014 ${evalResult.reason}`));
                  }
                  pushSessionUpdate(serializeSession(bgSession));
                },
                onTaskFailed: (task, error) => {
                  bgSession.capture(`\u2717 Task #${task.id} failed: ${error.slice(0, 100)}`);
                  jarvisIdentity.recordEvent({ type: 'task_failed', taskId: task.id, error });
                  if (task.priority === 'high') {
                    jarvisNotifications.notify(`${jName}: Task #${task.id} failed`, error.slice(0, 200), 'important').catch(() => {});
                  }
                  pushSessionUpdate(serializeSession(bgSession));
                },
                updateStatus: () => updateStatusBar(),
                storeInSpiral: spiralEngine ? async (content, type, tags) => {
                  try { await spiralEngine!.add(content, { type: type as any, tags }); } catch {}
                } : undefined,
                getIdentityName: () => jarvisIdentity.getIdentity().name,
                getUserGoals: () => jarvisIdentity.getIdentity().userGoals,
                getIdentityPrompt: () => jarvisIdentity.getIdentityPrompt(),
                thinkingCallbacks: buildThinkingCallbacks(bgSession),
              });
            } catch (err) {
              if (!(err instanceof AgentAbortError)) bgSession.capture(`${jName} error: ${err}`);
            }
            sessionMgr.complete(bgSession.id, { text: `${jName} stopped`, steps: [], errors: bgSession.controller.isAborted ? ['Stopped'] : [], durationMs: bgSession.elapsed });
            pushSessionUpdate(serializeSession(bgSession));
            jarvisDaemonSession = null;
          })();

          return bgSession.id;
        },

        stopJarvis: () => {
          if (!jarvisDaemonSession) return false;
          jarvisDaemonSession.abort();
          pushSessionUpdate(serializeSession(jarvisDaemonSession));
          jarvisDaemonSession = null;
          return true;
        },

        pauseJarvis: () => {
          if (!jarvisDaemonSession || jarvisPaused) return false;
          jarvisPaused = true;
          jarvisQueue.setDaemonState('paused');
          return true;
        },

        resumeJarvis: () => {
          if (!jarvisDaemonSession || !jarvisPaused) return false;
          jarvisPaused = false;
          jarvisQueue.setDaemonState('running');
          return true;
        },

        addJarvisTask: (title, description, opts) => {
          const task = jarvisQueue.addTask(title, description, opts);
          return serializeJarvisTask(task);
        },

        listJarvisTasks: () => jarvisQueue.getAllTasks().map(serializeJarvisTask),

        getJarvisStatus: () => ({
          ...jarvisQueue.getStatus(),
          scope: jarvisScope === 'project' ? 'local' : 'global',
          jarvisName: jarvisIdentity.getIdentity().name,
        }),

        clearJarvisCompleted: () => jarvisQueue.clearCompleted(),

        // Jarvis AGI handlers (stubs — wired when AGI modules are initialized)
        listProposals: () => [],
        approveProposal: () => false,
        denyProposal: () => false,
        setAutonomyLevel: () => false,
        getIdentity: () => null,
        triggerDeepThink: () => {},
        addSchedule: () => null,
        removeSchedule: () => false,
        listSchedules: () => [],
        addTrigger: () => null,
        removeTrigger: () => false,
        listTriggers: () => [],
        listProjects: () => [],
        registerProject: () => null,
        getWorkers: () => [],
      });

      // Wire bug journal change events to brain server
      bugJournal.setOnChange((event, bug) => {
        const bugInfo = {
          id: bug.id,
          description: bug.description,
          file: bug.file,
          line: bug.line,
          status: bug.status,
          createdAt: bug.createdAt,
          updatedAt: bug.updatedAt,
          fixedAt: bug.fixedAt,
          fixDescription: bug.fixDescription,
        };
        if (event === 'bug_created') {
          pushBugCreated(bugInfo);
        } else {
          pushBugUpdated(bugInfo);
        }
      });

      // Wire Jarvis queue change events to brain server
      jarvisQueue.setOnChange((event, task) => {
        const info = serializeJarvisTask(task);
        if (event === 'task_created') {
          pushJarvisTaskCreated(info);
        } else {
          pushJarvisTaskUpdated(info);
        }
      });

      // Wire browser screenshots to brain server
      pushScreenshotToBrainFn = (info) => {
        pushBrowserScreenshot({
          url: info.url,
          title: info.title,
          timestamp: Date.now(),
          imageBase64: info.imageBase64,
          analysis: info.analysis,
        });
      };

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
          sendChat: (text, chatId, mode) => {
            const effectiveChatId = chatId || `relay-${Date.now()}`;
            import('../brain/web-chat-handler.js').then(({ handleWebChat }) => {
              handleWebChat(text, effectiveChatId, {
                provider, spiralEngine, project, config, checkpointStore, bugJournal,
              }, {
                onStarted: (cid) => { pushControlEvent({ type: 'chat_started', chatId: cid, timestamp: Date.now() }); },
                onTextChunk: (cid, chunk) => { pushControlEvent({ type: 'chat_text_chunk', chatId: cid, text: chunk, timestamp: Date.now() }); },
                onToolStart: (cid, sn, tn, ti) => { pushControlEvent({ type: 'chat_tool_start', chatId: cid, stepNum: sn, toolName: tn, toolInput: ti, timestamp: Date.now() }); },
                onToolEnd: (cid, sn, tn, st, r) => { pushControlEvent({ type: 'chat_tool_end', chatId: cid, stepNum: sn, toolName: tn, status: st, result: r, timestamp: Date.now() }); },
                onComplete: (cid, ft, s, tu) => { pushControlEvent({ type: 'chat_complete', chatId: cid, text: ft, steps: s, tokensUsed: tu, timestamp: Date.now() }); },
                onError: (cid, e) => { pushControlEvent({ type: 'chat_error', chatId: cid, error: e, timestamp: Date.now() }); },
              }).catch((err) => {
                pushControlEvent({ type: 'chat_error', chatId: effectiveChatId, error: err?.message || 'Unknown error', timestamp: Date.now() });
              });
            }).catch(() => {});
          },
          startMonitor: () => '',
          stopMonitor: () => false,
          handleMonitorCommand: () => {},
          handleApprovalResponse: () => {},
          getFindings: () => [...collectedFindings],
          getBugs: () => bugJournal.getAllBugs().map(b => ({
            id: b.id, description: b.description, file: b.file, line: b.line,
            status: b.status, createdAt: b.createdAt, updatedAt: b.updatedAt,
            fixedAt: b.fixedAt, fixDescription: b.fixDescription,
          })),
          startJarvis: () => '',
          stopJarvis: () => false,
          pauseJarvis: () => false,
          resumeJarvis: () => false,
          addJarvisTask: () => ({ id: 0, title: '', description: '', status: 'pending' as const, priority: 'medium' as const, createdAt: Date.now(), updatedAt: Date.now(), retries: 0, maxRetries: 3, tags: [] }),
          listJarvisTasks: () => [],
          getJarvisStatus: () => ({ daemonState: 'stopped' as const, currentTaskId: null, pendingCount: 0, completedCount: 0, failedCount: 0, totalCount: 0, uptimeMs: 0 }),
          clearJarvisCompleted: () => {},
          // Jarvis AGI stubs (relay fallback)
          listProposals: () => [],
          approveProposal: () => false,
          denyProposal: () => false,
          setAutonomyLevel: () => false,
          getIdentity: () => null,
          triggerDeepThink: () => {},
          addSchedule: () => null,
          removeSchedule: () => false,
          listSchedules: () => [],
          addTrigger: () => null,
          removeTrigger: () => false,
          listTriggers: () => [],
          listProjects: () => [],
          registerProject: () => null,
          getWorkers: () => [],
        }, updateMeta).catch(() => {});
      }
    } catch { /* control protocol optional */ }
  }

  renderInfo(`  Type /help for commands, ESC = stop agent, Ctrl+C twice to exit\n`);
  process.stdout.write(theme.separator + '\n');

  // Flag: true while user is at the prompt (typing). Footer timer skips updates
  // when this is true to prevent cursor-jumping from interfering with readline.
  let isAtPrompt = false;

  // Muted stream to suppress readline echo during agent work.
  // Prevents typed characters from mixing with agent output in the scroll area.
  const devNull = new Writable({ write: (_chunk, _enc, cb) => cb() });

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
    const pipe = chalk.hex('#00d4ff').dim('\u2502');
    const gt = chalk.hex('#00d4ff').bold('\u276F');
    const escapedPipe = pipe.replace(/(\x1b\[[0-9;]*m)/g, `${ansiStart}$1${ansiEnd}`);
    const escapedGt = gt.replace(/(\x1b\[[0-9;]*m)/g, `${ansiStart}$1${ansiEnd}`);
    return `${escapedPipe} ${escapedGt} `;
  }

  /** Build top border for input box: ┌──────────────────┐ */
  function buildTopBorder(w: number): string {
    const dim = chalk.hex('#00d4ff').dim;
    return dim('\u250C' + '\u2500'.repeat(w - 2) + '\u2510');
  }

  /** Build bottom border with embedded statusbar: └─ ◉ L1:7020 | ⚡ 636 tok ──┘ */
  function buildBottomBorder(w: number, statusText: string): string {
    const dim = chalk.hex('#00d4ff').dim;
    const prefix = dim('\u2514\u2500 ');
    const statusVis = visibleLength(statusText);
    const fill = Math.max(0, w - 4 - statusVis - 1); // 4 = "└─ " + space, 1 = "┘"
    return `${prefix}${statusText} ${dim('\u2500'.repeat(fill) + '\u2518')}`;
  }

  /** Build hint line content for chrome row 2 */
  function buildHintLine(): string {
    const data = getStatusBarData();
    const hints: string[] = [];
    if (data.permissionMode === 'yolo') hints.push(chalk.red('\u25B8\u25B8 yolo mode'));
    else if (data.permissionMode === 'skip') hints.push(chalk.yellow('\u25B8\u25B8 bypass permissions'));
    else hints.push(chalk.green('\u25B8\u25B8 safe permissions'));
    hints.push(chalk.dim('shift+tab to cycle'));
    hints.push(chalk.dim('esc to interrupt'));
    return hints.join(chalk.dim(' \u00B7 '));
  }

  /**
   * Show the full prompt area using sticky bottom chrome with input box:
   *   ┌──────────────────────────────────────┐  ← row N-2: top border (chrome row 0)
   *   │ ❯ input here_                            ← cursor here (bottom of scroll region, row N-3)
   *   └─ ◉ L1:7020 | ⚡ 636 tok | safe ──────┘  ← row N-1: bottom border + status (chrome row 1)
   *   ▸▸ safe permissions · shift+tab · esc      ← row N:   hints (chrome row 2)
   */
  function showPrompt(): void {
    const w = Math.max(20, (process.stdout.columns || 80) - 2);

    // Build chrome row content
    const topBorder = buildTopBorder(w);
    const data = getStatusBarData();
    const bar = renderStatusBar(data, w - 6); // narrower to fit in border frame
    let statusText = bar;
    if (sessionMgr.all.length > 1) {
      const tabBar = truncateBar(sessionMgr.renderTabs(), Math.floor(w / 2));
      statusText = `${tabBar}  ${bar}`;
    }
    const bottomBorder = buildBottomBorder(w, statusText);
    const hintLine = buildHintLine();

    // Set hints content on activity indicator (for restore on chrome row 2 after agent work)
    activity.setRestoreContent(hintLine);

    chrome.setRow(0, topBorder);
    chrome.setRow(1, bottomBorder);
    chrome.setRow(2, hintLine);

    // Activate chrome if not already (sets scroll region + hooks stdout)
    if (!chrome.isActive && !chrome.isInlineMode) {
      chrome.activate();
    }

    isAtPrompt = true;

    // Restore readline echo (may have been muted during agent work)
    (rl as any).output = process.stdout;

    if (chrome.isActive) {
      // Position cursor at the bottom of the scroll region, then prompt
      chrome.positionCursorForPrompt();
      rl.prompt();
    } else {
      // Inline fallback for small terminals
      const dim = chalk.hex('#00d4ff').dim;
      process.stdout.write(`\n${dim('\u250C' + '\u2500'.repeat(w - 2) + '\u2510')}\n`);
      process.stdout.write(`${dim('\u2502')} `);
      rl.prompt();
    }
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
      jarvisName: jarvisDaemonSession && jarvisDaemonSession.status === 'running'
        ? jarvisIdentity.getIdentity().name
        : undefined,
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

  // Update prompt, chrome, and activity on terminal resize
  process.stdout.on('resize', () => {
    rl.setPrompt(makePrompt());
    chrome.handleResize();
    activity.handleResize();
    if (isAtPrompt) {
      chrome.positionCursorForPrompt();
      rl.prompt();
    }
  });

  // Track suggestion overlay state
  let lastSuggestionCount = 0;

  permissions.setReadline(rl);
  permissions.setPromptCallback((active) => { isAtPrompt = active; });

  // Mute readline echo during LLM streaming (animation running) to prevent typed
  // chars from mixing with agent output. Unmute during tool execution so the user
  // can answer permission prompts normally at the prompt row.
  activity.setMuteCallbacks(
    () => {
      (rl as any).output = devNull;
    },
    () => {
      (rl as any).output = process.stdout;
      // Clear type-ahead preview from prompt row when unmuting
      if (chrome.isActive) chrome.writeAtPromptRow('');
    },
  );

  // Ctrl+C behavior:
  // - If there's text on the line → clear the line (like a normal terminal)
  // - If agent is running → interrupt agent
  // - If line is empty → count towards exit (double Ctrl+C = exit)
  //
  // IMPORTANT: Use rl.on('SIGINT') instead of process.on('SIGINT') because
  // readline clears rl.line BEFORE emitting process SIGINT. The rl-level
  // event fires while rl.line still has the original content.
  let ctrlCCount = 0;
  let ctrlCTimer: ReturnType<typeof setTimeout> | null = null;

  rl.on('SIGINT', () => {
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
    // (rl.line is still populated at this point — not yet cleared)
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

    // Also clear paste buffer if it has content
    if (pasteBuffer.length > 0) {
      pasteBuffer = [];
      if (pasteTimer) { clearTimeout(pasteTimer); pasteTimer = null; }
      process.stdout.write('\n');
      renderInfo(chalk.dim('Input cleared.'));
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

  // Fallback: OS-level SIGINT (e.g. kill -INT) — graceful exit
  process.on('SIGINT', () => {
    // Only handle if not already handled by rl.on('SIGINT')
    if (!process.stdin.isTTY) {
      process.exit(0);
    }
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
          const { isSystemDirectory: isSysDir } = await import('../config/trust.js');
          const hlxDir = join(process.cwd(), '.helixmind');
          if (!existsSync(hlxDir)) {
            if (isSysDir(process.cwd())) {
              throw new Error('Cannot create .helixmind/ in system directory');
            }
            try { mkdirSync(hlxDir, { recursive: true }); } catch {
              throw new Error('Cannot create .helixmind/ — permission denied');
            }
          }
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
        updateStatusBar();
        return;
      }
      if (key.ctrl && key.name === 'pagedown') {
        sessionMgr.switchNext();
        updateStatusBar();
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
      // Single ESC stops running agents immediately.
      // Double ESC opens the checkpoint Rewind browser.
      // IMPORTANT: Don't return after STOP — fall through so processKeypress
      // always sees the ESC for double-ESC detection.
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
          // NOTE: no return — fall through to double-ESC detection below
        }
      }

      // Double-ESC detection (checkpoint Rewind browser)
      // processKeypress tracks ESC timing even when STOP ran above.
      const result = processKeypress(key, keyState);
      if (result.action === 'open_browser' && !agentRunning) {
        // Check if there are any checkpoints before opening browser
        const allCps = checkpointStore.getAll();
        if (allCps.length === 0 || allCps.filter(cp => cp.type === 'chat').length === 0) {
          renderInfo(chalk.dim('No checkpoints yet \u2014 start chatting to create rewind points.'));
          showPrompt();
        } else {
          // Open checkpoint browser — deactivate chrome for fullscreen TUI
          rl.pause();
          chrome.deactivate();
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

              // Restore user text into readline input
              if (browserResult.messageText) {
                (rl as any).line = browserResult.messageText;
                (rl as any).cursor = browserResult.messageText.length;
              }
            }
          } catch {
            // Browser closed unexpectedly
          }
          chrome.activate();
          rl.resume();
          showPrompt();
        }
      }
    });
  }

  // Build Jarvis identity context for system prompt injection (when daemon is active)
  function getJarvisContextForPrompt(): string | null {
    if (!jarvisDaemonSession || jarvisDaemonSession.status !== 'running') return null;
    return jarvisIdentity.getIdentityPrompt();
  }

  // Update statusbar via BottomChrome row 1 (bottom border with embedded status).
  // Called during agent work by the footer timer to update token counts etc.
  function updateStatusBar(): void {
    if (!process.stdout.isTTY) return;
    const data = getStatusBarData();
    const w = (process.stdout.columns || 80) - 2;
    const bar = renderStatusBar(data, w - 6); // narrower to fit in border frame

    // Combine tab bar into status text when background sessions exist
    let statusText = bar;
    if (sessionMgr.all.length > 1) {
      const tabBar = truncateBar(sessionMgr.renderTabs(), Math.floor(w / 2));
      statusText = `${tabBar}  ${bar}`;
    }

    if (chrome.isActive) {
      chrome.setRow(1, buildBottomBorder(w, statusText));
    } else {
      // Inline fallback
      writeStatusBar(data);
    }
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
  const PASTE_THRESHOLD_MS = 100; // Lines arriving faster than this = paste (100ms for Windows compat)

  // Ensure enough blank lines so the chrome rows don't overlap init output.
  // The scroll region needs at least RESERVED_ROWS (3) free rows at the bottom.
  if (process.stdout.isTTY) {
    process.stdout.write('\n\n\n\n');
  }

  // Show full prompt area on startup (separator + status + > prompt)
  showPrompt();

  // Footer timer — redraws statusbar on chrome row 2 during agent work.
  // Skipped when:
  //   - user is at readline prompt (isAtPrompt) — prevents cursor-jumping
  //   - inline progress active (inlineProgressActive) — prevents flicker over feed progress
  // Note: activity.isAnimating guard no longer needed — activity uses chrome row 0,
  // statusbar uses chrome row 2, they don't collide.
  const footerTimer = setInterval(() => {
    if (process.stdout.isTTY && !isAtPrompt && !inlineProgressActive) updateStatusBar();
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

    // Handle /browser directly (needs access to browserController closure)
    if (input.startsWith('/browser')) {
      const browserParts = input.split(/\s+/);
      const browserArg = browserParts.slice(1).join(' ').trim();

      if (browserArg === 'close') {
        if (browserController?.isOpen()) {
          await browserController.close();
          renderInfo('Browser closed.');
        } else {
          renderInfo('Browser is not open.');
        }
        showPrompt();
        return;
      }

      // Initialize browser controller if needed
      if (!browserController) {
        browserController = new BrowserController();
      }

      if (browserController.isOpen() && !browserArg) {
        renderInfo(`Browser already open at: ${browserController.getUrl() || 'about:blank'}`);
        showPrompt();
        return;
      }

      try {
        if (!browserController.isOpen()) {
          await browserController.launch();
          renderInfo('Browser opened.');
        }
        if (browserArg) {
          const result = await browserController.navigate(browserArg);
          renderInfo(`Navigated to: ${result.title} (${result.url})`);
        }
      } catch (err) {
        renderInfo(`Browser error: ${err instanceof Error ? err.message : String(err)}`);
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
            const { isSystemDirectory: isSysDir2 } = await import('../config/trust.js');
            const projDir = join(process.cwd(), '.helixmind');
            if (!existsSync(projDir)) {
              if (isSysDir2(process.cwd())) {
                renderInfo(chalk.yellow('  Cannot create .helixmind/ in system directory'));
                brainScope = 'global';
              } else {
                try {
                  mkdirSync(projDir, { recursive: true });
                  renderInfo(chalk.dim('  Created .helixmind/ directory'));
                } catch {
                  renderInfo(chalk.yellow('  Could not create .helixmind/ — using global brain'));
                  brainScope = 'global';
                }
              }
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

          if (action === 'monitor') {
            // Monitor mode — runs as background session with continuous watch loop
            const monitorMode = (goal as 'passive' | 'defensive' | 'active') || 'passive';
            const existingMonitor = sessionMgr.background.find(
              s => s.name.includes('Monitor') && s.status === 'running',
            );
            if (existingMonitor) {
              renderInfo('Monitor already running. Use /stop to stop it first.');
              return;
            }

            const modeIcons = { passive: '\u{1F50D}', defensive: '\u{1F6E1}\uFE0F', active: '\u2694\uFE0F' };
            const icon = modeIcons[monitorMode] || '\u{1F6E1}\uFE0F';
            const bgSession = sessionMgr.create(`${icon} Monitor`, icon, agentHistory);
            bgSession.start();
            renderInfo(`${chalk.hex('#ff6600')(icon)} Monitor started (${monitorMode}) ${chalk.dim(`[session ${bgSession.id}]`)}`);
            updateStatusBar();

            // Run monitor loop in background — user keeps prompt
            (async () => {
              try {
                const { scanSystem } = await import('../agent/monitor/scanner.js');
                const { buildBaseline } = await import('../agent/monitor/baseline.js');
                const { runMonitorLoop } = await import('../agent/monitor/watcher.js');
                const { pushMonitorStatus } = await import('../brain/generator.js');

                // Helper: show monitor event in terminal (prefixed with icon)
                const monitorLog = (msg: string) => {
                  bgSession.capture(msg);
                  renderInfo(`${chalk.hex('#ff6600')(icon)} ${chalk.dim(msg)}`);
                };

                // Phase 1: Full system scan
                monitorLog('Phase 1: Scanning system...');
                const scanResult = await scanSystem({
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
                  isAborted: () => bgSession.controller.isAborted,
                  onThreat: () => {},
                  onDefense: () => {},
                  onScanComplete: (phase) => monitorLog(`Scan: ${phase}`),
                  onStatusUpdate: () => updateStatusBar(),
                  updateStatus: () => updateStatusBar(),
                });

                if (bgSession.controller.isAborted) return;

                // Phase 2: Build baseline
                monitorLog('Phase 2: Building security baseline...');
                const baseline = buildBaseline(scanResult);
                monitorLog(`Baseline: ${baseline.processes.length} processes, ${baseline.ports.length} ports`);

                if (bgSession.controller.isAborted) return;

                // Phase 3: Continuous watching
                monitorLog(`Phase 3: Monitoring (${monitorMode} mode)...`);
                await runMonitorLoop({
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
                  isAborted: () => bgSession.controller.isAborted,
                  onThreat: (threat) => {
                    const msg = `THREAT [${threat.severity}]: ${threat.title}`;
                    bgSession.capture(msg);
                    // Threats are always prominently shown
                    const severityColor = threat.severity === 'critical' ? '#ff0000'
                      : threat.severity === 'high' ? '#ff6600'
                      : threat.severity === 'medium' ? '#ffaa00' : '#888888';
                    renderInfo(`${chalk.hex(severityColor)('\u26A0')} ${chalk.hex(severityColor)(msg)}`);
                  },
                  onDefense: (defense) => {
                    const msg = `DEFENSE: ${defense.action} \u2192 ${defense.target}`;
                    bgSession.capture(msg);
                    renderInfo(`${chalk.green('\u{1F6E1}\uFE0F')} ${chalk.green(msg)}`);
                  },
                  onScanComplete: (phase) => monitorLog(`Check: ${phase}`),
                  onStatusUpdate: (state) => {
                    pushMonitorStatus({
                      mode: state.mode,
                      uptime: state.uptime,
                      threatCount: state.threats.length,
                      defenseCount: state.defenses.length,
                      lastScan: state.lastScan,
                    });
                    updateStatusBar();
                  },
                  updateStatus: () => updateStatusBar(),
                }, monitorMode, baseline);
              } catch (err) {
                if (!(err instanceof AgentAbortError)) {
                  bgSession.capture(`Monitor error: ${err}`);
                }
              }

              sessionMgr.complete(bgSession.id, {
                text: 'Monitor session ended',
                steps: [],
                errors: bgSession.controller.isAborted ? ['Stopped by user'] : [],
                durationMs: bgSession.elapsed,
              });
              updateStatusBar();
            })();
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
        bugJournal,
        {
          queue: jarvisQueue,
          identity: jarvisIdentity,
          getScope: () => jarvisScope,
          setScope: (scope: 'project' | 'global') => {
            jarvisScope = scope;
            const newRoot = resolveJarvisRoot(scope);
            jarvisQueue = new JarvisQueue(newRoot);
            jarvisIdentity = new JarvisIdentityManager(newRoot);
            jarvisProposals = new ProposalJournal(newRoot);
            jarvisScheduler = new JarvisScheduler(newRoot);
            jarvisTriggers = new TriggerManager(newRoot);
            jarvisWorldModel = new WorldModelManager(newRoot);
            jarvisNotifications = new NotificationManager(newRoot);
            jarvisAutonomy = new AutonomyManager(jarvisIdentity.getIdentity().autonomyLevel);
          },
          getSession: () => jarvisDaemonSession,
          setSession: (s) => { jarvisDaemonSession = s; },
          isPaused: () => jarvisPaused,
          setPaused: (v) => { jarvisPaused = v; },
          startDaemon: () => {
            const jName = jarvisIdentity.getIdentity().name;
            const bgSession = sessionMgr.create(`\u{1F916} ${jName}`, '\u{1F916}', agentHistory);
            bgSession.start();
            jarvisDaemonSession = bgSession;
            jarvisPaused = false;
            renderInfo(chalk.hex('#ff00ff').bold(`\u{1F916} ${jName} daemon started`));
            renderInfo(chalk.dim('Add tasks with /jarvis task "description"'));

            (async () => {
              try {
                await runJarvisDaemon(jarvisQueue, {
                  sendMessage: async (prompt) => {
                    bgSession.controller.reset();
                    const rth = { text: '' };
                    const orig = bgSession.buffer.addAssistantSummary.bind(bgSession.buffer);
                    bgSession.buffer.addAssistantSummary = (t: string) => { rth.text = t; orig(t); };
                    await sendAgentMessage(
                      prompt, bgSession.history, provider, project, spiralEngine, config,
                      permissions, bgSession.undoStack, checkpointStore,
                      bgSession.controller, new ActivityIndicator(), bgSession.buffer,
                      (inp, out) => { sessionTokensInput += inp; sessionTokensOutput += out; },
                      () => { sessionToolCalls++; },
                      undefined, { enabled: false, verbose: false, strict: false },
                    );
                    bgSession.buffer.addAssistantSummary = orig;
                    return rth.text;
                  },
                  isAborted: () => bgSession.controller.isAborted,
                  isPaused: () => jarvisPaused,
                  onTaskStart: (task) => {
                    bgSession.capture(`\u25B6 Task #${task.id}: ${task.title}`);
                    renderInfo(chalk.hex('#ff00ff')(`\u25B6 ${jName}: Starting task #${task.id} \u2014 ${task.title}`));
                  },
                  onTaskComplete: (task, result) => {
                    bgSession.capture(`\u2713 Task #${task.id} done: ${result.slice(0, 100)}`);
                    renderInfo(chalk.hex('#ff00ff')(`\u2713 ${jName}: Task #${task.id} completed`));
                    jarvisIdentity.recordEvent({ type: 'task_completed', taskId: task.id, summary: result });
                    const evalResult = jarvisAutonomy.evaluate(jarvisIdentity.getIdentity());
                    if (evalResult.changed) {
                      jarvisIdentity.recordEvent({
                        type: 'autonomy_changed',
                        oldLevel: jarvisIdentity.getIdentity().autonomyLevel,
                        newLevel: evalResult.newLevel,
                        reason: evalResult.reason,
                      });
                      jarvisIdentity.setAutonomyLevel(evalResult.newLevel);
                      renderInfo(chalk.hex('#ff00ff')(`\u2B06 ${jName} Autonomy: L${evalResult.newLevel} \u2014 ${evalResult.reason}`));
                    }
                  },
                  onTaskFailed: (task, error) => {
                    bgSession.capture(`\u2717 Task #${task.id} failed: ${error.slice(0, 100)}`);
                    renderInfo(chalk.hex('#ff00ff')(`\u2717 ${jName}: Task #${task.id} failed \u2014 ${error.slice(0, 60)}`));
                    jarvisIdentity.recordEvent({ type: 'task_failed', taskId: task.id, error });
                    if (task.priority === 'high') {
                      jarvisNotifications.notify(`${jName}: Task #${task.id} failed`, error.slice(0, 200), 'important').catch(() => {});
                    }
                  },
                  updateStatus: () => updateStatusBar(),
                  storeInSpiral: spiralEngine ? async (content, type, tags) => {
                    try { await spiralEngine!.add(content, { type: type as any, tags }); } catch {}
                  } : undefined,
                  getIdentityName: () => jarvisIdentity.getIdentity().name,
                  getUserGoals: () => jarvisIdentity.getIdentity().userGoals,
                  getIdentityPrompt: () => jarvisIdentity.getIdentityPrompt(),
                  thinkingCallbacks: buildThinkingCallbacks(bgSession),
                });
              } catch (err) {
                if (!(err instanceof AgentAbortError)) bgSession.capture(`${jName} error: ${err}`);
              }
              sessionMgr.complete(bgSession.id, { text: `${jName} stopped`, steps: [], errors: bgSession.controller.isAborted ? ['Stopped'] : [], durationMs: bgSession.elapsed });
              jarvisDaemonSession = null;
              renderInfo(chalk.hex('#ff00ff')(`\u{1F916} ${jName} daemon stopped`));
            })();
          },
        },
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
      // If handleSlashCommand returns a prompt string (e.g. from /bugfix),
      // feed it through as if the user typed it — sends to agent loop.
      if (handled && handled !== 'exit' && handled !== 'drain') {
        renderInfo(chalk.hex('#00d4ff')('Bugfix mode: reviewing open bugs...'));
        // Re-enter processInput with the synthetic agent prompt
        await processInput(handled);
        return;
      }
      showPrompt();
      return;
    }

    // Clear the readline echo (prompt + typed text) — may span multiple wrapped
    // terminal lines for long inputs. Clear each wrapped line so nothing lingers.
    const promptVis = visibleLength(makePrompt());
    const cols = process.stdout.columns || 80;
    const wrappedLines = Math.max(1, Math.ceil((promptVis + input.length) / cols));
    process.stdout.write('\x1b[A\x1b[2K'.repeat(wrappedLines));
    renderUserMessage(input);

    // Track user message in session buffer
    sessionBuffer.addUserMessage(input);

    // Auto-detect bug reports from user messages
    const bugDetection = detectBugReport(input);
    if (bugDetection.isBug) {
      const newBug = bugJournal.create(bugDetection.description, {
        file: bugDetection.file,
        line: bugDetection.line,
        evidence: bugDetection.evidence,
      });
      renderInfo(chalk.hex('#ff4444')(`Bug #${newBug.id} tracked: `) + chalk.dim(newBug.description));
    }

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
    // Set activity display name: custom Jarvis name when daemon is running, else "HelixMind"
    activity.setDisplayName(
      jarvisDaemonSession && jarvisDaemonSession.status === 'running'
        ? jarvisIdentity.getIdentity().name
        : 'HelixMind',
    );
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
        // Activity started — readline stays active for type-ahead buffering.
        // Muting is handled by activity.setMuteCallbacks (mute during LLM stream,
        // unmute during tool execution so user can answer permission prompts).
        isAtPrompt = false;
      },
      { enabled: validationEnabled, verbose: validationVerbose, strict: validationStrict },
      bugJournal, browserController, visionProcessor, pushScreenshotToBrainFn,
      getJarvisContextForPrompt(),
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
          bugJournal, browserController, visionProcessor, pushScreenshotToBrainFn,
          getJarvisContextForPrompt(),
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

    // Clear any type-ahead preview at the prompt row
    if (chrome.isActive && activity.isAnimating) {
      chrome.writeAtPromptRow('');
    }

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

    // Paste detection: if a timer is already running, this is a continuation.
    // ALL lines (including empty ones) are part of the paste block.
    // This MUST come before the empty-line-flush check so blank lines in
    // pasted text don't prematurely split the buffer into multiple messages.
    if (pasteTimer) {
      pasteBuffer.push(line);
      clearTimeout(pasteTimer);
      // Show updated preview
      const count = pasteBuffer.length;
      process.stdout.write(`\x1b[2K\r  ${chalk.dim(`(${count} Zeilen eingefuegt — Enter zum Senden, Esc zum Verwerfen)`)}`);
      pasteTimer = setTimeout(() => {
        // Paste ended
        pasteTimer = null;
        if (agentRunning) {
          // Queue the entire paste as a single type-ahead entry
          const assembled = pasteBuffer.join('\n').trim();
          pasteBuffer = [];
          if (assembled) {
            typeAheadBuffer.push(assembled);
            const lineCount = assembled.split('\n').length;
            process.stdout.write(`\x1b[2K\r  ${theme.dim('\u23F3 Queued:')} ${chalk.cyan(`[${lineCount} Zeilen]`)} ${theme.dim(assembled.split('\n')[0].slice(0, 50) + (assembled.split('\n')[0].length > 50 ? '...' : ''))}\n`);
          }
          rl.prompt();
        } else {
          // Show final preview and wait for Enter
          const count = pasteBuffer.length;
          const preview = pasteBuffer[0].slice(0, 60);
          process.stdout.write(`\x1b[2K\r  ${chalk.cyan(`[${count} Zeilen]`)} ${chalk.dim(preview + (pasteBuffer[0].length > 60 ? '...' : ''))}\n`);
          process.stdout.write(`  ${chalk.dim('Enter = senden | Esc = verwerfen')}\n`);
          rl.prompt();
        }
      }, PASTE_THRESHOLD_MS);
      return;
    }

    // If paste buffer has content and user pressed Enter on empty line → send it
    // (pasteTimer is null here, meaning the paste has ended and we're waiting for confirmation)
    if (!trimmed && pasteBuffer.length > 0) {
      const assembled = pasteBuffer.join('\n').trim();
      pasteBuffer = [];
      process.stdout.write(`\x1b[2K\r`);
      if (agentRunning) {
        // Queue the entire paste as a single type-ahead entry
        if (assembled) {
          typeAheadBuffer.push(assembled);
          const lineCount = assembled.split('\n').length;
          process.stdout.write(`  ${theme.dim('\u23F3 Queued:')} ${chalk.cyan(`[${lineCount} Zeilen]`)} ${theme.dim(assembled.split('\n')[0].slice(0, 50))}\n`);
        }
        rl.prompt();
      } else {
        processInput(assembled);
      }
      return;
    }

    if (!trimmed) {
      isAtPrompt = true;
      rl.prompt();
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
        if (agentRunning) {
          // Single-line type-ahead while agent works
          typeAheadBuffer.push(singleInput);
          process.stdout.write(`  ${theme.dim('\u23F3 Queued:')} ${theme.dim(singleInput)}\n`);
          rl.prompt();
        } else {
          processInput(singleInput);
        }
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
      if (key?.name === 'escape' && pasteBuffer.length > 0) {
        pasteBuffer = [];
        if (pasteTimer) { clearTimeout(pasteTimer); pasteTimer = null; }
        process.stdout.write(`\x1b[2K\r  ${chalk.dim('Paste verworfen.')}\n`);
        showPrompt();
      }
    });
  }

  // Show user's type-ahead at the prompt row (N-3) during LLM streaming
  // (when readline echo is muted). During tool execution / permission prompts,
  // readline echo is active and the user sees input at the normal prompt row.
  process.stdin.on('keypress', () => {
    if (!agentRunning || !chrome.isActive || !activity.isAnimating) return;
    // Defer to let readline update rl.line first
    setImmediate(() => {
      if (!agentRunning || !chrome.isActive || !activity.isAnimating) return;
      const userInput = (rl as any).line as string || '';
      if (userInput) {
        const maxLen = Math.max(20, (process.stdout.columns || 80) - 8);
        const display = userInput.length > maxLen
          ? '\u2026' + userInput.slice(-(maxLen - 1))
          : userInput;
        const gt = chalk.hex('#00d4ff').bold('\u276F');
        chrome.writeAtPromptRow(`  ${gt} ${chalk.dim(display)}`);
      } else {
        chrome.writeAtPromptRow('');
      }
    });
  });

  rl.on('close', async () => {
    clearInterval(footerTimer);
    chrome.deactivate();
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
    // Close browser if open
    if (browserController?.isOpen()) {
      try { await browserController.close(); } catch { /* best effort */ }
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
  bugJournal?: BugJournal,
  browserController?: BrowserController,
  visionProcessor?: VisionProcessor,
  onBrowserScreenshot?: ((info: { url: string; title?: string; imageBase64?: string; analysis?: string }) => void) | null,
  jarvisContext?: string | null,
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
  const bugSummary = bugJournal?.getSummaryForPrompt() ?? null;
  const systemPrompt = assembleSystemPrompt(
    project.name !== 'unknown' ? project : null,
    spiralContext,
    sessionContext || undefined,
    { provider: provider.name, model: provider.model },
    bugSummary,
    jarvisContext,
  );

  // Auto-trim context using model-aware budget (15% headroom for output + safety)
  const systemTokens = estimateTokens([{ role: 'user', content: systemPrompt }]);
  const maxBudget = Math.floor(provider.maxContextLength * 0.85) - systemTokens;
  trimConversation(agentHistory, maxBudget, sessionBuffer);

  // Start the glowing activity indicator (reserves bottom row via scroll region)
  activity.start();
  // Notify caller so it can show the readline prompt for type-ahead
  onAgentStart?.();

  // Lazy-init vision processor when browser is available
  if (browserController && !visionProcessor) {
    visionProcessor = new VisionProcessor(provider);
  }

  try {
    const result = await runAgentLoop(input, agentHistory, {
      provider,
      systemPrompt,
      permissions,
      toolContext: {
        projectRoot: process.cwd(),
        undoStack,
        spiralEngine,
        bugJournal,
        browserController,
        visionProcessor,
        onBrowserScreenshot: onBrowserScreenshot ?? undefined,
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
      onThinkingText: (text) => {
        // Show intermediate LLM reasoning before tool calls
        activity.pauseAnimation();
        renderThinkingText(text);
        activity.resumeAnimation();
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
      sessionBuffer.addTopicFromResponse(result.text);
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
  onAutonomous?: (action: 'start' | 'stop' | 'security' | 'monitor', goal?: string) => Promise<void>,
  onValidation?: (action: string) => void,
  sessionManager?: SessionManager,
  onRegisterBrainHandlers?: () => Promise<void>,
  onSubPrompt?: (active: boolean) => void,
  bugJournal?: BugJournal,
  jarvisCtx?: {
    queue: JarvisQueue;
    getSession: () => import('../sessions/session.js').Session | null;
    setSession: (s: import('../sessions/session.js').Session | null) => void;
    isPaused: () => boolean;
    setPaused: (v: boolean) => void;
    startDaemon: () => void;
    identity: JarvisIdentityManager;
    getScope: () => 'project' | 'global';
    setScope: (scope: 'project' | 'global') => void;
  },
): Promise<string | void> {
  const parts = input.split(/\s+/);
  let cmd = parts[0].toLowerCase();

  // Allow custom Jarvis name as alias for /jarvis (e.g. /atlas → /jarvis)
  if (jarvisCtx && cmd.startsWith('/') && cmd !== '/jarvis') {
    const customName = jarvisCtx.identity.getIdentity().name.toLowerCase();
    if (cmd === `/${customName}`) {
      cmd = '/jarvis';
      parts[0] = '/jarvis';
    }
  }

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
          sessionManager, onRegisterBrainHandlers, onSubPrompt, bugJournal, jarvisCtx,
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
        try {
          await onBrainSwitch('project');
          renderInfo(chalk.cyan('\u{1F4C1} Switched to project-local brain (.helixmind/)'));
          try {
            const { pushScopeChange, isBrainServerRunning } = await import('../brain/generator.js');
            if (isBrainServerRunning()) pushScopeChange('project');
          } catch { /* optional */ }
        } catch {
          renderInfo(chalk.yellow('  Cannot use local brain here — using global'));
        }
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
          try {
            await onBrainSwitch('project');
            renderInfo(chalk.cyan('\u{1F4C1} Switched to project-local brain (.helixmind/)'));
            // Update browser if open
            try {
              const { pushScopeChange, isBrainServerRunning } = await import('../brain/generator.js');
              if (isBrainServerRunning()) pushScopeChange('project');
            } catch { /* optional */ }
          } catch {
            renderInfo(chalk.yellow('  Cannot use local brain here — using global'));
          }
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

    case '/bugs': {
      if (!bugJournal) {
        renderInfo('Bug journal not available.');
        break;
      }
      const statusFilter = parts[1]?.toLowerCase();
      const bugs = statusFilter && statusFilter !== 'all'
        ? bugJournal.getByStatus(statusFilter as any)
        : bugJournal.getAllBugs();

      if (bugs.length === 0) {
        renderInfo(statusFilter ? `No ${statusFilter} bugs.` : 'No bugs tracked yet.');
        break;
      }

      const statusIcons: Record<string, string> = {
        open: chalk.red('\u25CF'),
        investigating: chalk.yellow('\u25CF'),
        fixed: chalk.green('\u25CF'),
        verified: chalk.dim('\u25CF'),
      };

      process.stdout.write('\n');
      for (const bug of bugs) {
        const icon = statusIcons[bug.status] || '\u25CF';
        const loc = bug.file ? chalk.dim(` (${bug.file}${bug.line ? ':' + bug.line : ''})`) : '';
        process.stdout.write(`  ${icon} ${chalk.bold('#' + bug.id)} ${bug.description}${loc}\n`);
        if (bug.fixDescription) {
          process.stdout.write(chalk.dim(`     Fix: ${bug.fixDescription}\n`));
        }
      }
      process.stdout.write('\n');
      const statusLine = bugJournal.getStatusLine();
      if (statusLine) renderInfo(statusLine);
      break;
    }

    case '/bugfix': {
      if (!bugJournal) {
        renderInfo('Bug journal not available.');
        break;
      }
      const openBugs = bugJournal.getOpenBugs();
      if (openBugs.length === 0) {
        const fixed = bugJournal.getByStatus('fixed');
        if (fixed.length > 0) {
          renderInfo(`All bugs fixed! ${fixed.length} bug(s) awaiting verification.`);
          renderInfo(chalk.dim('The agent will verify fixes when you send a message.'));
        } else {
          renderInfo('No open bugs to fix.');
        }
        break;
      }

      // Build a synthetic prompt for the agent to review all open bugs
      const bugList = openBugs.map(b => {
        const loc = b.file ? ` in ${b.file}${b.line ? ':' + b.line : ''}` : '';
        return `- Bug #${b.id}: ${b.description}${loc}`;
      }).join('\n');

      const bugfixPrompt = `Review and fix the following open bugs. For each bug, investigate the root cause, apply a fix, and mark it as fixed using the bug_report tool:\n\n${bugList}\n\nAfter fixing all bugs, run relevant tests to verify the fixes work.`;

      // Return the prompt so the caller sends it to the agent
      return bugfixPrompt;
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

    case '/jarvis': {
      if (!jarvisCtx) { renderInfo('Jarvis not available.'); break; }
      const sub = parts[1]?.toLowerCase();
      const jq = jarvisCtx.queue;
      const jn = jarvisCtx.identity.getIdentity().name; // dynamic name

      if (!sub || sub === 'start') {
        const existing = jarvisCtx.getSession();
        if (existing && existing.status === 'running') {
          renderInfo(chalk.hex('#ff00ff')(`${jn} is already running.`));
          const sl = jq.getStatusLine();
          if (sl) renderInfo(sl);
          break;
        }
        // Onboarding: first run → interactive setup; returning → short greeting
        const identity = jarvisCtx.identity.getIdentity();
        if (!identity.customized) {
          const onboardResult = await runOnboarding(
            jarvisCtx.identity, rl,
            jarvisCtx.getScope(),
          );
          // Apply scope selection from onboarding
          if (onboardResult.scope && onboardResult.scope !== jarvisCtx.getScope()) {
            jarvisCtx.setScope(onboardResult.scope);
          }
          jarvisCtx.startDaemon();
          // Auto-create first task from user goal so Jarvis starts working immediately
          if (onboardResult.goalText) {
            const finalName = jarvisCtx.identity.getIdentity().name;
            const autoTask = jq.addTask(
              `Projekt analysieren und verstehen`,
              `Analysiere das aktuelle Projekt gruendlich. Das Ziel des Users ist: "${onboardResult.goalText}". ` +
              `Verschaffe dir einen Ueberblick ueber die Codebase, Architektur, Dependencies und wichtige Dateien. ` +
              `Stelle dich dem User kurz als ${finalName} vor und berichte was du gefunden hast.`,
            );
            renderInfo(chalk.hex('#ff00ff')(`  \u2714 Auto-Task #${autoTask.id}: ${autoTask.title}`));
          }
        } else {
          showReturningGreeting(identity);
          jarvisCtx.startDaemon();
        }

      } else if (sub === 'task') {
        const taskText = input.replace(/^\/jarvis\s+task\s*/i, '').trim();
        if (!taskText) { renderInfo(`Usage: /jarvis task "Do something"`); break; }
        let title = taskText;
        let description = '';
        const quoteMatch = taskText.match(/^["'](.+?)["']\s*(.*)/s);
        if (quoteMatch) {
          title = quoteMatch[1];
          description = quoteMatch[2] || title;
        } else if (taskText.includes('\u2014') || taskText.includes('--')) {
          const sep = taskText.includes('\u2014') ? '\u2014' : '--';
          const sepIdx = taskText.indexOf(sep);
          title = taskText.slice(0, sepIdx).trim();
          description = taskText.slice(sepIdx + sep.length).trim() || title;
        } else {
          description = title;
        }
        const task = jq.addTask(title, description);
        renderInfo(chalk.hex('#ff00ff')(`\u2714 Task #${task.id} added: ${task.title}`));

      } else if (sub === 'tasks') {
        const tasks = jq.getAllTasks();
        if (tasks.length === 0) { renderInfo(`No tasks in queue. Add with /jarvis task "..."`); break; }
        const statusIcons: Record<string, string> = {
          pending: chalk.yellow('\u25CB'), running: chalk.hex('#ff00ff')('\u25CF'),
          completed: chalk.green('\u2713'), failed: chalk.red('\u2717'), paused: chalk.dim('\u25CB'),
        };
        process.stdout.write('\n');
        for (const t of tasks) {
          const icon = statusIcons[t.status] || '\u25CB';
          const priColor = t.priority === 'high' ? '#ff3333' : t.priority === 'medium' ? '#ffaa00' : '#888888';
          process.stdout.write(`  ${icon} ${chalk.bold('#' + t.id)} ${chalk.hex(priColor)(`[${t.priority}]`)} ${t.title}\n`);
          if (t.result) process.stdout.write(chalk.dim(`     Result: ${t.result.slice(0, 80)}\n`));
          if (t.error) process.stdout.write(chalk.red(`     Error: ${t.error.slice(0, 80)}\n`));
        }
        process.stdout.write('\n');
        const sl = jq.getStatusLine();
        if (sl) renderInfo(sl);

      } else if (sub === 'status') {
        const taskId = parts[2] ? parseInt(parts[2], 10) : NaN;
        if (!isNaN(taskId)) {
          const task = jq.getAllTasks().find((t: any) => t.id === taskId);
          if (!task) { renderInfo(`Task #${taskId} not found.`); }
          else {
            process.stdout.write('\n');
            process.stdout.write(chalk.hex('#ff00ff').bold(`  Task #${task.id}: ${task.title}\n`));
            process.stdout.write(`  Status: ${task.status} | Priority: ${task.priority}\n`);
            process.stdout.write(`  Created: ${new Date(task.createdAt).toLocaleString()}\n`);
            if (task.startedAt) process.stdout.write(`  Started: ${new Date(task.startedAt).toLocaleString()}\n`);
            if (task.completedAt) process.stdout.write(`  Completed: ${new Date(task.completedAt).toLocaleString()}\n`);
            if (task.description !== task.title) process.stdout.write(chalk.dim(`  Description: ${task.description}\n`));
            if (task.result) process.stdout.write(chalk.green(`  Result: ${task.result}\n`));
            if (task.error) process.stdout.write(chalk.red(`  Error: ${task.error}\n`));
            process.stdout.write('\n');
          }
        } else {
          const status = jq.getStatus();
          process.stdout.write('\n');
          process.stdout.write(chalk.hex('#ff00ff').bold(`  \u{1F916} ${jn} Status\n`));
          process.stdout.write(`  Daemon: ${status.daemonState}`);
          if (status.currentTaskId) process.stdout.write(` (task #${status.currentTaskId})`);
          process.stdout.write('\n');
          process.stdout.write(`  Pending: ${status.pendingCount} | Completed: ${status.completedCount} | Failed: ${status.failedCount}\n`);
          if (status.uptimeMs > 0) process.stdout.write(`  Uptime: ${Math.floor(status.uptimeMs / 1000)}s\n`);
          process.stdout.write('\n');
        }

      } else if (sub === 'stop') {
        const s = jarvisCtx.getSession();
        if (!s) { renderInfo(`${jn} is not running.`); break; }
        s.abort();
        jarvisCtx.setSession(null);
        renderInfo(chalk.hex('#ff00ff')(`\u{1F916} ${jn} daemon stopped`));

      } else if (sub === 'pause') {
        if (!jarvisCtx.getSession() || jarvisCtx.isPaused()) {
          renderInfo(jarvisCtx.isPaused() ? `${jn} is already paused.` : `${jn} is not running.`);
          break;
        }
        jarvisCtx.setPaused(true);
        jq.setDaemonState('paused');
        renderInfo(chalk.hex('#ff00ff')(`\u23F8 ${jn} paused`));

      } else if (sub === 'resume') {
        if (!jarvisCtx.getSession() || !jarvisCtx.isPaused()) {
          renderInfo(!jarvisCtx.isPaused() ? `${jn} is not paused.` : `${jn} is not running.`);
          break;
        }
        jarvisCtx.setPaused(false);
        jq.setDaemonState('running');
        renderInfo(chalk.hex('#ff00ff')(`\u25B6 ${jn} resumed`));

      } else if (sub === 'clear') {
        const removed = jq.clearCompleted();
        renderInfo(`Cleared ${removed} completed task(s).`);

      } else if (sub === 'local') {
        if (jarvisCtx.getSession()?.status === 'running') {
          renderInfo(chalk.yellow(`Stop ${jn} first (/jarvis stop) before switching scope.`));
          break;
        }
        jarvisCtx.setScope('project');
        renderInfo(chalk.hex('#ff00ff')(`${jn} scope: local (.helixmind/jarvis/)`));

      } else if (sub === 'global') {
        if (jarvisCtx.getSession()?.status === 'running') {
          renderInfo(chalk.yellow(`Stop ${jn} first (/jarvis stop) before switching scope.`));
          break;
        }
        jarvisCtx.setScope('global');
        renderInfo(chalk.hex('#ff00ff')(`${jn} scope: global (~/.spiral-context/jarvis/)`));

      } else if (sub === 'name') {
        const newName = input.replace(/^\/jarvis\s+name\s*/i, '').trim();
        if (!newName) {
          renderInfo(`Current name: ${jn}`);
          renderInfo(chalk.dim('Usage: /jarvis name "NewName"'));
          break;
        }
        const cleaned = newName.replace(/^["']|["']$/g, '');
        jarvisCtx.identity.setName(cleaned);
        renderInfo(chalk.hex('#ff00ff')(`Name set: ${chalk.bold(cleaned)}`));

      } else {
        renderInfo(`Usage: /jarvis [start|task|tasks|status|stop|pause|resume|clear|local|global|name]`);
      }
      break;
    }

    case '/monitor': {
      if (!onAutonomous) break;
      const { MONITOR_MODES, MONITOR_WARNINGS } = await import('../agent/autonomous.js');

      // Interactive setup: show banner + mode selection
      rl.pause();
      process.stdout.write('\n');

      const docsItemIdx = MONITOR_MODES.length;
      const cancelItemIdx = MONITOR_MODES.length + 1;
      const monitorMenuItems: MenuItem[] = [
        ...MONITOR_MODES.map(m => ({ label: chalk.hex('#ff6600').bold(m.label), description: m.description })),
        { label: chalk.hex('#00d4ff')('\u{1F4D6} Docs'), description: 'Open security monitor docs in browser' },
        { label: chalk.dim('\u2715 Cancel'), description: 'Go back' },
      ];

      let modeIdx: number;
      // Loop so "Docs" re-shows the menu after opening the browser
      while (true) {
        modeIdx = await selectMenu(monitorMenuItems, {
          title: chalk.hex('#ff6600').bold('\u{1F6E1}\uFE0F MONITOR MODE'),
          cancelLabel: 'Cancel',
        });

        if (modeIdx === docsItemIdx) {
          const docsUrl = 'https://helixmind.dev/docs/security-monitor';
          const { exec } = await import('node:child_process');
          const { platform } = await import('node:os');
          const openCmd = platform() === 'win32' ? `start "" "${docsUrl}"`
            : platform() === 'darwin' ? `open "${docsUrl}"`
            : `xdg-open "${docsUrl}"`;
          exec(openCmd, () => {});
          renderInfo(chalk.dim(`  Opened ${docsUrl}`));
          continue; // re-show menu
        }
        break;
      }

      if (modeIdx < 0 || modeIdx >= MONITOR_MODES.length) {
        rl.resume();
        renderInfo('Monitor cancelled.');
        break;
      }

      const selectedMode = MONITOR_MODES[modeIdx].key;

      // Defensive/Active modes: show warning + confirm
      if (selectedMode !== 'passive') {
        const warnings = MONITOR_WARNINGS[selectedMode] || [];
        process.stdout.write('\n');
        process.stdout.write(chalk.yellow(`  \u26A0\uFE0F  ${selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)} mode will:\n`));
        for (const w of warnings) {
          process.stdout.write(chalk.dim(`  \u2022 ${w}\n`));
        }
        process.stdout.write('\n');

        const confirmIdx = await selectMenu(
          [
            { label: chalk.hex('#ff6600').bold('Yes, activate'), description: `Start ${selectedMode} monitor` },
            { label: 'No, go back', description: 'Cancel' },
          ],
          { title: chalk.yellow(`Activate ${selectedMode} monitor?`), cancelLabel: 'Cancel' },
        );

        if (confirmIdx !== 0) {
          rl.resume();
          renderInfo('Monitor cancelled.');
          break;
        }
      }

      rl.resume();
      await onAutonomous('monitor', selectedMode);
      break;
    }

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

    case '/connect': {
      // Reconnect brain server for web dashboard
      try {
        const { startLiveBrain, isBrainServerRunning, getBrainPort } = await import('../brain/generator.js');
        if (isBrainServerRunning()) {
          const port = getBrainPort();
          process.stdout.write(`  ${theme.success('\u{1F310} Already connected')} on port ${port}\n`);
        } else if (spiralEngine) {
          const { exportBrainData } = await import('../brain/exporter.js');
          exportBrainData(spiralEngine, 'HelixMind Project', currentBrainScope || 'project');
          const url = await startLiveBrain(spiralEngine, 'HelixMind Project', currentBrainScope || 'project');
          if (onRegisterBrainHandlers) await onRegisterBrainHandlers();
          process.stdout.write(`  ${theme.success('\u{1F310} Brain server started:')} ${url}\n`);
          process.stdout.write(`  ${theme.dim('Web dashboard can now connect.')}\n`);
        } else {
          renderError('No spiral engine available. Run /helix first.');
        }
      } catch (err) {
        renderError(`Failed to start brain server: ${err}`);
      }
      break;
    }

    default:
      renderError(`Unknown command: ${cmd}. Type /help for available commands.`);
  }
}
