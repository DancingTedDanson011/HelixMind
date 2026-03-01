/**
 * Git Intelligence — smart git workflow assistant for Jarvis.
 * Branch strategy detection, merge conflict prediction, commit quality,
 * stale branch detection, PR draft generation.
 */
import { execSync } from 'node:child_process';
import type { ProposalEvidence } from './types.js';

export interface GitInsight {
  type: 'stale_branch' | 'merge_risk' | 'commit_quality' | 'branch_strategy' | 'pr_draft';
  description: string;
  severity: 'low' | 'medium' | 'high';
  details?: string;
  suggestion?: string;
}

/**
 * Detect stale branches (not merged, no commits in 2+ weeks).
 */
export function detectStaleBranches(projectRoot: string): GitInsight[] {
  const insights: GitInsight[] = [];

  try {
    const raw = execSync('git branch --no-merged --format="%(refname:short) %(committerdate:unix)"', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!raw) return insights;

    const twoWeeksAgo = Date.now() / 1000 - 14 * 24 * 60 * 60;
    const staleBranches: string[] = [];

    for (const line of raw.split('\n')) {
      const parts = line.trim().split(' ');
      if (parts.length < 2) continue;
      const [branch, timestampStr] = parts;
      const timestamp = parseInt(timestampStr, 10);

      if (branch === 'main' || branch === 'master' || branch === 'develop') continue;

      if (timestamp < twoWeeksAgo) {
        staleBranches.push(branch);
      }
    }

    if (staleBranches.length > 0) {
      insights.push({
        type: 'stale_branch',
        description: `${staleBranches.length} stale branch(es) with no activity for 2+ weeks`,
        severity: 'low',
        details: staleBranches.slice(0, 10).join(', '),
        suggestion: 'Consider merging or deleting these branches',
      });
    }
  } catch { /* git command failed */ }

  return insights;
}

/**
 * Predict merge conflicts by analyzing diverging branches.
 */
export function predictMergeConflicts(projectRoot: string): GitInsight[] {
  const insights: GitInsight[] = [];

  try {
    // Get current branch
    const currentBranch = execSync('git branch --show-current', {
      cwd: projectRoot, encoding: 'utf-8', timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!currentBranch || currentBranch === 'main' || currentBranch === 'master') return insights;

    // Find base branch (main or master)
    const baseBranch = branchExists(projectRoot, 'main') ? 'main' : 'master';

    // Check divergence
    const behindAhead = execSync(`git rev-list --left-right --count ${baseBranch}...${currentBranch}`, {
      cwd: projectRoot, encoding: 'utf-8', timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const [behindStr, aheadStr] = behindAhead.split(/\s+/);
    const behind = parseInt(behindStr, 10);
    const ahead = parseInt(aheadStr, 10);

    if (behind > 10) {
      // Check for conflicting files
      const baseFiles = execSync(`git diff --name-only ${baseBranch}...${currentBranch}`, {
        cwd: projectRoot, encoding: 'utf-8', timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      const mainChanges = execSync(`git diff --name-only ${currentBranch}...${baseBranch}`, {
        cwd: projectRoot, encoding: 'utf-8', timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      const branchFiles = new Set(baseFiles.split('\n').filter(Boolean));
      const mainFiles = new Set(mainChanges.split('\n').filter(Boolean));
      const conflictingFiles = [...branchFiles].filter(f => mainFiles.has(f));

      if (conflictingFiles.length > 0) {
        insights.push({
          type: 'merge_risk',
          description: `Branch is ${behind} commits behind ${baseBranch} with ${conflictingFiles.length} potentially conflicting file(s)`,
          severity: conflictingFiles.length > 5 ? 'high' : 'medium',
          details: conflictingFiles.slice(0, 10).join(', '),
          suggestion: `Rebase on ${baseBranch} soon to avoid complex merge conflicts`,
        });
      }
    } else if (behind > 5) {
      insights.push({
        type: 'merge_risk',
        description: `Branch is ${behind} commits behind ${baseBranch}`,
        severity: 'low',
        suggestion: `Consider rebasing on ${baseBranch}`,
      });
    }
  } catch { /* git commands failed */ }

  return insights;
}

/**
 * Analyze recent commit message quality.
 */
export function analyzeCommitQuality(projectRoot: string, count = 5): GitInsight[] {
  const insights: GitInsight[] = [];

  try {
    const raw = execSync(`git log --oneline -${count} --format="%s"`, {
      cwd: projectRoot, encoding: 'utf-8', timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!raw) return insights;

    const messages = raw.split('\n');
    const poorMessages: string[] = [];

    for (const msg of messages) {
      if (msg.length < 10 || msg.length > 100) {
        poorMessages.push(msg);
        continue;
      }
      if (/^(fix|update|change|stuff|wip|tmp|test)$/i.test(msg)) {
        poorMessages.push(msg);
        continue;
      }
      if (!/^[a-z]/.test(msg) && !/^[A-Z][a-z]/.test(msg) && !msg.startsWith('Merge')) {
        poorMessages.push(msg);
      }
    }

    if (poorMessages.length > messages.length / 2) {
      insights.push({
        type: 'commit_quality',
        description: `${poorMessages.length}/${messages.length} recent commits have poor messages`,
        severity: 'low',
        details: poorMessages.slice(0, 3).join(' | '),
        suggestion: 'Use conventional commits: type(scope): description',
      });
    }
  } catch { /* git log failed */ }

  return insights;
}

/**
 * Generate PR draft from commit history on current branch.
 */
export function generatePRDraft(projectRoot: string): { title: string; body: string } | null {
  try {
    const currentBranch = execSync('git branch --show-current', {
      cwd: projectRoot, encoding: 'utf-8', timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!currentBranch || currentBranch === 'main' || currentBranch === 'master') return null;

    const baseBranch = branchExists(projectRoot, 'main') ? 'main' : 'master';

    const commits = execSync(`git log ${baseBranch}..${currentBranch} --oneline --format="%s"`, {
      cwd: projectRoot, encoding: 'utf-8', timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!commits) return null;

    const commitList = commits.split('\n');

    // Derive title from branch name or first commit
    const title = currentBranch
      .replace(/^(feat|fix|chore|refactor|docs)\//, '')
      .replace(/[-_]/g, ' ')
      .replace(/^\w/, c => c.toUpperCase());

    const body = [
      '## Summary',
      '',
      `Changes from ${commitList.length} commit(s) on \`${currentBranch}\`:`,
      '',
      ...commitList.map(c => `- ${c}`),
      '',
      '## Test Plan',
      '',
      '- [ ] Verify build passes',
      '- [ ] Run test suite',
      '- [ ] Manual verification',
    ].join('\n');

    return { title, body };
  } catch {
    return null;
  }
}

/**
 * Run full git intelligence analysis.
 */
export function runGitAnalysis(projectRoot: string): GitInsight[] {
  return [
    ...detectStaleBranches(projectRoot),
    ...predictMergeConflicts(projectRoot),
    ...analyzeCommitQuality(projectRoot),
  ];
}

/**
 * Convert git insights to proposal evidence.
 */
export function insightsToEvidence(insights: GitInsight[]): ProposalEvidence[] {
  return insights.map(i => ({
    type: 'observation' as const,
    content: `[${i.severity}] ${i.type}: ${i.description}${i.suggestion ? ` — ${i.suggestion}` : ''}`,
    timestamp: Date.now(),
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────

function branchExists(projectRoot: string, branch: string): boolean {
  try {
    execSync(`git rev-parse --verify ${branch}`, {
      cwd: projectRoot, encoding: 'utf-8', timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
