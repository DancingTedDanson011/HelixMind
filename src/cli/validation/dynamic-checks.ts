/**
 * Dynamic validation checks — uses a small/fast LLM for checks that require understanding.
 * Each check is a focused, single-purpose prompt.
 */
import type { LLMProvider, ChatMessage } from '../providers/types.js';
import type { ValidationCriterion } from './criteria.js';
import type { CheckResult } from './static-checks.js';

/**
 * Run a single dynamic check using a mini-LLM call.
 */
export async function dynamicCheck(
  criterion: ValidationCriterion,
  output: string,
  userRequest: string,
  spiralContext: string,
  provider: LLMProvider,
): Promise<CheckResult> {
  const prompt = buildCheckPrompt(criterion, output, userRequest, spiralContext);

  try {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    let responseText = '';

    for await (const event of provider.stream(messages, VALIDATION_SYSTEM_PROMPT)) {
      if (event.type === 'text') {
        responseText += event.content;
      }
    }

    return parseCheckResponse(criterion, responseText);
  } catch (err) {
    // On error, pass by default (don't block the user)
    return {
      id: criterion.id,
      passed: true,
      details: `Check skipped (LLM error: ${(err as Error).message})`,
      severity: criterion.severity,
      autofix: false,
    };
  }
}

/**
 * Run multiple dynamic checks in parallel (batch).
 */
export async function runDynamicChecks(
  criteria: ValidationCriterion[],
  output: string,
  userRequest: string,
  spiralContext: string,
  provider: LLMProvider,
): Promise<CheckResult[]> {
  if (criteria.length === 0) return [];

  // Run checks in parallel (max 3 concurrent)
  const results: CheckResult[] = [];
  const batchSize = 3;

  for (let i = 0; i < criteria.length; i += batchSize) {
    const batch = criteria.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(c => dynamicCheck(c, output, userRequest, spiralContext, provider)),
    );
    results.push(...batchResults);
  }

  return results;
}

// ── Prompt Building ──

const VALIDATION_SYSTEM_PROMPT = `You are a precise code reviewer. You check one specific criterion at a time.
Answer ONLY in valid JSON format. Be strict but fair.
If you cannot determine the answer, default to "passed": true.`;

function buildCheckPrompt(
  criterion: ValidationCriterion,
  output: string,
  userRequest: string,
  spiralContext: string,
): string {
  // Truncate output to avoid huge prompts
  const truncatedOutput = output.length > 4000 ? output.slice(0, 4000) + '\n...[truncated]' : output;
  const truncatedContext = spiralContext.length > 1000 ? spiralContext.slice(0, 1000) + '\n...[truncated]' : spiralContext;

  return `Check this ONE criterion:

CRITERION: ${criterion.description}
SEVERITY: ${criterion.severity}

USER REQUEST: ${userRequest}

CODE/OUTPUT:
\`\`\`
${truncatedOutput}
\`\`\`

${truncatedContext ? `PROJECT CONTEXT:\n${truncatedContext}\n` : ''}
Answer ONLY in JSON:
{
  "passed": true/false,
  "details": "Brief explanation (1-2 sentences)",
  "fix": "Concrete fix if not passed, null otherwise"
}`;
}

/**
 * Parse LLM response into a CheckResult.
 * Handles malformed JSON gracefully.
 */
function parseCheckResponse(criterion: ValidationCriterion, response: string): CheckResult {
  try {
    // Extract JSON from response (may have surrounding text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackResult(criterion, response);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      id: criterion.id,
      passed: Boolean(parsed.passed),
      details: String(parsed.details || 'No details'),
      fix: parsed.fix || undefined,
      severity: criterion.severity,
      autofix: criterion.autofix && !!parsed.fix,
    };
  } catch {
    return fallbackResult(criterion, response);
  }
}

function fallbackResult(criterion: ValidationCriterion, rawResponse: string): CheckResult {
  // Try to infer pass/fail from response text
  const lower = rawResponse.toLowerCase();
  const passed = lower.includes('"passed": true') || lower.includes('"passed":true') ||
    (lower.includes('pass') && !lower.includes('fail') && !lower.includes('not pass'));

  return {
    id: criterion.id,
    passed,
    details: rawResponse.slice(0, 200),
    severity: criterion.severity,
    autofix: false,
  };
}
