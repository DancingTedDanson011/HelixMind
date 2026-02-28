/**
 * Validation Criteria — Base matrix + dynamic criteria generation.
 * Each TaskCategory has a set of static base criteria.
 * Dynamic criteria are extracted from the user message and spiral knowledge.
 */
import type { TaskCategory, TaskClassification } from './classifier.js';

export type CriterionCategory =
  | 'structural'
  | 'completeness'
  | 'consistency'
  | 'logic'
  | 'style'
  | 'security'
  | 'performance';

export interface ValidationCriterion {
  id: string;
  category: CriterionCategory;
  description: string;
  check: 'static' | 'dynamic';
  severity: 'error' | 'warning' | 'info';
  autofix: boolean;
}

// ── Base Criteria Matrix ──

export const BASE_CRITERIA: Record<TaskCategory, ValidationCriterion[]> = {

  ui_component: [
    { id: 'html-valid', category: 'structural', description: 'HTML is syntactically correct (tags closed, properly nested)', check: 'static', severity: 'error', autofix: true },
    { id: 'links-valid', category: 'structural', description: 'All href/src attributes have valid values', check: 'static', severity: 'error', autofix: true },
    { id: 'ids-unique', category: 'structural', description: 'No duplicate IDs in DOM', check: 'static', severity: 'error', autofix: true },
    { id: 'img-alt', category: 'structural', description: 'All <img> have alt attributes', check: 'static', severity: 'warning', autofix: true },
    { id: 'requirements-met', category: 'completeness', description: 'All user-requested elements are present', check: 'dynamic', severity: 'error', autofix: true },
    { id: 'responsive', category: 'completeness', description: 'Mobile-responsive unless explicitly excluded', check: 'dynamic', severity: 'warning', autofix: false },
    { id: 'style-match', category: 'consistency', description: 'Colors, fonts, spacing match existing project', check: 'dynamic', severity: 'warning', autofix: true },
    { id: 'naming-match', category: 'consistency', description: 'CSS classes/IDs follow existing naming pattern', check: 'dynamic', severity: 'info', autofix: true },
    { id: 'no-dead-code', category: 'logic', description: 'No unreachable code or unused imports', check: 'static', severity: 'warning', autofix: true },
    { id: 'events-bound', category: 'logic', description: 'Event listeners reference existing functions', check: 'static', severity: 'error', autofix: false },
  ],

  api_endpoint: [
    { id: 'error-handling', category: 'logic', description: 'All paths have error handling (try/catch, status codes)', check: 'static', severity: 'error', autofix: true },
    { id: 'input-validation', category: 'security', description: 'User input is validated/sanitized', check: 'dynamic', severity: 'error', autofix: true },
    { id: 'status-codes', category: 'structural', description: 'Correct HTTP status codes (not 200 everywhere)', check: 'static', severity: 'warning', autofix: true },
    { id: 'response-format', category: 'consistency', description: 'Response format matches existing API structure', check: 'dynamic', severity: 'warning', autofix: true },
    { id: 'auth-check', category: 'security', description: 'Protected routes have auth middleware', check: 'dynamic', severity: 'error', autofix: false },
    { id: 'sql-injection', category: 'security', description: 'No SQL injection possible (parameterized queries)', check: 'static', severity: 'error', autofix: true },
    { id: 'async-await', category: 'logic', description: 'Async functions correctly awaited, no floating promises', check: 'static', severity: 'error', autofix: true },
  ],

  bug_fix: [
    { id: 'bug-addressed', category: 'completeness', description: 'The described bug is actually fixed', check: 'dynamic', severity: 'error', autofix: false },
    { id: 'no-regression', category: 'logic', description: 'Fix has not introduced new problems', check: 'dynamic', severity: 'error', autofix: false },
    { id: 'root-cause', category: 'completeness', description: 'Root cause addressed, not just symptom', check: 'dynamic', severity: 'warning', autofix: false },
    { id: 'edge-cases', category: 'logic', description: 'Edge cases that led to the bug are covered', check: 'dynamic', severity: 'warning', autofix: false },
  ],

  refactoring: [
    { id: 'behavior-same', category: 'logic', description: 'External behavior unchanged', check: 'dynamic', severity: 'error', autofix: false },
    { id: 'imports-updated', category: 'structural', description: 'All imports/exports correct after refactor', check: 'static', severity: 'error', autofix: true },
    { id: 'no-orphans', category: 'structural', description: 'No orphaned files/functions', check: 'static', severity: 'warning', autofix: false },
    { id: 'types-correct', category: 'structural', description: 'TypeScript types correct after refactor', check: 'static', severity: 'error', autofix: true },
  ],

  testing: [
    { id: 'assertions-exist', category: 'completeness', description: 'Every test has at least one assertion', check: 'static', severity: 'error', autofix: true },
    { id: 'test-edge-cases', category: 'completeness', description: 'Edge cases and error paths tested', check: 'dynamic', severity: 'warning', autofix: false },
    { id: 'no-false-positive', category: 'logic', description: 'Tests can fail (not always-true)', check: 'dynamic', severity: 'error', autofix: false },
    { id: 'mocks-cleanup', category: 'structural', description: 'Mocks are cleaned up after tests', check: 'static', severity: 'warning', autofix: true },
  ],

  general_code: [
    { id: 'syntax-valid', category: 'structural', description: 'Code is syntactically correct and parseable', check: 'static', severity: 'error', autofix: true },
    { id: 'imports-resolve', category: 'structural', description: 'All imports exist and are correct', check: 'static', severity: 'error', autofix: true },
    { id: 'types-correct', category: 'structural', description: 'TypeScript compiles without errors', check: 'static', severity: 'error', autofix: true },
    { id: 'no-hardcoded', category: 'logic', description: 'No hardcoded secrets, paths, or magic numbers', check: 'static', severity: 'warning', autofix: false },
    { id: 'requirements-met', category: 'completeness', description: 'All user-requested requirements implemented', check: 'dynamic', severity: 'error', autofix: true },
  ],

  data_processing: [
    { id: 'input-handled', category: 'logic', description: 'Empty/invalid input data is handled', check: 'static', severity: 'error', autofix: true },
    { id: 'output-format', category: 'completeness', description: 'Output format as requested', check: 'dynamic', severity: 'error', autofix: true },
  ],

  configuration: [
    { id: 'syntax-valid', category: 'structural', description: 'Config syntax correct (JSON/YAML/TOML)', check: 'static', severity: 'error', autofix: true },
    { id: 'no-secrets', category: 'security', description: 'No plaintext secrets', check: 'static', severity: 'error', autofix: false },
  ],

  documentation: [
    { id: 'links-valid', category: 'structural', description: 'Markdown links correctly formatted', check: 'static', severity: 'warning', autofix: true },
    { id: 'complete', category: 'completeness', description: 'All requested topics covered', check: 'dynamic', severity: 'error', autofix: true },
  ],

  architecture: [
    { id: 'no-circular', category: 'logic', description: 'No circular dependencies', check: 'static', severity: 'error', autofix: false },
    { id: 'separation', category: 'logic', description: 'Clear separation of concerns', check: 'dynamic', severity: 'warning', autofix: false },
  ],

  chat_only: [],
};

