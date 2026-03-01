/**
 * Performance Profiler — build time tracking, bundle analysis,
 * memory leak pattern detection for Jarvis awareness.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { ProposalEvidence } from './types.js';

export interface PerformanceInsight {
  type: 'build_time' | 'bundle_size' | 'large_import' | 'build_regression';
  description: string;
  severity: 'low' | 'medium' | 'high';
  metric?: number;
  previousMetric?: number;
  suggestion?: string;
}

interface BuildHistory {
  builds: Array<{
    timestamp: number;
    durationMs: number;
    success: boolean;
  }>;
  bundleSizes: Array<{
    timestamp: number;
    totalBytes: number;
    files: Record<string, number>;
  }>;
}

const EMPTY_HISTORY: BuildHistory = { builds: [], bundleSizes: [] };

/**
 * Measure build time and track it over time.
 */
export function measureBuildTime(projectRoot: string): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];
  const history = loadHistory(projectRoot);

  try {
    const start = Date.now();
    execSync('npm run build 2>/dev/null', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const durationMs = Date.now() - start;

    // Record build
    history.builds.push({ timestamp: Date.now(), durationMs, success: true });

    // Keep last 50 builds
    if (history.builds.length > 50) {
      history.builds = history.builds.slice(-50);
    }

    // Check for regression (> 20% slower than average of last 10)
    const recentBuilds = history.builds
      .filter(b => b.success)
      .slice(-11, -1);  // last 10 before current

    if (recentBuilds.length >= 3) {
      const avgMs = recentBuilds.reduce((sum, b) => sum + b.durationMs, 0) / recentBuilds.length;

      if (durationMs > avgMs * 1.2) {
        const pctIncrease = Math.round(((durationMs - avgMs) / avgMs) * 100);
        insights.push({
          type: 'build_regression',
          description: `Build time increased ${pctIncrease}% (${formatMs(durationMs)} vs avg ${formatMs(avgMs)})`,
          severity: pctIncrease > 50 ? 'high' : 'medium',
          metric: durationMs,
          previousMetric: avgMs,
          suggestion: 'Check for large new dependencies or unoptimized imports',
        });
      }
    }

    saveHistory(projectRoot, history);
  } catch {
    // Build failed — record failure
    history.builds.push({ timestamp: Date.now(), durationMs: 0, success: false });
    saveHistory(projectRoot, history);
  }

  return insights;
}

/**
 * Analyze bundle/dist output size.
 */
export function analyzeBundleSize(projectRoot: string): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];
  const history = loadHistory(projectRoot);

  // Check dist/ or build/ directory
  const distPaths = ['dist', 'build', '.next', 'out'];
  let distPath: string | null = null;

  for (const dp of distPaths) {
    const fullPath = join(projectRoot, dp);
    if (existsSync(fullPath)) {
      distPath = fullPath;
      break;
    }
  }

  if (!distPath) return insights;

  try {
    // Calculate total size
    const totalBytes = getDirSize(distPath);

    // Record bundle size
    const entry = { timestamp: Date.now(), totalBytes, files: {} as Record<string, number> };
    history.bundleSizes.push(entry);

    // Keep last 20
    if (history.bundleSizes.length > 20) {
      history.bundleSizes = history.bundleSizes.slice(-20);
    }

    // Check for size spike (> 15% increase from previous)
    if (history.bundleSizes.length >= 2) {
      const previous = history.bundleSizes[history.bundleSizes.length - 2];
      if (previous.totalBytes > 0) {
        const pctChange = ((totalBytes - previous.totalBytes) / previous.totalBytes) * 100;

        if (pctChange > 15) {
          insights.push({
            type: 'bundle_size',
            description: `Bundle size increased ${Math.round(pctChange)}% (${formatBytes(totalBytes)} vs ${formatBytes(previous.totalBytes)})`,
            severity: pctChange > 30 ? 'high' : 'medium',
            metric: totalBytes,
            previousMetric: previous.totalBytes,
            suggestion: 'Check for large new dependencies or assets. Run bundle analyzer.',
          });
        }
      }
    }

    saveHistory(projectRoot, history);
  } catch { /* size analysis failed */ }

  return insights;
}

