import { dirname, basename } from 'node:path';
import type { ParsedFile } from './parser.js';

export interface DetectedModule {
  name: string;
  files: string[];
  description: string;
  entryPoint?: string;
}

export interface AnalysisResult {
  modules: DetectedModule[];
  dependencyGraph: Map<string, string[]>; // file → files it imports
  architecture: string;
  techStack: string[];
  entryPoints: string[];
  summary: string;
}

export function analyzeCodebase(parsedFiles: ParsedFile[]): AnalysisResult {
  const depGraph = buildDependencyGraph(parsedFiles);
  const modules = detectModules(parsedFiles);
  const entryPoints = findEntryPoints(parsedFiles, depGraph);
  const architecture = detectArchitecture(parsedFiles, modules);
  const techStack = detectTechStack(parsedFiles);

  const summary = buildAnalysisSummary(parsedFiles, modules, entryPoints, architecture, techStack);

  return {
    modules,
    dependencyGraph: depGraph,
    architecture,
    techStack,
    entryPoints,
    summary,
  };
}

function buildDependencyGraph(files: ParsedFile[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const fileSet = new Set(files.map(f => f.relativePath));

  for (const file of files) {
    const deps: string[] = [];

    for (const imp of file.imports) {
      if (imp.isRelative) {
        // Try to resolve the import to an actual file in our set
        const resolved = resolveRelativeImport(file.relativePath, imp.source, fileSet);
        if (resolved) deps.push(resolved);
      }
    }

    graph.set(file.relativePath, deps);
  }

  return graph;
}

function resolveRelativeImport(
  fromFile: string,
  importPath: string,
  fileSet: Set<string>,
): string | null {
  const dir = dirname(fromFile);
  let resolved = importPath.replace(/^\.\//, '');
  if (importPath.startsWith('..')) {
    // Simplified resolution — join dir + import
    const parts = dir.split('/');
    const importParts = importPath.split('/');
    for (const part of importParts) {
      if (part === '..') parts.pop();
      else if (part !== '.') parts.push(part);
    }
    resolved = parts.join('/');
  } else {
    resolved = dir ? `${dir}/${resolved}` : resolved;
  }

  // Remove .js extension that TS imports use
  resolved = resolved.replace(/\.js$/, '');

  // Try exact match, then with extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
  for (const ext of extensions) {
    if (fileSet.has(resolved + ext)) return resolved + ext;
  }

  return null;
}

function detectModules(files: ParsedFile[]): DetectedModule[] {
  // Group files by top-level directories
  const dirGroups = new Map<string, ParsedFile[]>();

  for (const file of files) {
    const parts = file.relativePath.split('/');
    let dir: string;

    if (parts.length >= 3 && (parts[0] === 'src' || parts[0] === 'lib')) {
      dir = `${parts[0]}/${parts[1]}`;
    } else if (parts.length >= 2) {
      dir = parts[0];
    } else {
      dir = '.';
    }

    if (!dirGroups.has(dir)) dirGroups.set(dir, []);
    dirGroups.get(dir)!.push(file);
  }

  const modules: DetectedModule[] = [];

  for (const [dir, groupFiles] of dirGroups) {
    if (groupFiles.length < 2 || dir === '.') continue;

    const allExports = groupFiles.flatMap(f => f.exports);
    const allPatterns = [...new Set(groupFiles.flatMap(f => f.patterns))];

    const description = buildModuleDescription(dir, groupFiles, allExports, allPatterns);
    const entryPoint = groupFiles.find(f =>
      basename(f.relativePath).replace(/\.\w+$/, '') === 'index'
    )?.relativePath;

    modules.push({
      name: basename(dir),
      files: groupFiles.map(f => f.relativePath),
      description,
      entryPoint,
    });
  }

  return modules.sort((a, b) => b.files.length - a.files.length);
}

function buildModuleDescription(
  dir: string,
  files: ParsedFile[],
  exports: Array<{ name: string; kind: string }>,
  patterns: string[],
): string {
  const parts: string[] = [`${files.length} files`];

  const classes = exports.filter(e => e.kind === 'class').map(e => e.name);
  const functions = exports.filter(e => e.kind === 'function').map(e => e.name);

  if (classes.length > 0) parts.push(`Classes: ${classes.slice(0, 3).join(', ')}`);
  if (functions.length > 0) parts.push(`Functions: ${functions.slice(0, 5).join(', ')}`);
  if (patterns.length > 0) parts.push(`Patterns: ${patterns.join(', ')}`);

  return parts.join(' — ');
}

function findEntryPoints(files: ParsedFile[], depGraph: Map<string, string[]>): string[] {
  // Files that are imported by others are NOT entry points
  const importedFiles = new Set<string>();
  for (const deps of depGraph.values()) {
    for (const dep of deps) importedFiles.add(dep);
  }

  const entryNames = new Set(['index', 'main', 'app', 'server', 'cli', 'entry']);

  return files
    .filter(f => {
      const base = basename(f.relativePath).replace(/\.\w+$/, '');
      return entryNames.has(base) || !importedFiles.has(f.relativePath);
    })
    .filter(f => f.exports.length > 0)
    .slice(0, 10)
    .map(f => f.relativePath);
}

function detectArchitecture(files: ParsedFile[], modules: DetectedModule[]): string {
  const paths = files.map(f => f.relativePath.toLowerCase());
  const patterns: string[] = [];

  // Detect common architectures
  if (paths.some(p => p.includes('controller')) && paths.some(p => p.includes('model'))) {
    patterns.push('MVC');
  }
  if (paths.some(p => p.includes('use-case') || p.includes('usecase'))) {
    patterns.push('Clean Architecture');
  }
  if (paths.some(p => p.includes('middleware'))) {
    patterns.push('Middleware Pipeline');
  }
  if (paths.some(p => p.includes('routes') || p.includes('api/'))) {
    patterns.push('REST API');
  }
  if (paths.some(p => p.includes('graphql'))) {
    patterns.push('GraphQL');
  }
  if (paths.some(p => p.includes('components/'))) {
    patterns.push('Component-Based UI');
  }
  if (modules.length > 5) {
    patterns.push('Modular');
  }

  return patterns.length > 0 ? patterns.join(', ') : 'Standard';
}

function detectTechStack(files: ParsedFile[]): string[] {
  const stack = new Set<string>();

  for (const file of files) {
    for (const imp of file.imports) {
      if (!imp.isRelative) {
        // Map common packages to tech
        const source = imp.source.replace(/^@/, '');
        if (source.startsWith('react')) stack.add('React');
        else if (source.startsWith('next')) stack.add('Next.js');
        else if (source.startsWith('vue')) stack.add('Vue');
        else if (source.startsWith('express')) stack.add('Express');
        else if (source.startsWith('fastify')) stack.add('Fastify');
        else if (source.startsWith('prisma')) stack.add('Prisma');
        else if (source.includes('sqlite')) stack.add('SQLite');
        else if (source.includes('postgres') || source.includes('pg')) stack.add('PostgreSQL');
        else if (source.includes('mongo')) stack.add('MongoDB');
        else if (source.includes('redis')) stack.add('Redis');
        else if (source.includes('zod')) stack.add('Zod');
        else if (source.includes('graphql')) stack.add('GraphQL');
      }
    }

    if (file.language === 'typescript') stack.add('TypeScript');
    else if (file.language === 'javascript') stack.add('JavaScript');
    else if (file.language === 'python') stack.add('Python');
    else if (file.language === 'rust') stack.add('Rust');
    else if (file.language === 'go') stack.add('Go');
  }

  return Array.from(stack);
}

function buildAnalysisSummary(
  files: ParsedFile[],
  modules: DetectedModule[],
  entryPoints: string[],
  architecture: string,
  techStack: string[],
): string {
  const parts: string[] = [];

  parts.push(`Files analyzed: ${files.length}`);
  parts.push(`Modules detected: ${modules.length}`);
  if (modules.length > 0) {
    parts.push(`Modules: ${modules.map(m => `${m.name} (${m.files.length} files)`).join(', ')}`);
  }
  parts.push(`Architecture: ${architecture}`);
  parts.push(`Tech Stack: ${techStack.join(', ')}`);
  if (entryPoints.length > 0) {
    parts.push(`Entry Points: ${entryPoints.slice(0, 5).join(', ')}`);
  }

  const totalExports = files.reduce((sum, f) => sum + f.exports.length, 0);
  const totalTodos = files.reduce((sum, f) => sum + f.todos.length, 0);
  parts.push(`Total exports: ${totalExports}`);
  if (totalTodos > 0) parts.push(`TODOs: ${totalTodos}`);

  return parts.join('\n');
}