/**
 * Generate the complete criteria set for a classified task.
 * Combines base criteria + dynamic criteria from the user message.
 */
export function generateCriteria(
  classification: TaskClassification,
  userMessage: string,
  spiralContext?: string,
): ValidationCriterion[] {
  const baseCriteria = [...(BASE_CRITERIA[classification.category] || [])];

  // Skip dynamic criteria for chat_only
  if (classification.category === 'chat_only') return [];

  // Extract dynamic criteria from user message
  const dynamicCriteria = extractDynamicCriteria(userMessage, baseCriteria.length);

  // Extract spiral-based criteria
  const spiralCriteria = spiralContext
    ? extractSpiralCriteria(spiralContext, baseCriteria.length + dynamicCriteria.length)
    : [];

  return [...baseCriteria, ...dynamicCriteria, ...spiralCriteria];
}

/**
 * Extract dynamic criteria from user requirements.
 * Identifies specific elements, counts, and properties the user requested.
 */
function extractDynamicCriteria(userMessage: string, startIdx: number): ValidationCriterion[] {
  const criteria: ValidationCriterion[] = [];
  let idx = startIdx;

  // Extract numbered requirements (e.g. "1. do X 2. do Y")
  const numberedItems = userMessage.match(/\d+[\.\)]\s*[^\d\n]+/g);
  if (numberedItems) {
    for (const item of numberedItems) {
      const desc = item.replace(/^\d+[\.\)]\s*/, '').trim();
      if (desc.length > 5) {
        criteria.push({
          id: `dyn-${++idx}`,
          category: 'completeness',
          description: `Requirement: ${desc}`,
          check: 'dynamic',
          severity: 'error',
          autofix: true,
        });
      }
    }
  }

  // Extract "with X" or "mit X" requirements
  const withPatterns = userMessage.match(/(?:with|mit|und|and)\s+([^,.!?\n]+)/gi);
  if (withPatterns && criteria.length === 0) {
    for (const match of withPatterns.slice(0, 5)) {
      const desc = match.trim();
      if (desc.length > 5 && desc.length < 100) {
        criteria.push({
          id: `dyn-${++idx}`,
          category: 'completeness',
          description: `Includes: ${desc}`,
          check: 'dynamic',
          severity: 'warning',
          autofix: false,
        });
      }
    }
  }

  // Extract specific count requirements ("5 buttons", "3 columns")
  const countPatterns = userMessage.match(/(\d+)\s+([\w-]+)/g);
  if (countPatterns) {
    for (const match of countPatterns.slice(0, 3)) {
      criteria.push({
        id: `dyn-${++idx}`,
        category: 'completeness',
        description: `Contains exactly ${match}`,
        check: 'dynamic',
        severity: 'warning',
        autofix: false,
      });
    }
  }

  return criteria;
}