/**
 * Detect potentially large imports in recently changed files.
 */
export function detectLargeImports(projectRoot: string): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];

  // Known heavy packages
  const HEAVY_PACKAGES = new Set([
    'moment', 'lodash', 'rxjs', 'aws-sdk', 'firebase',
    'three', 'chart.js', 'pdf-lib', 'sharp',
  ]);

  try {
    const diffRaw = execSync('git diff HEAD~1 HEAD --name-only', {
      cwd: projectRoot, encoding: 'utf-8', timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!diffRaw) return insights;

    const changedFiles = diffRaw.split('\n').filter(f =>
      (f.endsWith('.ts') || f.endsWith('.js')) && !f.includes('.test.') && !f.includes('.spec.')
    );

    for (const file of changedFiles.slice(0, 20)) {
      const fullPath = join(projectRoot, file);
      if (!existsSync(fullPath)) continue;

      try {
        const content = readFileSync(fullPath, 'utf-8');

        for (const pkg of HEAVY_PACKAGES) {
          if (content.includes(`from '${pkg}'`) || content.includes(`from "${pkg}"`) || content.includes(`require('${pkg}')`)) {
            // Check if it's a barrel import (no specific named imports)
            const barrelPattern = new RegExp(`import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"]${pkg}['"]`);
            const defaultImport = new RegExp(`import\\s+\\w+\\s+from\\s+['"]${pkg}['"]`);

            if (barrelPattern.test(content) || defaultImport.test(content)) {
              insights.push({
                type: 'large_import',
                description: `Full import of heavy package '${pkg}' in ${file}`,
                severity: 'medium',
                suggestion: `Use named imports: import { specific } from '${pkg}' or '${pkg}/specific'`,
              });
            }
          }
        }
      } catch { /* file read failed */ }
    }
  } catch { /* git diff failed */ }

  return insights;
}

/**
 * Run full performance analysis.
 * Note: measureBuildTime is expensive — only run in Deep-Check.
 */
export function runPerformanceAnalysis(projectRoot: string, includeBuild = false): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];

  insights.push(...detectLargeImports(projectRoot));
  insights.push(...analyzeBundleSize(projectRoot));

  if (includeBuild) {
    insights.push(...measureBuildTime(projectRoot));
  }

  return insights;
}

/**
 * Convert performance insights to proposal evidence.
 */
export function insightsToEvidence(insights: PerformanceInsight[]): ProposalEvidence[] {
  return insights.map(i => ({
    type: 'metric' as const,
    content: `[${i.severity}] ${i.type}: ${i.description}${i.suggestion ? ` — ${i.suggestion}` : ''}`,
    timestamp: Date.now(),
  }));
}

// ─── Persistence ─────────────────────────────────────────────────────

function loadHistory(projectRoot: string): BuildHistory {
  const filePath = join(projectRoot, '.helixmind', 'jarvis', 'build-history.json');
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as BuildHistory;
    }
  } catch { /* corrupted */ }
  return { ...EMPTY_HISTORY, builds: [], bundleSizes: [] };
}

function saveHistory(projectRoot: string, history: BuildHistory): void {
  const filePath = join(projectRoot, '.helixmind', 'jarvis', 'build-history.json');
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf-8');
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getDirSize(dirPath: string): number {
  let total = 0;
  try {
    const raw = execSync(`du -sb "${dirPath}" 2>/dev/null || echo "0 ${dirPath}"`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const match = raw.match(/^(\d+)/);
    if (match) total = parseInt(match[1], 10);
  } catch {
    // Fallback: check single files
    try {
      const stat = statSync(dirPath);
      total = stat.size;
    } catch { /* skip */ }
  }
  return total;
}
