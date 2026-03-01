/**
 * Test Sentinel — test intelligence for Jarvis.
 * Detects affected tests from git changes, flaky test tracking,
 * coverage trend monitoring.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProposalEvidence } from './types.js';

export interface TestInsight {
  type: 'affected_tests' | 'flaky_test' | 'coverage_drop' | 'missing_tests';
  description: string;
  severity: 'low' | 'medium' | 'high';
  files?: string[];
  suggestion?: string;
}

/**
 * Detect which test files are likely affected by recent changes.
 * Uses import/require graph heuristics from git diff.
 */
export function detectAffectedTests(projectRoot: string): TestInsight[] {
  const insights: TestInsight[] = [];

  try {
    // Get changed files from last commit
    const diffRaw = execSync('git diff HEAD~1 HEAD --name-only', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!diffRaw) return insights;

    const changedFiles = diffRaw.split('\n').filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    if (changedFiles.length === 0) return insights;

    // Find test files that import changed source files
    const affectedTests: string[] = [];
    const changedSrcFiles = changedFiles.filter(f => !f.includes('.test.') && !f.includes('.spec.') && !f.includes('__tests__'));
    const changedTestFiles = changedFiles.filter(f => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'));

    // Check which test files reference the changed source files
    for (const srcFile of changedSrcFiles) {
      const baseName = srcFile.replace(/\.(ts|js)$/, '').split('/').pop();
      if (!baseName) continue;

      // Look for corresponding test file
      const testPatterns = [
        srcFile.replace(/\.(ts|js)$/, '.test.$1'),
        srcFile.replace(/\.(ts|js)$/, '.spec.$1'),
        srcFile.replace(/src\//, 'test/').replace(/\.(ts|js)$/, '.test.$1'),
      ];

      for (const pattern of testPatterns) {
        const fullPath = join(projectRoot, pattern);
        if (existsSync(fullPath) && !changedTestFiles.includes(pattern)) {
          affectedTests.push(pattern);
        }
      }

      // Search for test files that import this module
      try {
        const grepResult = execSync(
          `git grep -l "${baseName}" -- "*.test.ts" "*.spec.ts" "*.test.js" "*.spec.js" 2>/dev/null || true`,
          { cwd: projectRoot, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();

        if (grepResult) {
          for (const testFile of grepResult.split('\n')) {
            if (testFile && !changedTestFiles.includes(testFile) && !affectedTests.includes(testFile)) {
              affectedTests.push(testFile);
            }
          }
        }
      } catch { /* grep not available or failed */ }
    }

    if (affectedTests.length > 0) {
      insights.push({
        type: 'affected_tests',
        description: `${affectedTests.length} test file(s) may be affected by recent changes`,
        severity: 'medium',
        files: affectedTests,
        suggestion: `Run: npx vitest ${affectedTests.slice(0, 5).join(' ')}`,
      });
    }

    // Check for source files without corresponding tests
    const untestedFiles = changedSrcFiles.filter(f => {
      const baseName2 = f.replace(/\.(ts|js)$/, '');
      return !existsSync(join(projectRoot, `${baseName2}.test.ts`))
        && !existsSync(join(projectRoot, `${baseName2}.spec.ts`));
    });

    if (untestedFiles.length > 0) {
      insights.push({
        type: 'missing_tests',
        description: `${untestedFiles.length} changed source file(s) have no corresponding test file`,
        severity: 'low',
        files: untestedFiles,
        suggestion: 'Consider adding tests for these files',
      });
    }
  } catch {
    // Git commands failed — skip
  }

  return insights;
}

/**
 * Check for flaky tests by looking at recent test history.
 * Reads .helixmind/test-history.json if it exists.
 */
export function detectFlakyTests(projectRoot: string): TestInsight[] {
  const historyPath = join(projectRoot, '.helixmind', 'test-history.json');
  if (!existsSync(historyPath)) return [];

  try {
    const raw = readFileSync(historyPath, 'utf-8');
    const history = JSON.parse(raw) as {
      runs: Array<{ test: string; passed: boolean; timestamp: number }>;
    };

    if (!history.runs || history.runs.length === 0) return [];

    // Group by test name
    const testResults = new Map<string, { pass: number; fail: number }>();
    for (const run of history.runs) {
      const entry = testResults.get(run.test) || { pass: 0, fail: 0 };
      if (run.passed) entry.pass++;
      else entry.fail++;
      testResults.set(run.test, entry);
    }

    // Flaky = has both passes and failures (min 3 total runs)
    const flakyTests: string[] = [];
    for (const [test, results] of testResults) {
      const total = results.pass + results.fail;
      if (total >= 3 && results.pass > 0 && results.fail > 0) {
        flakyTests.push(test);
      }
    }

    if (flakyTests.length > 0) {
      return [{
        type: 'flaky_test',
        description: `${flakyTests.length} flaky test(s) detected (inconsistent pass/fail)`,
        severity: 'medium',
        files: flakyTests,
        suggestion: 'Investigate timing, shared state, or external dependencies in these tests',
      }];
    }
  } catch { /* corrupted history */ }

  return [];
}

/**
 * Run a quick test suite status check (vitest --reporter=json).
 * Non-blocking: returns null if tests take too long.
 */
export function getTestSuiteStatus(projectRoot: string): { passed: number; failed: number; total: number } | null {
  try {
    const raw = execSync('npx vitest run --reporter=json 2>/dev/null', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 60_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const result = JSON.parse(raw) as {
      numPassedTests?: number;
      numFailedTests?: number;
      numTotalTests?: number;
    };

    return {
      passed: result.numPassedTests || 0,
      failed: result.numFailedTests || 0,
      total: result.numTotalTests || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Build test insights for the thinking loop.
 */
export function runTestAnalysis(projectRoot: string): TestInsight[] {
  return [
    ...detectAffectedTests(projectRoot),
    ...detectFlakyTests(projectRoot),
  ];
}

/**
 * Convert test insights to proposal evidence.
 */
export function insightsToEvidence(insights: TestInsight[]): ProposalEvidence[] {
  return insights.map(i => ({
    type: 'observation' as const,
    content: `[${i.severity}] ${i.type}: ${i.description}${i.suggestion ? ` — ${i.suggestion}` : ''}`,
    timestamp: Date.now(),
  }));
}