/**
 * Extract criteria from spiral knowledge (project conventions).
 */
function extractSpiralCriteria(spiralContext: string, startIdx: number): ValidationCriterion[] {
  const criteria: ValidationCriterion[] = [];
  let idx = startIdx;

  // Detect CSS framework mentions
  const frameworks = ['tailwind', 'bootstrap', 'mui', 'chakra', 'styled-components', 'sass', 'less'];
  for (const fw of frameworks) {
    if (spiralContext.toLowerCase().includes(fw)) {
      criteria.push({
        id: `spiral-${++idx}`,
        category: 'consistency',
        description: `Uses ${fw} (detected from project)`,
        check: 'dynamic',
        severity: 'warning',
        autofix: true,
      });
      break;
    }
  }

  // Detect color patterns (hex codes)
  const colors = spiralContext.match(/#[0-9a-fA-F]{3,8}/g);
  if (colors && colors.length > 0) {
    const uniqueColors = [...new Set(colors)].slice(0, 3);
    criteria.push({
      id: `spiral-${++idx}`,
      category: 'consistency',
      description: `Project colors: ${uniqueColors.join(', ')}`,
      check: 'dynamic',
      severity: 'info',
      autofix: true,
    });
  }

  // Detect naming conventions
  if (spiralContext.includes('camelCase') || spiralContext.match(/[a-z][A-Z]/)) {
    criteria.push({
      id: `spiral-${++idx}`,
      category: 'consistency',
      description: 'Follow camelCase naming convention',
      check: 'dynamic',
      severity: 'info',
      autofix: true,
    });
  }

  return criteria;
}
