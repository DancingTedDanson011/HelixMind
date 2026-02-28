import type { BugEvidence } from './types.js';

export interface DetectionResult {
  isBug: boolean;
  description: string;
  file?: string;
  line?: number;
  evidence: BugEvidence[];
}

// Bug indicator keywords — DE + EN
const BUG_KEYWORDS_DE = [
  'bug', 'fehler', 'funktioniert nicht', 'kaputt', 'geht nicht',
  'absturz', 'crashed', 'hängt', 'falsch', 'defekt',
  'broken', 'stimmt nicht', 'klappt nicht', 'problem',
];

const BUG_KEYWORDS_EN = [
  'bug', 'error', 'broken', 'crash', 'crashed', 'crashing',
  'fix', "doesn't work", 'not working', 'fails', 'failing',
  'wrong', 'issue', 'problem', 'exception', 'throws',
];

// Patterns that strongly indicate a bug report vs. general coding discussion
const STRONG_BUG_PATTERNS = [
  // "X doesn't work" / "X funktioniert nicht" / "not working"
  /(?:funktioniert|geht|klappt|works?)\s+(?:nicht|not)/i,
  /(?:doesn[''\u2019]t|does\s+not|don[''\u2019]t)\s+work/i,
  /\bnot\s+working\b/i,
  // "there is a bug/error in X"
  /(?:es gibt|there is|there[''\u2019]s|ich hab|i have|i got)\s+(?:ein(?:en?)?\s+)?(?:bug|fehler|error|problem|issue)/i,
  // "X crashes" / "X stürzt ab"
  /(?:crash(?:es|ed|ing)?|st\u00FCrzt?\s+ab|abgest\u00FCrzt)/i,
  // "X throws an error/exception"
  /(?:throws?|wirft)\s+(?:an?\s+)?(?:error|exception|fehler)/i,
  // "X is broken"
  /(?:is|ist)\s+(?:broken|kaputt|defekt)/i,
  // "fix the/this/X"
  /\bfix\s+(?:the|this|das|den|die|diesen?)\b/i,
  // "X fails" / "X failing"
  /\bfails?\b.*\b(?:when|on|at|during|while)\b/i,
];

// Patterns to extract file references
const FILE_PATTERNS = [
  // file.ts:42 or src/path/file.ts:42
  /(?:^|\s|[(`])([a-zA-Z0-9_./-]+\.[a-zA-Z]{1,6})(?::(\d+))?/g,
  // "in file X" / "in der Datei X"
  /(?:in\s+(?:file|der\s+datei)\s+)([a-zA-Z0-9_./-]+\.[a-zA-Z]{1,6})(?:\s+(?:line|zeile)\s+(\d+))?/gi,
];

// Stack trace patterns
const STACK_TRACE_PATTERN = /(?:at\s+.+\(.+:\d+:\d+\)|^\s+at\s+.+$|Error:.*\n\s+at)/m;

/**
 * Detect if a user message is reporting a bug.
 * Returns detection result with extracted metadata.
 */
export function detectBugReport(message: string): DetectionResult {
  const lower = message.toLowerCase();
  const evidence: BugEvidence[] = [];

  // Check for strong bug patterns first
  const hasStrongPattern = STRONG_BUG_PATTERNS.some(p => p.test(message));

  // Check for keyword matches
  const allKeywords = [...BUG_KEYWORDS_DE, ...BUG_KEYWORDS_EN];
  const matchedKeywords = allKeywords.filter(kw => lower.includes(kw));

  // Need at least one strong pattern, or 2+ keyword matches
  const isBug = hasStrongPattern || matchedKeywords.length >= 2;

  if (!isBug) {
    return { isBug: false, description: '', evidence: [] };
  }

  // Extract file references
  let file: string | undefined;
  let line: number | undefined;

  for (const pattern of FILE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(message);
    if (match) {
      const candidate = match[1];
      // Filter out URLs and very short extensions
      if (!candidate.startsWith('http') && !candidate.startsWith('//')) {
        file = candidate;
        if (match[2]) line = parseInt(match[2], 10);
        break;
      }
    }
  }

  // Extract stack traces as evidence
  if (STACK_TRACE_PATTERN.test(message)) {
    evidence.push({
      type: 'stack_trace',
      content: message.slice(0, 500),
      timestamp: Date.now(),
    });
  }

  // Add the user report as evidence
  evidence.push({
    type: 'user_report',
    content: message.slice(0, 300),
    timestamp: Date.now(),
  });

  // Build a concise description from the message
  const description = buildDescription(message);

  return { isBug: true, description, file, line, evidence };
}

/**
 * Build a concise bug description from a user message.
 * Takes the first sentence or first 120 chars.
 */
function buildDescription(message: string): string {
  // Try to get the first sentence
  const sentenceMatch = message.match(/^[^.!?\n]+[.!?]/);
  if (sentenceMatch && sentenceMatch[0].length <= 150) {
    return sentenceMatch[0].trim();
  }

  // Fallback: first 120 chars
  const cleaned = message.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 120) return cleaned;
  return cleaned.slice(0, 117) + '...';
}
