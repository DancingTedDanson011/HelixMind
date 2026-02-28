/**
 * Monitor System — Continuous watch loop with adaptive intervals.
 */
import { randomUUID } from 'node:crypto';
import chalk from 'chalk';
import type {
  MonitorMode,
  MonitorBaseline,
  MonitorState,
  MonitorCallbacks,
  ThreatEvent,
  ThreatSeverity,
  ThreatCategory,
} from './types.js';
import { watchPrompt, analyzeThreatPrompt } from './prompts.js';
import { diffBaseline } from './baseline.js';
import { quickScan, mediumScan } from './scanner.js';
import { pushThreatEvent, pushDefenseEvent, requestApproval } from './alerter.js';
import { executeDefense } from './responder.js';

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

const QUICK_CHECK_INTERVAL = 60_000;    // 60 seconds
const MEDIUM_CHECK_INTERVAL = 300_000;  // 5 minutes
const FULL_CHECK_INTERVAL = 1_800_000;  // 30 minutes

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let monitorState: MonitorState | null = null;

export function getMonitorState(): MonitorState | null {
  return monitorState;
}

// ---------------------------------------------------------------------------
// Main watch loop
// ---------------------------------------------------------------------------

export async function runMonitorLoop(
  callbacks: MonitorCallbacks,
  mode: MonitorMode,
  baseline: MonitorBaseline,
): Promise<void> {
  const startTime = Date.now();

  monitorState = {
    mode,
    uptime: 0,
    threats: [],
    defenses: [],
    baseline,
    lastScan: Date.now(),
  };

  let lastQuickCheck = Date.now();
  let lastMediumCheck = Date.now();
  let lastFullCheck = Date.now();

  const d = chalk.dim;
  const shield = mode === 'active' ? '\u2694\uFE0F' : mode === 'defensive' ? '\u{1F6E1}\uFE0F' : '\u{1F50D}';

  process.stdout.write('\n');
  process.stdout.write(d(`  ${shield} Monitor loop started (${mode} mode)\n`));
  process.stdout.write(d('  Watching for security anomalies...\n\n'));

  while (!callbacks.isAborted()) {
    const now = Date.now();
    monitorState.uptime = now - startTime;

    // --- Quick check (every 60s) ---
    if (now - lastQuickCheck >= QUICK_CHECK_INTERVAL) {
      lastQuickCheck = now;

      try {
        const result = await quickScan(callbacks);
        if (callbacks.isAborted()) break;

        const threats = parseThreats(result);
        for (const threat of threats) {
          await handleThreat(threat, mode, callbacks);
        }

        monitorState.lastScan = Date.now();
        callbacks.onStatusUpdate(monitorState);
      } catch (err) {
        if (callbacks.isAborted()) break;
        process.stdout.write(d(`  \u26A0 Quick check error: ${err}\n`));
      }
    }

    // --- Medium check (every 5min) ---
    if (now - lastMediumCheck >= MEDIUM_CHECK_INTERVAL) {
      lastMediumCheck = now;

      try {
        const result = await mediumScan(callbacks);
        if (callbacks.isAborted()) break;

        const threats = parseThreats(result);
        for (const threat of threats) {
          await handleThreat(threat, mode, callbacks);
        }

        monitorState.lastScan = Date.now();
        callbacks.onStatusUpdate(monitorState);
      } catch (err) {
        if (callbacks.isAborted()) break;
        process.stdout.write(d(`  \u26A0 Medium check error: ${err}\n`));
      }
    }

    // --- Full check (every 30min) ---
    if (now - lastFullCheck >= FULL_CHECK_INTERVAL) {
      lastFullCheck = now;

      try {
        const fullResult = await callbacks.sendMessage(watchPrompt(baseline, mode));
        if (callbacks.isAborted()) break;

        const threats = parseThreats(fullResult);
        for (const threat of threats) {
          await handleThreat(threat, mode, callbacks);
        }

        monitorState.lastScan = Date.now();
        callbacks.onStatusUpdate(monitorState);
      } catch (err) {
        if (callbacks.isAborted()) break;
        process.stdout.write(d(`  \u26A0 Full check error: ${err}\n`));
      }
    }

    // Sleep between checks (5 seconds)
    await sleep(5_000);
  }

  monitorState = null;
  process.stdout.write(d('\n  Monitor loop stopped.\n'));
}

// ---------------------------------------------------------------------------
// Threat handling
// ---------------------------------------------------------------------------

async function handleThreat(
  threat: ThreatEvent,
  mode: MonitorMode,
  callbacks: MonitorCallbacks,
): Promise<void> {
  // Add to state
  if (monitorState) {
    monitorState.threats.push(threat);
  }

  // Notify via all channels
  callbacks.onThreat(threat);
  pushThreatEvent(threat);

  const severityColor = {
    critical: chalk.red.bold,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.dim,
    info: chalk.dim,
  }[threat.severity];

  process.stdout.write(`\n  ${severityColor(`\u26A0 THREAT [${threat.severity.toUpperCase()}]`)} ${threat.title}\n`);
  process.stdout.write(chalk.dim(`    ${threat.details}\n`));
  process.stdout.write(chalk.dim(`    Source: ${threat.source}\n\n`));

  // In passive mode, only alert — no response
  if (mode === 'passive') return;

  // Analyze threat and decide response
  try {
    const analysisResult = await callbacks.sendMessage(analyzeThreatPrompt(threat, mode));
    const response = parseResponse(analysisResult);

    if (response) {
      if (threat.severity === 'critical') {
        // CRITICAL + defensive/active: auto-execute
        const record = await executeDefense(response.action, response.target, callbacks.sendMessage);
        if (monitorState) monitorState.defenses.push(record);
        callbacks.onDefense(record);
        pushDefenseEvent(record);
        process.stdout.write(chalk.blue(`  \u{1F6E1}\uFE0F Auto-defense: ${response.action} → ${response.target}\n`));
      } else if (threat.severity === 'high') {
        // HIGH + defensive/active: request approval from web
        requestApproval(response.action, response.reason, threat.severity);
        process.stdout.write(chalk.yellow(`  \u23F3 Awaiting approval: ${response.action} → ${response.target}\n`));
      }
    }
  } catch {
    // Analysis failed — continue monitoring
  }
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseThreats(text: string): ThreatEvent[] {
  const threats: ThreatEvent[] = [];

  if (text.includes('ALL_CLEAR')) return threats;

  // Find all THREAT: {...} blocks
  const threatRegex = /THREAT:\s*(\{[\s\S]*?\})/g;
  let match;

  while ((match = threatRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      threats.push({
        id: randomUUID().slice(0, 8),
        severity: (parsed.severity || 'info') as ThreatSeverity,
        category: (parsed.category || 'anomaly') as ThreatCategory,
        title: parsed.title || 'Unknown threat',
        details: parsed.details || '',
        source: parsed.source || 'unknown',
        timestamp: Date.now(),
        relatedEvents: [],
      });
    } catch {
      // Skip unparseable threat
    }
  }

  return threats;
}

function parseResponse(text: string): { action: string; target: string; reason: string } | null {
  const responseMatch = text.match(/RESPONSE:\s*(\{[\s\S]*?\})/);
  if (!responseMatch) return null;

  try {
    const parsed = JSON.parse(responseMatch[1]);
    return {
      action: parsed.action || '',
      target: parsed.target || '',
      reason: parsed.reason || '',
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
