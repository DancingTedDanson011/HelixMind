/**
 * Spiral-based validation — checks output against project knowledge stored in spiral memory.
 * Queries spiral for known patterns, styles, and previous bugs.
 */
import type { SpiralEngine } from '../../spiral/engine.js';
import type { CheckResult } from './static-checks.js';

/**
 * Run all spiral-based checks.
 * Queries the spiral for project knowledge and compares against the output.
 */
export async function runSpiralChecks(
  output: string,
  engine: SpiralEngine | undefined,
): Promise<CheckResult[]> {
  if (!engine) return [];

  const results: CheckResult[] = [];

  try {
    // 1. Style consistency check
    const styleResult = await checkStyleConsistency(output, engine);
    if (styleResult) results.push(styleResult);

    // 2. Pattern consistency check
    const patternResult = await checkPatternConsistency(output, engine);
    if (patternResult) results.push(patternResult);

    // 3. Known bug patterns check
    const bugResult = await checkKnownBugPatterns(output, engine);
    if (bugResult) results.push(bugResult);
  } catch {
    // Spiral checks are non-critical — don't block on failure
  }

  return results;
}

/**
 * Check if the output uses colors/fonts consistent with the project.
 */
async function checkStyleConsistency(
  output: string,
  engine: SpiralEngine,
): Promise<CheckResult | null> {
  try {
    const styleQuery = await engine.query('project style colors fonts design theme', undefined, [3, 4, 5]);

    if (styleQuery.node_count === 0) return null;

    // Extract colors from spiral knowledge
    const spiralText = [
      ...styleQuery.level_3.map(n => n.content),
      ...styleQuery.level_4.map(n => n.content),
      ...styleQuery.level_5.map(n => n.content),
    ].join('\n');

    const knownColors = spiralText.match(/#[0-9a-fA-F]{3,8}/g);
    if (!knownColors || knownColors.length === 0) return null;

    // Extract colors from output
    const outputColors = output.match(/#[0-9a-fA-F]{3,8}/g);
    if (!outputColors || outputColors.length === 0) return null;

    // Check if output uses project colors
    const uniqueKnown = new Set(knownColors.map(c => c.toLowerCase()));
    const uniqueOutput = new Set(outputColors.map(c => c.toLowerCase()));
    const overlap = [...uniqueOutput].filter(c => uniqueKnown.has(c));

    if (overlap.length === 0 && uniqueOutput.size > 0) {
      return {
        id: 'spiral-style',
        passed: false,
        details: `Output uses colors not found in project: ${[...uniqueOutput].slice(0, 3).join(', ')}. Known project colors: ${[...uniqueKnown].slice(0, 3).join(', ')}`,
        fix: `Consider using project colors: ${[...uniqueKnown].slice(0, 3).join(', ')}`,
        severity: 'info',
        autofix: true,
      };
    }

    return {
      id: 'spiral-style',
      passed: true,
      details: 'Colors consistent with project',
      severity: 'info',
      autofix: false,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the output follows project coding patterns.
 */
async function checkPatternConsistency(
  output: string,
  engine: SpiralEngine,
): Promise<CheckResult | null> {
  try {
    const patternQuery = await engine.query('code patterns conventions naming imports', undefined, [4, 5]);

    if (patternQuery.node_count === 0) return null;

    const spiralText = [
      ...patternQuery.level_4.map(n => n.content),
      ...patternQuery.level_5.map(n => n.content),
    ].join('\n');

    const issues: string[] = [];

    // Check import style consistency
    if (spiralText.includes("from '") && output.includes('from "')) {
      issues.push('Project uses single quotes for imports, output uses double quotes');
    }
    if (spiralText.includes('from "') && output.includes("from '")) {
      issues.push('Project uses double quotes for imports, output uses single quotes');
    }

    // Check semicolon consistency
    const spiralHasSemicolons = (spiralText.match(/;\s*$/gm) || []).length > 5;
    const outputHasSemicolons = (output.match(/;\s*$/gm) || []).length > 2;
    const spiralNoSemicolons = !spiralHasSemicolons && spiralText.includes('const ');
    if (spiralHasSemicolons && !outputHasSemicolons && output.includes('const ')) {
      issues.push('Project uses semicolons, output does not');
    }
    if (spiralNoSemicolons && outputHasSemicolons) {
      issues.push('Project omits semicolons, output uses them');
    }

    if (issues.length > 0) {
      return {
        id: 'spiral-pattern',
        passed: false,
        details: issues.join('; '),
        severity: 'info',
        autofix: true,
      };
    }

    return {
      id: 'spiral-pattern',
      passed: true,
      details: 'Follows project patterns',
      severity: 'info',
      autofix: false,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the output repeats known bug patterns from the project history.
 */
async function checkKnownBugPatterns(
  output: string,
  engine: SpiralEngine,
): Promise<CheckResult | null> {
  try {
    const bugQuery = await engine.query('bug error fix issue problem', undefined, [2, 3]);

    if (bugQuery.node_count === 0) return null;

    const bugPatterns = [
      ...bugQuery.level_2.map(n => n.content),
      ...bugQuery.level_3.map(n => n.content),
    ];

    // Simple heuristic: check if output contains patterns that were previously buggy
    const warningPatterns: string[] = [];

    for (const bugContent of bugPatterns) {
      // Extract code patterns from bug reports
      const codePatterns = bugContent.match(/`([^`]+)`/g);
      if (codePatterns) {
        for (const pattern of codePatterns) {
          const clean = pattern.replace(/`/g, '');
          if (clean.length > 10 && output.includes(clean)) {
            warningPatterns.push(clean.slice(0, 50));
          }
        }
      }
    }

    if (warningPatterns.length > 0) {
      return {
        id: 'spiral-bugs',
        passed: false,
        details: `Output contains patterns from previous bugs: ${warningPatterns.join(', ')}`,
        severity: 'warning',
        autofix: false,
      };
    }

    return null; // No known bug patterns found — skip (don't report as pass)
  } catch {
    return null;
  }
}
