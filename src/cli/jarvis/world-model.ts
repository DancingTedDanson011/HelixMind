/**
 * World Model — Jarvis' understanding of the project, user, and environment.
 * Captures project state, detects changes, tracks user preferences.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ProjectModel, ProjectDelta, UserModel, WorldModel,
  ProposalCategory,
} from './types.js';

const DEFAULT_USER: UserModel = {
  preferredCategories: {} as Record<ProposalCategory, number>,
  activeHours: [],
  communicationStyle: 'concise',
  lastActiveAt: Date.now(),
};

export class WorldModelManager {
  private projectRoot: string;
  private lastProjectState: ProjectModel | null = null;
  private userModel: UserModel;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.userModel = { ...DEFAULT_USER, preferredCategories: {} as Record<ProposalCategory, number> };
  }

  /**
   * Capture current project state (git, bugs, tests, etc.).
   * Designed to be fast — no LLM calls, only shell commands.
   */
  async captureProjectState(): Promise<ProjectModel> {
    const gitBranch = this.runGitCommand('rev-parse --abbrev-ref HEAD') || 'unknown';
    const gitStatusRaw = this.runGitCommand('status --porcelain');

    let modified = 0, untracked = 0, staged = 0;
    if (gitStatusRaw) {
      for (const line of gitStatusRaw.split('\n')) {
        if (!line.trim()) continue;
        const x = line[0], y = line[1];
        if (x === '?' && y === '?') untracked++;
        else if (x !== ' ' && x !== '?') staged++;
        if (y !== ' ' && y !== '?') modified++;
      }
    }

    // Count open bugs from bug journal
    let openBugs = 0;
    try {
      const bugsPath = join(this.projectRoot, '.helixmind', 'bugs.json');
      if (existsSync(bugsPath)) {
        const data = JSON.parse(readFileSync(bugsPath, 'utf-8'));
        openBugs = (data.bugs || []).filter(
          (b: { status: string }) => b.status === 'open' || b.status === 'investigating'
        ).length;
      }
    } catch { /* non-critical */ }

    // Get project name from package.json
    let name = 'unknown';
    try {
      const pkgPath = join(this.projectRoot, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        name = pkg.name || 'unknown';
      }
    } catch { /* non-critical */ }

    const health = this.calculateHealth(modified, untracked, staged, openBugs);

    const state: ProjectModel = {
      name,
      path: this.projectRoot,
      gitBranch,
      gitStatus: { modified, untracked, staged },
      openBugs,
      testStatus: null,  // Only populated during medium/deep checks
      health,
      lastScannedAt: Date.now(),
    };

    this.lastProjectState = state;
    return state;
  }

  /**
   * Detect changes since last scan.
   */
  detectProjectChanges(): ProjectDelta {
    const delta: ProjectDelta = {
      filesChanged: [],
      newCommits: 0,
      bugsChanged: false,
      testsChanged: false,
      depsChanged: false,
      branchChanged: false,
    };

    if (!this.lastProjectState) return delta;

    // Detect file changes via git
    const diffOutput = this.runGitCommand('diff --name-only');
    if (diffOutput) {
      delta.filesChanged = diffOutput.split('\n').filter(Boolean);
    }

    // Detect new commits since last scan
    const lastScan = this.lastProjectState.lastScannedAt;
    const logOutput = this.runGitCommand(`log --oneline --since="${new Date(lastScan).toISOString()}"`);
    if (logOutput) {
      delta.newCommits = logOutput.split('\n').filter(Boolean).length;
    }

    // Check if branch changed
    const currentBranch = this.runGitCommand('rev-parse --abbrev-ref HEAD') || 'unknown';
    delta.branchChanged = currentBranch !== this.lastProjectState.gitBranch;

    // Check if deps changed
    delta.depsChanged = delta.filesChanged.some(f =>
      f === 'package.json' || f === 'package-lock.json' || f === 'yarn.lock' || f === 'pnpm-lock.yaml'
    );

    return delta;
  }

  /**
   * Update user model based on events.
   */
  updateUserModel(event: { type: string; category?: ProposalCategory; approved?: boolean }): void {
    this.userModel.lastActiveAt = Date.now();

    // Track active hours
    const hour = new Date().getHours();
    if (!this.userModel.activeHours.includes(hour)) {
      this.userModel.activeHours.push(hour);
      this.userModel.activeHours.sort((a, b) => a - b);
    }

    // Track category preferences based on approval/denial
    if (event.category && event.approved !== undefined) {
      const current = this.userModel.preferredCategories[event.category] || 0.5;
      if (event.approved) {
        this.userModel.preferredCategories[event.category] = Math.min(1, current + 0.1);
      } else {
        this.userModel.preferredCategories[event.category] = Math.max(0, current - 0.15);
      }
    }
  }

  /**
   * Build world model prompt for deep thinking.
   */
  getWorldModelPrompt(): string {
    const state = this.lastProjectState;
    if (!state) return '';

    const lines: string[] = ['## World Model'];

    lines.push(`\nProject: ${state.name} (${state.path})`);
    lines.push(`Branch: ${state.gitBranch}`);
    lines.push(`Git: ${state.gitStatus.modified} modified, ${state.gitStatus.untracked} untracked, ${state.gitStatus.staged} staged`);
    lines.push(`Open bugs: ${state.openBugs}`);
    lines.push(`Health: ${state.health}/100`);

    if (state.testStatus) {
      lines.push(`Tests: ${state.testStatus.passing}/${state.testStatus.total} passing`);
    }

    // User preferences
    const topCategories = Object.entries(this.userModel.preferredCategories)
      .filter(([, rate]) => rate > 0.6)
      .map(([cat]) => cat);
    const avoidCategories = Object.entries(this.userModel.preferredCategories)
      .filter(([, rate]) => rate < 0.3)
      .map(([cat]) => cat);

    if (topCategories.length > 0) {
      lines.push(`\nUser prefers proposals about: ${topCategories.join(', ')}`);
    }
    if (avoidCategories.length > 0) {
      lines.push(`User dislikes proposals about: ${avoidCategories.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Calculate project health score (0-100).
   */
  calculateProjectHealth(
    modified?: number,
    untracked?: number,
    staged?: number,
    openBugs?: number,
  ): number {
    let health = 100;

    const m = modified ?? this.lastProjectState?.gitStatus.modified ?? 0;
    const u = untracked ?? this.lastProjectState?.gitStatus.untracked ?? 0;
    const s = staged ?? this.lastProjectState?.gitStatus.staged ?? 0;
    const bugs = openBugs ?? this.lastProjectState?.openBugs ?? 0;

    // Uncommitted changes reduce health
    health -= Math.min(20, m * 2);
    health -= Math.min(10, u * 1);
    health -= Math.min(5, s * 1);

    // Open bugs reduce health
    health -= Math.min(30, bugs * 5);

    return Math.max(0, Math.min(100, health));
  }

  /**
   * Get the last captured project state.
   */
  getLastState(): ProjectModel | null {
    return this.lastProjectState;
  }

  /**
   * Get the user model.
   */
  getUserModel(): UserModel {
    return { ...this.userModel };
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private runGitCommand(args: string): string {
    try {
      return execSync(`git ${args}`, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch {
      return '';
    }
  }

  private calculateHealth(
    modified: number,
    untracked: number,
    staged: number,
    openBugs: number,
  ): number {
    return this.calculateProjectHealth(modified, untracked, staged, openBugs);
  }
}
