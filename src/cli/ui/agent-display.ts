/**
 * Agent Display — colored @name rendering utilities.
 * Used across tool-output, activity indicator, tab-view, and statusbar.
 */
import chalk from 'chalk';
import type { AgentIdentity } from '../agent/plan-types.js';
import { AGENT_IDENTITIES, resolveAgentIdentity } from '../agent/plan-types.js';

/**
 * Render a colored agent tag like "@main" or "@jarvis".
 * Returns an ANSI-styled string.
 */
export function renderAgentTag(identity: AgentIdentity): string {
  return chalk.hex(identity.color).bold(identity.name);
}

/**
 * Render a short agent prefix for tool block headers.
 * Example: "@main " in cyan, "@jarvis " in purple.
 */
export function renderAgentPrefix(identity: AgentIdentity): string {
  return chalk.hex(identity.color).bold(identity.name) + ' ';
}

/**
 * Render a colored display name (non-@ version) for activity indicators.
 * Example: "HelixMind" in cyan, "JARVIS" in purple.
 */
export function renderAgentDisplayName(identity: AgentIdentity): string {
  return chalk.hex(identity.color).bold(identity.displayName);
}

/**
 * Get AgentIdentity for a session name.
 * Falls back to the main identity if no match.
 */
export function getAgentIdentity(sessionName: string): AgentIdentity {
  return resolveAgentIdentity(sessionName) ?? AGENT_IDENTITIES.main;
}

export { AGENT_IDENTITIES, resolveAgentIdentity };
