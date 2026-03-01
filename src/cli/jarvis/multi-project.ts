/**
 * Multi-Project Manager — Jarvis awareness across multiple projects.
 * Registers projects, scans their state, detects cross-project patterns.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import type { RegisteredProject, MultiProjectData } from './types.js';

const EMPTY_DATA: MultiProjectData = { version: 1, projects: [] };

export class MultiProjectManager {
  private data: MultiProjectData;
  private filePath: string;
  private currentProjectRoot: string;

  constructor(projectRoot: string) {
    this.currentProjectRoot = projectRoot;
    this.filePath = join(projectRoot, '.helixmind', 'jarvis', 'projects.json');
    this.data = this.load();
  }

  private load(): MultiProjectData {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as MultiProjectData;
        if (parsed.version === 1 && Array.isArray(parsed.projects)) return parsed;
      }
    } catch { /* corrupted */ }
    return { ...EMPTY_DATA, projects: [] };
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  /**
   * Register a project for cross-project awareness.
   */
  registerProject(path: string, name?: string): RegisteredProject {
    // Derive name from package.json if not given
    if (!name) {
      try {
        const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf-8'));
        name = pkg.name || path.split(/[\\/]/).pop() || 'unknown';
      } catch {
        name = path.split(/[\\/]/).pop() || 'unknown';
      }
    }

    // Don't register duplicates
    const existing = this.data.projects.find(p => p.path === path);
    if (existing) {
      existing.name = name || existing.name;
      this.save();
      return existing;
    }

    const resolvedName = name || path.split(/[\\/]/).pop() || 'unknown';

    const project: RegisteredProject = {
      name: resolvedName,
      path,
      addedAt: Date.now(),
      lastScannedAt: 0,
      health: 100,
    };

    this.data.projects.push(project);
    this.save();
    return project;
  }

  /**
   * Remove a registered project.
   */
  removeProject(nameOrPath: string): boolean {
    const idx = this.data.projects.findIndex(p =>
      p.name === nameOrPath || p.path === nameOrPath
    );
    if (idx === -1) return false;
    this.data.projects.splice(idx, 1);
    this.save();
    return true;
  }

  /**
   * Scan all registered projects (called in Quick Check).
   * Lightweight: just git status + open bugs count.
   */
  scanRegisteredProjects(): { name: string; health: number; issues: string[] }[] {
    const results: { name: string; health: number; issues: string[] }[] = [];

    for (const project of this.data.projects) {
      if (!existsSync(project.path)) continue;

      const issues: string[] = [];
      let health = 100;

      try {
        // Git status
        const statusRaw = execSync('git status --porcelain', {
          cwd: project.path,
          encoding: 'utf-8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();

        const lines = statusRaw ? statusRaw.split('\n').length : 0;
        if (lines > 0) {
          health -= Math.min(20, lines * 2);
          issues.push(`${lines} uncommitted changes`);
        }

        // Open bugs
        const bugsPath = join(project.path, '.helixmind', 'bugs.json');
        if (existsSync(bugsPath)) {
          const bugsData = JSON.parse(readFileSync(bugsPath, 'utf-8'));
          const openBugs = (bugsData.bugs || []).filter(
            (b: { status: string }) => b.status === 'open' || b.status === 'investigating'
          ).length;
          if (openBugs > 0) {
            health -= Math.min(30, openBugs * 5);
            issues.push(`${openBugs} open bugs`);
          }
        }
      } catch {
        issues.push('scan failed');
        health = 0;
      }

      project.health = Math.max(0, health);
      project.lastScannedAt = Date.now();
      results.push({ name: project.name, health: project.health, issues });
    }

    this.save();
    return results;
  }

  /**
   * Get cross-project insights for deep thinking.
   */
  getCrossProjectInsights(): string {
    if (this.data.projects.length === 0) return '';

    const lines: string[] = ['## Multi-Project Awareness'];

    for (const p of this.data.projects) {
      const age = p.lastScannedAt ? `scanned ${Math.round((Date.now() - p.lastScannedAt) / 60000)}m ago` : 'not scanned';
      lines.push(`- ${p.name} (${p.path}): health ${p.health}/100, ${age}`);
    }

    return lines.join('\n');
  }

  /**
   * List all registered projects.
   */
  listProjects(): RegisteredProject[] {
    return [...this.data.projects];
  }

  /**
   * Get project count.
   */
  get count(): number {
    return this.data.projects.length;
  }
}
