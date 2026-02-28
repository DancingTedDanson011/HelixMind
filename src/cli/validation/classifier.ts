/**
 * Task Classification — Phase 1 of the Validation Matrix.
 * Analyzes user messages to determine task type, complexity, and output type.
 */

export type TaskCategory =
  | 'ui_component'
  | 'api_endpoint'
  | 'data_processing'
  | 'refactoring'
  | 'bug_fix'
  | 'configuration'
  | 'documentation'
  | 'testing'
  | 'architecture'
  | 'general_code'
  | 'chat_only';

export type Complexity = 'trivial' | 'simple' | 'medium' | 'complex';
export type OutputType = 'code' | 'file' | 'multi_file' | 'text' | 'mixed';

export interface TaskClassification {
  category: TaskCategory;
  complexity: Complexity;
  outputType: OutputType;
}

// ── Category detection patterns ──

interface CategoryPattern {
  category: TaskCategory;
  keywords: string[];
  weight: number;
}

const CATEGORY_PATTERNS: CategoryPattern[] = [
  {
    category: 'ui_component',
    keywords: ['html', 'css', 'react', 'component', 'button', 'navbar', 'modal', 'form', 'layout', 'page', 'ui', 'frontend', 'tailwind', 'style', 'responsive', 'div', 'flex', 'grid', 'svg', 'icon', 'dark-theme', 'dark mode', 'animation', 'hover'],
    weight: 1,
  },
  {
    category: 'api_endpoint',
    keywords: ['api', 'endpoint', 'route', 'rest', 'graphql', 'server', 'express', 'fastify', 'nest', 'middleware', 'request', 'response', 'post', 'get', 'put', 'delete', 'fetch', 'axios', 'cors', 'webhook', 'socket'],
    weight: 1,
  },
  {
    category: 'data_processing',
    keywords: ['parse', 'transform', 'etl', 'csv', 'json', 'xml', 'data', 'pipeline', 'stream', 'batch', 'aggregate', 'filter', 'map', 'reduce', 'sort', 'convert', 'migration', 'import', 'export'],
    weight: 1,
  },
  {
    category: 'refactoring',
    keywords: ['refactor', 'rename', 'extract', 'move', 'split', 'merge', 'cleanup', 'simplify', 'restructure', 'reorganize', 'decouple', 'abstract', 'consolidate', 'umbauen', 'aufräumen'],
    weight: 1.2,
  },
  {
    category: 'bug_fix',
    keywords: ['bug', 'fix', 'error', 'crash', 'broken', 'failing', 'wrong', 'incorrect', 'issue', 'problem', 'doesn\'t work', 'nicht', 'fehler', 'funktioniert nicht', 'kaputt', 'undefined', 'null', 'exception', 'TypeError', 'ReferenceError'],
    weight: 1.3,
  },
  {
    category: 'configuration',
    keywords: ['config', 'setup', 'install', 'deploy', 'docker', 'kubernetes', 'ci', 'cd', 'env', 'environment', 'nginx', 'webpack', 'vite', 'tsconfig', 'eslint', 'prettier', 'package.json', 'yml', 'yaml', 'toml'],
    weight: 1,
  },
  {
    category: 'documentation',
    keywords: ['readme', 'docs', 'documentation', 'comment', 'jsdoc', 'changelog', 'guide', 'tutorial', 'explain', 'describe', 'beschreib', 'erklär', 'doku'],
    weight: 1.2,
  },
  {
    category: 'testing',
    keywords: ['test', 'spec', 'jest', 'vitest', 'mocha', 'cypress', 'playwright', 'e2e', 'unit test', 'integration test', 'mock', 'stub', 'assert', 'expect', 'coverage', 'testen'],
    weight: 1.1,
  },
  {
    category: 'architecture',
    keywords: ['architecture', 'design', 'pattern', 'structure', 'folder', 'module', 'dependency', 'circular', 'layer', 'separation', 'monorepo', 'microservice', 'architektur', 'struktur'],
    weight: 1,
  },
  {
    category: 'general_code',
    keywords: ['function', 'class', 'implement', 'create', 'build', 'write', 'add', 'feature', 'method', 'algorithm', 'logic', 'code', 'script', 'module', 'baue', 'implementiere', 'erstelle', 'schreib'],
    weight: 0.8,
  },
];

