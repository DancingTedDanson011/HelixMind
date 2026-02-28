import type { ReadFile } from './reader.js';

export interface ParsedExport {
  name: string;
  kind: 'function' | 'class' | 'type' | 'interface' | 'const' | 'enum' | 'default';
  line: number;
}

export interface ParsedImport {
  source: string;       // The module imported from
  specifiers: string[]; // Named imports
  isRelative: boolean;
}

export interface ParsedFile {
  relativePath: string;
  language: string;
  exports: ParsedExport[];
  imports: ParsedImport[];
  patterns: string[];
  todos: string[];
  lineCount: number;
  summary: string;
}

// Regex patterns for TypeScript/JavaScript
const TS_EXPORT_FUNCTION = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
const TS_EXPORT_CLASS = /^export\s+class\s+(\w+)/gm;
const TS_EXPORT_TYPE = /^export\s+type\s+(\w+)/gm;
const TS_EXPORT_INTERFACE = /^export\s+interface\s+(\w+)/gm;
const TS_EXPORT_CONST = /^export\s+const\s+(\w+)/gm;
const TS_EXPORT_ENUM = /^export\s+enum\s+(\w+)/gm;
const TS_EXPORT_DEFAULT = /^export\s+default\s+/gm;
const TS_IMPORT = /^import\s+(?:type\s+)?(?:(?:\{([^}]+)\}|(\w+))\s+from\s+)?['"]([\w@./:~\-]+)['"]/gm;

// Patterns detection
const PATTERN_MIDDLEWARE = /middleware|interceptor/i;
const PATTERN_HOOK = /^use[A-Z]\w+/;
const PATTERN_HOC = /^with[A-Z]\w+/;
const PATTERN_FACTORY = /create[A-Z]\w+|factory/i;
const PATTERN_SINGLETON = /getInstance|\.instance\b/i;

const TODO_PATTERN = /\/\/\s*(TODO|FIXME|HACK|XXX|BUG)[:.]?\s*(.*)/gi;

export function parseFiles(files: ReadFile[]): ParsedFile[] {
  return files.map(parseFile);
}

function parseFile(file: ReadFile): ParsedFile {
  const lines = file.content.split('\n');
  const exports: ParsedExport[] = [];
  const imports: ParsedImport[] = [];
  const patterns: string[] = [];
  const todos: string[] = [];

  if (file.language === 'typescript' || file.language === 'javascript') {
    parseTypeScriptExports(file.content, exports);
    parseTypeScriptImports(file.content, imports);
    detectPatterns(file.content, exports, patterns);
  } else if (file.language === 'python') {
    parsePythonExports(file.content, exports);
    parsePythonImports(file.content, imports);
  }

  // Extract TODOs from any language
  extractTodos(file.content, todos);

  return {
    relativePath: file.relativePath,
    language: file.language,
    exports,
    imports,
    patterns,
    todos,
    lineCount: lines.length,
    summary: buildFileSummary(file.relativePath, exports, imports, patterns, lines.length),
  };
}

function parseTypeScriptExports(content: string, exports: ParsedExport[]): void {
  const matchers: Array<[RegExp, ParsedExport['kind']]> = [
    [TS_EXPORT_FUNCTION, 'function'],
    [TS_EXPORT_CLASS, 'class'],
    [TS_EXPORT_TYPE, 'type'],
    [TS_EXPORT_INTERFACE, 'interface'],
    [TS_EXPORT_CONST, 'const'],
    [TS_EXPORT_ENUM, 'enum'],
  ];

  for (const [regex, kind] of matchers) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const line = content.slice(0, match.index).split('\n').length;
      exports.push({ name: match[1], kind, line });
    }
  }

  // Default export
  TS_EXPORT_DEFAULT.lastIndex = 0;
  if (TS_EXPORT_DEFAULT.test(content)) {
    exports.push({ name: 'default', kind: 'default', line: 0 });
  }
}

function parseTypeScriptImports(content: string, imports: ParsedImport[]): void {
  TS_IMPORT.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TS_IMPORT.exec(content)) !== null) {
    const namedImports = match[1];
    const defaultImport = match[2];
    const source = match[3];

    const specifiers: string[] = [];
    if (namedImports) {
      specifiers.push(...namedImports.split(',').map(s => s.trim()).filter(Boolean));
    }
    if (defaultImport) {
      specifiers.push(defaultImport);
    }

    imports.push({
      source,
      specifiers,
      isRelative: source.startsWith('.') || source.startsWith('/'),
    });
  }
}

function parsePythonExports(content: string, exports: ParsedExport[]): void {
  const defMatch = /^def\s+(\w+)/gm;
  const classMatch = /^class\s+(\w+)/gm;

  let match: RegExpExecArray | null;
  defMatch.lastIndex = 0;
  while ((match = defMatch.exec(content)) !== null) {
    const line = content.slice(0, match.index).split('\n').length;
    exports.push({ name: match[1], kind: 'function', line });
  }

  classMatch.lastIndex = 0;
  while ((match = classMatch.exec(content)) !== null) {
    const line = content.slice(0, match.index).split('\n').length;
    exports.push({ name: match[1], kind: 'class', line });
  }
}

function parsePythonImports(content: string, imports: ParsedImport[]): void {
  const importMatch = /^(?:from\s+(\S+)\s+import\s+(.+)|import\s+(\S+))/gm;
  let match: RegExpExecArray | null;
  importMatch.lastIndex = 0;
  while ((match = importMatch.exec(content)) !== null) {
    const source = match[1] ?? match[3];
    const specifiers = match[2]
      ? match[2].split(',').map(s => s.trim())
      : [source];
    imports.push({
      source,
      specifiers,
      isRelative: source.startsWith('.'),
    });
  }
}

function detectPatterns(content: string, exports: ParsedExport[], patterns: string[]): void {
  if (PATTERN_MIDDLEWARE.test(content)) patterns.push('middleware');
  if (PATTERN_SINGLETON.test(content)) patterns.push('singleton');

  let hasHook = false, hasHoc = false, hasFactory = false;
  for (const exp of exports) {
    if (!hasHook && PATTERN_HOOK.test(exp.name)) { patterns.push('hook'); hasHook = true; }
    if (!hasHoc && PATTERN_HOC.test(exp.name)) { patterns.push('hoc'); hasHoc = true; }
    if (!hasFactory && PATTERN_FACTORY.test(exp.name)) { patterns.push('factory'); hasFactory = true; }
  }
}

function extractTodos(content: string, todos: string[]): void {
  TODO_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TODO_PATTERN.exec(content)) !== null) {
    todos.push(`${match[1]}: ${match[2].trim()}`);
  }
}

function buildFileSummary(
  path: string,
  exports: ParsedExport[],
  imports: ParsedImport[],
  patterns: string[],
  lineCount: number,
): string {
  const parts: string[] = [`${path} (${lineCount} lines)`];

  if (exports.length > 0) {
    const exportNames = exports.slice(0, 8).map(e => `${e.kind} ${e.name}`);
    parts.push(`Exports: ${exportNames.join(', ')}`);
  }

  const externalDeps = imports.filter(i => !i.isRelative).map(i => i.source);
  if (externalDeps.length > 0) {
    parts.push(`External deps: ${externalDeps.slice(0, 5).join(', ')}`);
  }

  if (patterns.length > 0) {
    parts.push(`Patterns: ${patterns.join(', ')}`);
  }

  return parts.join(' | ');
}
