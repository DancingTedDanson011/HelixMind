/**
 * Validation Autofix Loop — runs checks, applies fixes, re-validates.
 * Max 3 loops before giving up.
 */
import type { ValidationCriterion } from './criteria.js';
import type { CheckResult } from './static-checks.js';
import { runStaticChecks, type StaticCheckContext } from './static-checks.js';
import { runDynamicChecks } from './dynamic-checks.js';
import { runSpiralChecks } from './spiral-checks.js';
import type { LLMProvider } from '../providers/types.js';
import type { SpiralEngine } from '../../spiral/engine.js';

export type ValidationStatus = 'passed' | 'warnings' | 'errors' | 'max_loops';

export interface ValidationResult {
  output: string;
  results: CheckResult[];
  loops: number;
  status: ValidationStatus;
  fixesApplied: number;
  duration: number;
}

export interface ValidationLoopOptions {
  criteria: ValidationCriterion[];
  userRequest: string;
  spiralContext: string;
  spiralEngine?: SpiralEngine;
  validationProvider?: LLMProvider;
  staticContext?: StaticCheckContext;
  maxLoops?: number;
}

/**
 * Run the full validation loop: check → fix → re-check.
 */
export async function validationLoop(
  output: string,
  options: ValidationLoopOptions,
): Promise<ValidationResult> {
  const {
    criteria,
    userRequest,
    spiralContext,
    spiralEngine,
    validationProvider,
    staticContext,
    maxLoops = 3,
  } = options;

  const startTime = Date.now();
  let currentOutput = output;
  let totalFixesApplied = 0;
  let loop = 0;

  while (loop < maxLoops) {
    // Run all checks
    const results = await runAllChecks(currentOutput, criteria, {
      userRequest,
      spiralContext,
      spiralEngine,
      validationProvider,
      staticContext,
    });

    // Count errors
    const errors = results.filter(r => !r.passed && r.severity === 'error');
    const warnings = results.filter(r => !r.passed && r.severity === 'warning');

    // All passed?
    if (errors.length === 0) {
      const status: ValidationStatus = warnings.length > 0 ? 'warnings' : 'passed';
      return {
        output: currentOutput,
        results,
        loops: loop,
        status,
        fixesApplied: totalFixesApplied,
        duration: Date.now() - startTime,
      };
    }

    // Find autofixable errors
    const fixable = errors.filter(r => r.autofix && r.fix);
    if (fixable.length === 0) {
      // Can't fix anything — return with errors
      return {
        output: currentOutput,
        results,
        loops: loop,
        status: 'errors',
        fixesApplied: totalFixesApplied,
        duration: Date.now() - startTime,
      };
    }

    // Apply fixes
    for (const fix of fixable) {
      currentOutput = applyFix(currentOutput, fix);
      totalFixesApplied++;
    }

    loop++;
  }

  // Max loops reached
  const finalResults = await runAllChecks(currentOutput, criteria, {
    userRequest,
    spiralContext,
    spiralEngine,
    validationProvider,
    staticContext,
  });

  return {
    output: currentOutput,
    results: finalResults,
    loops: loop,
    status: 'max_loops',
    fixesApplied: totalFixesApplied,
    duration: Date.now() - startTime,
  };
}

// ── Internal ──

interface CheckContext {
  userRequest: string;
  spiralContext: string;
  spiralEngine?: SpiralEngine;
  validationProvider?: LLMProvider;
  staticContext?: StaticCheckContext;
}

async function runAllChecks(
  output: string,
  criteria: ValidationCriterion[],
  ctx: CheckContext,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Static checks
  const staticCriteria = criteria.filter(c => c.check === 'static').map(c => c.id);
  if (staticCriteria.length > 0) {
    const staticResults = runStaticChecks(output, staticCriteria, ctx.staticContext);
    results.push(...staticResults);
  }

  // 2. Dynamic checks (if provider available)
  if (ctx.validationProvider) {
    const dynamicCriteria = criteria.filter(c => c.check === 'dynamic');
    if (dynamicCriteria.length > 0) {
      const dynamicResults = await runDynamicChecks(
        dynamicCriteria,
        output,
        ctx.userRequest,
        ctx.spiralContext,
        ctx.validationProvider,
      );
      results.push(...dynamicResults);
    }
  } else {
    // No validation provider — mark dynamic checks as passed (skip)
    for (const c of criteria.filter(c => c.check === 'dynamic')) {
      results.push({
        id: c.id,
        passed: true,
        details: 'Skipped (no validation model)',
        severity: c.severity,
        autofix: false,
      });
    }
  }

  // 3. Spiral checks
  const spiralResults = await runSpiralChecks(output, ctx.spiralEngine);
  results.push(...spiralResults);

  return results;
}

/**
 * Apply a fix to the output. Currently handles simple string-based fixes.
 */
function applyFix(output: string, result: CheckResult): string {
  if (!result.fix) return output;

  // The fix is a description, not a diff — we can't apply it automatically
  // in most cases. But for simple structural fixes we can try:

  switch (result.id) {
    case 'html-valid': {
      // Append missing closing tags
      if (result.fix.startsWith('</')) {
        return output + '\n' + result.fix;
      }
      break;
    }
    case 'img-alt': {
      // Add alt="" to images
      return output.replace(/<img\b(?![^>]*alt=)([^>]*)>/gi, '<img alt=""$1>');
    }
    case 'mocks-cleanup': {
      // Add afterEach
      if (result.fix.includes('afterEach') && !output.includes('afterEach')) {
        let insertPoint = output.indexOf("describe('");
        if (insertPoint === -1) insertPoint = output.indexOf('describe("');
        if (insertPoint >= 0) {
          const nextBrace = output.indexOf('{', insertPoint);
          if (nextBrace >= 0) {
            return output.slice(0, nextBrace + 1) +
              '\n  afterEach(() => { vi.restoreAllMocks(); });\n' +
              output.slice(nextBrace + 1);
          }
        }
      }
      break;
    }
  }

  // For most fixes, we can't auto-apply — return unchanged
  return output;
}
