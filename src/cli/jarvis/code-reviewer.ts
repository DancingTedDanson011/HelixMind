/**
 * Jarvis Code Reviewer — automatic code review on git commits.
 * Triggered by git_hook trigger → reviews diff → generates proposals.
 * Learns which code patterns the user prefers from approved proposals.
 */
import { execSync } from 'node:child_process';
import type { ProposalCategory, ProposalEvidence } from './types.js';

export interface CodeReviewResult {
  findings: CodeFinding[];
  summary: string;
}

export interface CodeFinding {
  type: 'bug_risk' | 'style' | 'performance' | 'security' | 'complexity' | 'test_missing';
  file: string;
  line?: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
}

/**
 * Get git diff for review (last commit or staged changes).
 */
export function getReviewDiff(projectRoot: string, target: 'HEAD' | 'staged' = 'HEAD'): string {
  try {
    const cmd = target === 'staged' ? 'git diff --cached' : 'git diff HEAD~1 HEAD';
    return execSync(cmd, {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Build a code review prompt for LLM analysis.
 * Returns prompt text — the thinking loop will call sendMessage with it.
 */
export function buildReviewPrompt(diff: string, learnedPatterns?: string[]): string {
  const patternContext = learnedPatterns && learnedPatterns.length > 0
    ? `\nUser preferences (from past approvals):\n${learnedPatterns.map(p => `- ${p}`).join('\n')}\n`
    : '';

  return `Review this git diff for issues:

${diff.slice(0, 8000)}${diff.length > 8000 ? '\n... (truncated)' : ''}
${patternContext}
For each issue found, respond with one line in this format:
FINDING: <type> | <severity> | <file> | <description> | <suggestion>

Valid types: bug_risk, style, performance, security, complexity, test_missing
Valid severities: low, medium, high

If no issues found, respond: NO_ISSUES
Be selective — only report genuine issues, not style nitpicks.`;
}

/**
 * Parse review response into structured findings.
 */
export function parseReviewResponse(response: string): CodeReviewResult {
  const findings: CodeFinding[] = [];

  for (const line of response.split('\n')) {
    const match = line.match(/^FINDING:\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)(?:\s*\|\s*(.+))?$/);
    if (!match) continue;

    const [, type, severity, file, description, suggestion] = match;
    findings.push({
      type: type as CodeFinding['type'],
      file: file.trim(),
      description: description.trim(),
      severity: severity as 'low' | 'medium' | 'high',
      suggestion: suggestion?.trim(),
    });
  }

  const summary = findings.length === 0
    ? 'No issues found'
    : `${findings.length} issues: ${findings.filter(f => f.severity === 'high').length} high, ${findings.filter(f => f.severity === 'medium').length} medium, ${findings.filter(f => f.severity === 'low').length} low`;

  return { findings, summary };
}

/**
 * Convert findings to proposal evidence.
 */
export function findingsToEvidence(findings: CodeFinding[]): ProposalEvidence[] {
  return findings.map(f => ({
    type: 'code_snippet' as const,
    content: `[${f.severity}] ${f.file}: ${f.description}${f.suggestion ? ` — Fix: ${f.suggestion}` : ''}`,
    timestamp: Date.now(),
  }));
}

/**
 * Determine proposal category from findings.
 */
export function findingsToCategory(findings: CodeFinding[]): ProposalCategory {
  const types = new Set(findings.map(f => f.type));
  if (types.has('security')) return 'security';
  if (types.has('bug_risk')) return 'bugfix';
  if (types.has('performance')) return 'performance';
  if (types.has('test_missing')) return 'test';
  return 'review';
}
