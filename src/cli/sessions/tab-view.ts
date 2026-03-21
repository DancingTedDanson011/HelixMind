/**
 * Tab bar renderer for the session manager.
 * Draws terminal-style tabs showing all active sessions.
 */
import chalk from 'chalk';
import type { Session } from './session.js';
import { getAgentIdentity, renderAgentTag } from '../ui/agent-display.js';

/**
 * Render a tab bar showing all sessions.
 * Active tab is highlighted, background tabs show status indicators.
 *
 * When maxWidth is provided and tabs don't fit, switches to a collapsed
 * view showing the active tab + a summary counter (e.g. "+3 ⟳").
 *
 * Example full:      ┌─ 💬 Chat ─┐  🔒 Security ⟳  🔄 Auto ✓
 * Example collapsed: ┌─ 💬 Chat ─┐  +3 ⟳
 */
export function renderTabBar(sessions: Session[], activeId: string, maxWidth?: number): string {
  if (sessions.length <= 1) return '';

  const parts: string[] = [];

  for (const session of sessions) {
    const isActive = session.id === activeId;
    const statusIcon = getStatusIcon(session.status);
    const identity = getAgentIdentity(session.name);
    const label = `${session.icon} ${identity.name}`;

    if (isActive) {
      // Active tab — highlighted with box, colored by agent identity
      const color = chalk.hex(identity.color);
      parts.push(
        color('\u250C\u2500 ') +
        color.bold(label) +
        color(' \u2500\u2510'),
      );
    } else {
      // Background tab — colored by status with agent @name
      const statusColor = session.status === 'running' ? chalk.yellow
        : session.status === 'done' ? chalk.green
        : session.status === 'error' ? chalk.red
        : chalk.dim;

      parts.push(
        chalk.dim(' ') +
        statusColor(label) +
        ' ' +
        statusColor(statusIcon),
      );
    }
  }

  const fullBar = parts.join(chalk.dim('  '));

  // If no width constraint or fits → show full bar
  if (!maxWidth || stripAnsi(fullBar).length <= maxWidth) {
    return fullBar;
  }

  // Collapsed view: active tab + summary of background sessions
  const bgSessions = sessions.filter(s => s.id !== activeId);
  const running = bgSessions.filter(s => s.status === 'running').length;
  const done = bgSessions.filter(s => s.status === 'done').length;
  const errored = bgSessions.filter(s => s.status === 'error').length;

  // Build active tab part
  const activeSession = sessions.find(s => s.id === activeId);
  let activeTab = '';
  if (activeSession) {
    const identity = getAgentIdentity(activeSession.name);
    const color = chalk.hex(identity.color);
    activeTab = color('\u250C\u2500 ') + color.bold(`${activeSession.icon} ${identity.name}`) + color(' \u2500\u2510');
  }

  // Build compact summary: +N ⟳ ✓ ✗
  const counts: string[] = [];
  if (running > 0) counts.push(chalk.yellow(`${running}\u21BB`));
  if (done > 0) counts.push(chalk.green(`${done}\u2713`));
  if (errored > 0) counts.push(chalk.red(`${errored}\u2717`));

  const summary = chalk.dim('+') + counts.join(chalk.dim('/'));

  return activeTab + chalk.dim('  ') + summary;
}

/** Strip ANSI escape codes to measure visible width */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\].*?\x07/g, '');
}

/**
 * Render a compact notification when a background session completes.
 */
export function renderSessionNotification(session: Session): string {
  const statusIcon = session.status === 'done' ? '\u2705' : '\u274C';
  const elapsed = session.elapsed > 0
    ? chalk.dim(` (${formatDuration(session.elapsed)})`)
    : '';

  const border = chalk.dim('\u2500'.repeat(40));
  const lines = [
    '',
    border,
    `  ${statusIcon} ${chalk.bold(session.icon + ' ' + session.name)} finished${elapsed}`,
  ];

  if (session.result) {
    if (session.result.errors.length > 0) {
      lines.push(`  ${chalk.red('\u26A0')} ${session.result.errors.length} error(s)`);
    }
    if (session.result.steps.length > 0) {
      lines.push(`  ${chalk.dim('\u{1F527}')} ${session.result.steps.length} steps completed`);
    }
    // Show first 2 lines of result text
    const preview = session.result.text.split('\n').filter(l => l.trim()).slice(0, 2);
    if (preview.length > 0) {
      lines.push(`  ${chalk.dim(preview[0].slice(0, 70))}`);
      if (preview.length > 1) {
        lines.push(`  ${chalk.dim(preview[1].slice(0, 70))}`);
      }
    }
  }

  lines.push(`  ${chalk.dim('Use /sessions to view details')}`);
  lines.push(border);
  lines.push('');

  return lines.join('\n');
}

/**
 * Render a detailed session list for /sessions command.
 */
export function renderSessionList(sessions: Session[], activeId: string): string {
  const lines: string[] = [
    '',
    chalk.hex('#00d4ff').bold('  Sessions'),
    chalk.dim('  ' + '\u2500'.repeat(45)),
  ];

  for (const session of sessions) {
    const isActive = session.id === activeId;
    const marker = isActive ? chalk.hex('#00d4ff')('\u25B6') : ' ';
    const statusIcon = getStatusIcon(session.status);
    const statusColor = getStatusColor(session.status);
    const elapsed = session.elapsed > 0 ? chalk.dim(` ${formatDuration(session.elapsed)}`) : '';
    const id = chalk.dim(`[${session.id}]`);

    lines.push(`  ${marker} ${statusColor(session.icon + ' ' + session.name)} ${statusIcon}${elapsed} ${id}`);

    // Show result summary for completed sessions
    if (session.result) {
      const steps = session.result.steps.length;
      const errors = session.result.errors.length;
      const summary = errors > 0
        ? chalk.red(`    ${errors} error(s), ${steps} steps`)
        : chalk.green(`    ${steps} steps completed`);
      lines.push(summary);
    }
  }

  lines.push('');
  lines.push(chalk.dim('  Ctrl+PgUp/PgDn = switch tabs | /session close <id> = close'));
  lines.push('');

  return lines.join('\n');
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'running': return '\u21BB'; // ↻
    case 'done': return '\u2713';    // ✓
    case 'error': return '\u2717';   // ✗
    case 'paused': return '\u23F8';  // ⏸
    default: return '\u23F9';         // ⏹
  }
}

function getStatusColor(status: string): typeof chalk {
  switch (status) {
    case 'running': return chalk.yellow as any;
    case 'done': return chalk.green as any;
    case 'error': return chalk.red as any;
    case 'paused': return chalk.yellow as any;
    default: return chalk.dim as any;
  }
}

function formatDuration(ms: number): string {
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${mins}m${rem}s` : `${mins}m`;
}
