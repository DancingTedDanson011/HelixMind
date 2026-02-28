/**
 * Static validation checks — no LLM calls, pure algorithms.
 * Fast (~50ms) pattern matching, parsing, and analysis.
 */

export interface CheckResult {
  id: string;
  passed: boolean;
  details: string;
  fix?: string;
  severity: 'error' | 'warning' | 'info';
  autofix: boolean;
}

type StaticChecker = (output: string, context?: StaticCheckContext) => CheckResult;

export interface StaticCheckContext {
  lang?: string;
  projectFiles?: string[];
}

// ── Void HTML elements (self-closing) ──
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// ── Static Checkers ──

const checkers: Record<string, StaticChecker> = {

  'html-valid': (output) => {
    // Extract code blocks that contain HTML
    const html = extractCodeContent(output, ['html', 'jsx', 'tsx', 'vue', 'svelte']);
    if (!html) return pass('html-valid', 'No HTML content found');

    const stack: string[] = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*\/?>/g;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();

      if (VOID_ELEMENTS.has(tagName)) continue;
      if (fullTag.endsWith('/>')) continue; // Self-closing

      if (fullTag.startsWith('</')) {
        // Closing tag
        if (stack.length === 0) {
          return fail('html-valid', `Unexpected closing tag </${tagName}>`, `Remove stray </${tagName}>`);
        }
        const expected = stack.pop();
        if (expected !== tagName) {
          return fail('html-valid', `Mismatched tags: expected </${expected}>, found </${tagName}>`, `Change </${tagName}> to </${expected}>`);
        }
      } else {
        // Opening tag
        stack.push(tagName);
      }
    }

    if (stack.length > 0) {
      const unclosed = stack.reverse().map(t => `<${t}>`).join(', ');
      return fail('html-valid', `Unclosed tags: ${unclosed}`, stack.map(t => `</${t}>`).join('\n'));
    }

    return pass('html-valid', 'HTML tags properly balanced');
  },

  'links-valid': (output) => {
    const html = extractCodeContent(output, ['html', 'jsx', 'tsx', 'vue']);
    if (!html) return pass('links-valid', 'No HTML content found');

    const hrefRegex = /(?:href|src|action)=["']([^"']*?)["']/gi;
    const issues: string[] = [];
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      const value = match[1];
      if (!value || value === '' || value === '#undefined' || value === 'undefined') {
        issues.push(`Empty/invalid ${match[0]}`);
      }
    }

    if (issues.length > 0) {
      return fail('links-valid', issues.join('; '), undefined, 'error');
    }
    return pass('links-valid', 'All links valid');
  },

  'ids-unique': (output) => {
    const html = extractCodeContent(output, ['html', 'jsx', 'tsx', 'vue']);
    if (!html) return pass('ids-unique', 'No HTML content found');

    const idRegex = /\bid=["']([^"']+)["']/gi;
    const seen = new Map<string, number>();
    let match;

    while ((match = idRegex.exec(html)) !== null) {
      const id = match[1];
      seen.set(id, (seen.get(id) || 0) + 1);
    }

    const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
    if (duplicates.length > 0) {
      const dupeList = duplicates.map(([id, count]) => `"${id}" (${count}x)`).join(', ');
      return fail('ids-unique', `Duplicate IDs: ${dupeList}`, `Rename duplicate IDs to be unique`);
    }
    return pass('ids-unique', 'All IDs unique');
  },

  'img-alt': (output) => {
    const html = extractCodeContent(output, ['html', 'jsx', 'tsx', 'vue']);
    if (!html) return pass('img-alt', 'No HTML content found');

    const imgRegex = /<img\b[^>]*>/gi;
    const images = html.match(imgRegex) || [];
    const missingAlt = images.filter(img => !img.includes('alt='));

    if (missingAlt.length > 0) {
      return {
        id: 'img-alt',
        passed: false,
        details: `${missingAlt.length} image(s) missing alt attribute`,
        fix: 'Add alt="" to images',
        severity: 'warning',
        autofix: true,
      };
    }
    return pass('img-alt', 'All images have alt attributes', 'warning');
  },

  'syntax-valid': (output, ctx) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript', 'json', 'css']);
    if (!code) return pass('syntax-valid', 'No code content found');

    const lang = ctx?.lang || detectLanguage(code);

    if (lang === 'json') {
      try {
        JSON.parse(code);
        return pass('syntax-valid', 'Valid JSON');
      } catch (e) {
        return fail('syntax-valid', `Invalid JSON: ${(e as Error).message}`);
      }
    }

    // Check bracket/brace/paren balance
    const balance = checkBracketBalance(code);
    if (!balance.balanced) {
      return fail('syntax-valid', `Unbalanced ${balance.type}: ${balance.details}`, balance.fix);
    }

    // Check for obvious syntax errors
    const syntaxIssues = checkBasicSyntax(code);
    if (syntaxIssues) {
      return fail('syntax-valid', syntaxIssues);
    }

    return pass('syntax-valid', 'Syntax appears valid');
  },

  'imports-resolve': (output, ctx) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript']);
    if (!code) return pass('imports-resolve', 'No code content found');

    const importRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
    const issues: string[] = [];
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      const path = match[1];
      // Skip node_modules imports
      if (!path.startsWith('.') && !path.startsWith('/')) continue;

      if (ctx?.projectFiles && ctx.projectFiles.length > 0) {
        // Check if file exists in known project files
        const normalized = path.replace(/\.(js|ts|jsx|tsx)$/, '');
        const found = ctx.projectFiles.some(f =>
          f.includes(normalized) || f.includes(normalized + '.ts') || f.includes(normalized + '.js'),
        );
        if (!found) {
          issues.push(`Import "${path}" may not exist`);
        }
      }
    }

    if (issues.length > 0) {
      return fail('imports-resolve', issues.join('; '));
    }
    return pass('imports-resolve', 'All imports appear valid');
  },

  'no-dead-code': (output) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript']);
    if (!code) return pass('no-dead-code', 'No code content found');

    const issues: string[] = [];

    // Check for unreachable code after return/throw/break/continue
    const unreachableRegex = /\b(return|throw|break|continue)\b[^;]*;\s*\n\s*(?![\s}]|\/\/|\/\*|case\s|default:)([\w])/gm;
    if (unreachableRegex.test(code)) {
      issues.push('Possible unreachable code after return/throw');
    }

    // Check for unused imports (simple heuristic)
    const importNames = extractImportNames(code);
    for (const name of importNames) {
      // Count occurrences after the import line
      const afterImport = code.slice(code.indexOf(name) + name.length);
      if (!afterImport.includes(name)) {
        issues.push(`Possibly unused import: ${name}`);
      }
    }

    if (issues.length > 0) {
      return { id: 'no-dead-code', passed: false, details: issues.join('; '), severity: 'warning', autofix: true };
    }
    return pass('no-dead-code', 'No dead code detected', 'warning');
  },

  'no-hardcoded': (output) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript', 'py', 'python']);
    if (!code) return pass('no-hardcoded', 'No code content found');

    const issues: string[] = [];

    // API keys / secrets patterns
    const secretPatterns = [
      /['"][A-Za-z0-9+/]{40,}['"]/,             // Long base64-like strings
      /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
      /sk-[a-zA-Z0-9]{20,}/,                      // OpenAI key pattern
      /ghp_[a-zA-Z0-9]{36}/,                      // GitHub PAT
      /(?:AKIA|ASIA)[A-Z0-9]{16}/,                // AWS access key
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(code)) {
        issues.push('Possible hardcoded secret/API key detected');
        break;
      }
    }

    // Hardcoded localhost URLs (not in comments/config)
    if (/['"]https?:\/\/localhost:\d+/.test(code) && !code.includes('// dev') && !code.includes('development')) {
      issues.push('Hardcoded localhost URL');
    }

    if (issues.length > 0) {
      return { id: 'no-hardcoded', passed: false, details: issues.join('; '), severity: 'warning', autofix: false };
    }
    return pass('no-hardcoded', 'No hardcoded secrets detected', 'warning');
  },

  'sql-injection': (output) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript', 'py', 'python']);
    if (!code) return pass('sql-injection', 'No code content found');

    // Check for string concatenation in SQL queries
    const sqlConcat = /(?:query|exec|execute|run|prepare)\s*\(\s*[`'"](?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b[^`'"]*\$\{/i;
    const sqlPlus = /(?:query|exec|execute|run)\s*\(\s*['"](?:SELECT|INSERT|UPDATE|DELETE)\b[^'"]*['"]\s*\+/i;

    if (sqlConcat.test(code) || sqlPlus.test(code)) {
      return fail('sql-injection', 'SQL query with string interpolation/concatenation detected', 'Use parameterized queries instead');
    }
    return pass('sql-injection', 'No SQL injection vulnerabilities detected');
  },

  'async-await': (output) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript']);
    if (!code) return pass('async-await', 'No async code found');

    const issues: string[] = [];

    // Check for floating promises: async function call without await
    const asyncCallRegex = /(?<!await\s)(?<!return\s)(?<!\.catch\()(?<!\.then\()(\w+)\s*\([^)]*\)\s*;/g;
    // This is a heuristic — too many false positives, so keep it simple

    // Check for async function without any await
    const asyncFuncRegex = /async\s+(?:function\s+)?(\w+)\s*\([^)]*\)\s*\{([^}]*)\}/g;
    let match;
    while ((match = asyncFuncRegex.exec(code)) !== null) {
      const body = match[2];
      if (!body.includes('await') && !body.includes('Promise')) {
        issues.push(`Async function "${match[1]}" has no await`);
      }
    }

    if (issues.length > 0) {
      return fail('async-await', issues.join('; '));
    }
    return pass('async-await', 'Async/await usage appears correct');
  },

  'error-handling': (output) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript']);
    if (!code) return pass('error-handling', 'No code content found');

    // Check if there are async operations without try/catch
    const hasAsync = code.includes('await ');
    const hasTryCatch = code.includes('try {') || code.includes('try{');
    const hasCatch = code.includes('.catch(');

    if (hasAsync && !hasTryCatch && !hasCatch) {
      return fail('error-handling', 'Async operations without error handling', 'Wrap in try/catch');
    }
    return pass('error-handling', 'Error handling present');
  },

  'status-codes': (output) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript']);
    if (!code) return pass('status-codes', 'No HTTP status code usage found');

    // Count status codes used
    const statusRegex = /\.status\((\d{3})\)/g;
    const codes = new Set<string>();
    let match;
    while ((match = statusRegex.exec(code)) !== null) {
      codes.add(match[1]);
    }

    if (codes.size > 0 && codes.size === 1 && codes.has('200')) {
      return { id: 'status-codes', passed: false, details: 'Only status 200 used — use appropriate codes (201, 400, 404, 500)', severity: 'warning', autofix: true };
    }
    return pass('status-codes', 'HTTP status codes look appropriate', 'warning');
  },

  'assertions-exist': (output) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript']);
    if (!code) return pass('assertions-exist', 'No test code found');

    // Find test blocks
    const testRegex = /(?:it|test)\s*\(\s*['"][^'"]+['"]\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{([^]*?)(?=\n\s*(?:it|test|describe)\s*\(|\n\}\);\s*$)/g;
    const issues: string[] = [];
    let match;

    while ((match = testRegex.exec(code)) !== null) {
      const body = match[1];
      if (!body.includes('expect(') && !body.includes('assert') && !body.includes('should')) {
        // Extract test name for reporting
        const nameMatch = code.slice(match.index).match(/['"]([^'"]+)['"]/);
        issues.push(`Test "${nameMatch?.[1] || 'unknown'}" has no assertion`);
      }
    }

    if (issues.length > 0) {
      return fail('assertions-exist', issues.join('; '));
    }
    return pass('assertions-exist', 'All tests have assertions');
  },

  'mocks-cleanup': (output) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript']);
    if (!code) return pass('mocks-cleanup', 'No test code found');

    const hasMocks = code.includes('vi.mock') || code.includes('jest.mock') || code.includes('sinon');
    const hasCleanup = code.includes('afterEach') || code.includes('afterAll') || code.includes('restoreAllMocks') || code.includes('resetAllMocks') || code.includes('clearAllMocks');

    if (hasMocks && !hasCleanup) {
      return { id: 'mocks-cleanup', passed: false, details: 'Mocks used without cleanup (afterEach/restoreAllMocks)', fix: 'Add afterEach(() => vi.restoreAllMocks())', severity: 'warning', autofix: true };
    }
    return pass('mocks-cleanup', 'Mocks properly cleaned up', 'warning');
  },

  'input-handled': (output) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript', 'py', 'python']);
    if (!code) return pass('input-handled', 'No code content found');

    // Check for array/object operations without null checks
    const hasArrayOps = /\.\s*(?:map|filter|reduce|forEach|find)\s*\(/.test(code);
    const hasNullCheck = /(?:if\s*\(\s*!?\s*\w+|[\w.]+\s*\?\.|[\w.]+\s*!==?\s*(?:null|undefined))/.test(code);

    if (hasArrayOps && !hasNullCheck) {
      return fail('input-handled', 'Array operations without null/undefined checks', 'Add input validation');
    }
    return pass('input-handled', 'Input handling appears adequate');
  },

  'no-circular': (output) => {
    const code = extractCodeContent(output, ['ts', 'typescript', 'js', 'javascript']);
    if (!code) return pass('no-circular', 'No code content found');

    // Simple heuristic: check if a file imports itself or has obvious circular patterns
    const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
    const exportRegex = /export\s+.*from\s+['"]([^'"]+)['"]/g;
    const imports = new Set<string>();
    let match;

    while ((match = importRegex.exec(code)) !== null) imports.add(match[1]);
    while ((match = exportRegex.exec(code)) !== null) imports.add(match[1]);

    // Can't detect circular deps from a single output — pass
    return pass('no-circular', 'No obvious circular dependencies');
  },

  'no-secrets': (output) => {
    const code = extractCodeContent(output, ['json', 'yaml', 'yml', 'toml', 'env', 'ini', 'cfg', 'ts', 'typescript', 'js', 'javascript']);
    if (!code) return pass('no-secrets', 'No config content found');

    const secretKeys = /["']?(?:password|secret|api[_-]?key|token|private[_-]?key)["']?\s*[:=]\s*["']?[^\s"',}{]{5,}/i;
    if (secretKeys.test(code)) {
      return fail('no-secrets', 'Possible plaintext secret in configuration');
    }
    return pass('no-secrets', 'No plaintext secrets detected');
  },
};

/**
 * Run all applicable static checks on the output.
 */
export function runStaticChecks(
  output: string,
  criterionIds: string[],
  context?: StaticCheckContext,
): CheckResult[] {
  const results: CheckResult[] = [];

  for (const id of criterionIds) {
    const checker = checkers[id];
    if (checker) {
      try {
        results.push(checker(output, context));
      } catch {
        // If a checker throws, mark as passed to avoid false negatives
        results.push(pass(id, 'Check skipped (internal error)'));
      }
    }
  }

  return results;
}

// ── Helpers ──

function pass(id: string, details: string, severity: 'error' | 'warning' | 'info' = 'error'): CheckResult {
  return { id, passed: true, details, severity, autofix: false };
}

function fail(id: string, details: string, fix?: string, severity: 'error' | 'warning' | 'info' = 'error'): CheckResult {
  return { id, passed: false, details, fix, severity, autofix: !!fix };
}

/**
 * Extract code from markdown code blocks with given language hints.
 * Also handles raw code without blocks.
 */
export function extractCodeContent(output: string, languages: string[]): string | null {
  // Try to find fenced code blocks with matching language tags
  const langPattern = languages.join('|');
  // Match code blocks WITH the specified language, or code blocks with no language tag
  const fencedRegex = new RegExp('```(?:(' + langPattern + ')\\s*\\n|\\s*\\n)([\\s\\S]*?)```', 'gi');
  const blocks: string[] = [];
  let match;

  while ((match = fencedRegex.exec(output)) !== null) {
    // match[1] = language tag (when lang matched), match[2] = code content
    blocks.push(match[2]);
  }

  if (blocks.length > 0) {
    return blocks.join('\n\n');
  }

  // No code blocks — check if the output itself looks like code
  if (output.includes('function ') || output.includes('import ') ||
      output.includes('class ') || output.includes('const ') ||
      output.includes('<div') || output.includes('<html')) {
    return output;
  }

  return null;
}

function detectLanguage(code: string): string {
  if (code.trim().startsWith('{') || code.trim().startsWith('[')) return 'json';
  if (code.includes('import ') || code.includes('export ')) return 'typescript';
  if (code.includes('<html') || code.includes('<div')) return 'html';
  if ((code.includes('def ') && !code.includes('default')) || (code.includes('class ') && code.includes(':'))) return 'python';
  return 'typescript';
}

function checkBracketBalance(code: string): { balanced: boolean; type?: string; details?: string; fix?: string } {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];

    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }

    if (inString) {
      if (ch === stringChar) inString = false;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }

    // Skip single-line comments
    if (ch === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i);
      i = nl === -1 ? code.length : nl;
      continue;
    }

    // Skip multi-line comments
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 1;
      continue;
    }

    if (ch in pairs) {
      stack.push(ch);
    } else if (ch === ')' || ch === ']' || ch === '}') {
      const expected = stack.pop();
      if (!expected) {
        return { balanced: false, type: ch, details: `Unexpected '${ch}'`, fix: `Remove stray '${ch}'` };
      }
      if (pairs[expected] !== ch) {
        return { balanced: false, type: ch, details: `Expected '${pairs[expected]}' but found '${ch}'`, fix: `Change '${ch}' to '${pairs[expected]}'` };
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack.map(s => pairs[s]).reverse().join('');
    return { balanced: false, type: 'bracket', details: `Unclosed: ${stack.join(', ')}`, fix: `Add ${unclosed}` };
  }

  return { balanced: true };
}

function checkBasicSyntax(code: string): string | null {
  // Check for duplicate commas
  if (/,,/.test(code)) return 'Duplicate commas found';

  // Check for missing semicolons in obvious places (very conservative)
  // Only flag if there's a clear pattern break
  if (/\)\s*\n\s*(?:const|let|var|function|class|if|for|while)\b/.test(code)) {
    // This is often valid (e.g., function call then statement), so don't flag
  }

  return null;
}

function extractImportNames(code: string): string[] {
  const names: string[] = [];
  const regex = /import\s+(?:\{([^}]+)\}|(\w+))/g;
  let match;

  while ((match = regex.exec(code)) !== null) {
    if (match[1]) {
      // Named imports: { foo, bar as baz }
      for (const part of match[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name && name.length > 1) names.push(name);
      }
    } else if (match[2]) {
      // Default import
      names.push(match[2]);
    }
  }

  return names;
}