// Words that indicate "just talking, no code output"
const CHAT_ONLY_PATTERNS = [
  /^(was|wer|wie|wo|warum|wann|welch)\s/i,
  /^(what|who|how|where|why|when|which)\s/i,
  /\?(s*)$/,
  /^(erkl[äa]r|explain|describe|beschreib)\s+(mir\s+)?(was|wie|warum)/i,
  /^(kannst du|can you|could you)\s+(mir\s+)?(erkl[äa]r|explain|tell)/i,
  /^(danke|thanks|thx|ok|gut|nice|cool|perfekt)/i,
  /^(ja|nein|yes|no)\s*$/i,
];

/**
 * Classify a user message into a task category, complexity, and output type.
 */
export function classifyTask(userMessage: string): TaskClassification {
  const lower = userMessage.toLowerCase();

  // Check for chat-only first
  if (isChatOnly(lower, userMessage)) {
    return { category: 'chat_only', complexity: 'trivial', outputType: 'text' };
  }

  // Score each category
  const scores = new Map<TaskCategory, number>();

  for (const pattern of CATEGORY_PATTERNS) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      if (lower.includes(keyword)) {
        score += pattern.weight;
      }
    }
    if (score > 0) {
      scores.set(pattern.category, score);
    }
  }

  // Pick highest scoring category
  let bestCategory: TaskCategory = 'general_code';
  let bestScore = 0;

  for (const [cat, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  // If no matches at all, check if it looks like code or chat
  if (bestScore === 0) {
    if (looksLikeCodeRequest(lower)) {
      bestCategory = 'general_code';
    } else {
      bestCategory = 'chat_only';
    }
  }

  const complexity = estimateComplexity(userMessage, bestCategory);
  const outputType = inferOutputType(bestCategory, userMessage);

  return { category: bestCategory, complexity, outputType };
}

function isChatOnly(lower: string, original: string): boolean {
  // Very short messages that are just questions
  if (original.length < 20 && original.includes('?')) return true;

  // Matches chat-only patterns
  for (const pattern of CHAT_ONLY_PATTERNS) {
    if (pattern.test(original)) return true;
  }

  // No code-related words at all
  const codeWords = [
    'code', 'file', 'function', 'class', 'fix', 'bug', 'create', 'build', 'add',
    'implement', 'write', 'edit', 'change', 'update', 'delete', 'remove', 'test',
    'baue', 'erstelle', 'schreib', 'ändere', 'setup', 'config', 'deploy', 'refactor',
    'component', 'module', 'api', 'endpoint', 'route', 'design', 'architecture',
    'structure', 'layer', 'dependency', 'documentation', 'readme', 'docs', 'doku',
    'parse', 'transform', 'migration', 'script', 'feature', 'navbar', 'button',
    'page', 'template', 'style', 'css', 'html', 'react', 'vue', 'angular',
    'fehler', 'kaputt', 'funktioniert', 'login', 'server', 'database', 'query',
  ];
  return !codeWords.some(w => lower.includes(w));
}

function looksLikeCodeRequest(lower: string): boolean {
  const codeIndicators = ['implement', 'create', 'build', 'write', 'add', 'function', 'class', 'module', 'file', 'baue', 'erstelle', 'schreib', 'mach', 'füg'];
  return codeIndicators.some(w => lower.includes(w));
}

function estimateComplexity(message: string, category: TaskCategory): Complexity {
  const words = message.split(/\s+/).length;

  // Complexity indicators
  const complexWords = ['multiple', 'several', 'complex', 'advanced', 'integrate', 'migration', 'architecture', 'system', 'pipeline', 'workflow', 'komplex', 'mehrere', 'system'];
  const complexCount = complexWords.filter(w => message.toLowerCase().includes(w)).length;

  // File count indicators
  const fileIndicators = message.match(/\b\d+\s*(files?|datei)/gi);
  const fileCount = fileIndicators ? parseInt(fileIndicators[0]) : 0;

  if (category === 'chat_only') return 'trivial';

  if (words < 10 && complexCount === 0) return 'trivial';
  if (words < 30 && complexCount === 0 && fileCount <= 1) return 'simple';
  if (complexCount >= 2 || fileCount > 3 || words > 100) return 'complex';
  return 'medium';
}

function inferOutputType(category: TaskCategory, message: string): OutputType {
  if (category === 'chat_only') return 'text';
  if (category === 'documentation') return 'text';

  // Multi-file indicators
  const multiIndicators = ['files', 'module', 'package', 'components', 'migration', 'mehrere', 'dateien'];
  if (multiIndicators.some(w => message.toLowerCase().includes(w))) return 'multi_file';

  // Single file categories
  if (category === 'configuration') return 'file';
  if (category === 'testing') return 'file';

  // Mixed (code + explanation)
  if (category === 'bug_fix' || category === 'architecture') return 'mixed';

  return 'code';
}
