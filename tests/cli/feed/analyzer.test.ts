import { describe, it, expect } from 'vitest';
import { analyzeCodebase } from '../../../src/cli/feed/analyzer.js';
import type { ParsedFile } from '../../../src/cli/feed/parser.js';

describe('analyzeCodebase', () => {
  const mockParsedFiles: ParsedFile[] = [
    {
      relativePath: 'src/api/routes.ts',
      language: 'typescript',
      exports: [
        { name: 'getUsers', kind: 'function', line: 5 },
        { name: 'createUser', kind: 'function', line: 15 },
      ],
      imports: [
        { source: 'express', specifiers: ['Router'], isRelative: false },
        { source: './types.js', specifiers: ['User'], isRelative: true },
      ],
      patterns: [],
      todos: [],
      lineCount: 50,
      summary: 'src/api/routes.ts (50 lines) | Exports: function getUsers, function createUser',
    },
    {
      relativePath: 'src/api/types.ts',
      language: 'typescript',
      exports: [
        { name: 'User', kind: 'interface', line: 1 },
        { name: 'ApiResponse', kind: 'type', line: 10 },
      ],
      imports: [],
      patterns: [],
      todos: [],
      lineCount: 20,
      summary: 'src/api/types.ts (20 lines) | Exports: interface User, type ApiResponse',
    },
    {
      relativePath: 'src/auth/middleware.ts',
      language: 'typescript',
      exports: [
        { name: 'authMiddleware', kind: 'function', line: 3 },
      ],
      imports: [
        { source: 'jsonwebtoken', specifiers: ['verify'], isRelative: false },
      ],
      patterns: ['middleware'],
      todos: ['TODO: add rate limiting'],
      lineCount: 30,
      summary: 'src/auth/middleware.ts (30 lines) | Exports: function authMiddleware',
    },
  ];

  it('should detect modules', () => {
    const result = analyzeCodebase(mockParsedFiles);
    expect(result.modules.length).toBeGreaterThanOrEqual(1);
    expect(result.modules.some(m => m.name === 'api')).toBe(true);
  });

  it('should build dependency graph', () => {
    const result = analyzeCodebase(mockParsedFiles);
    expect(result.dependencyGraph.size).toBeGreaterThan(0);
  });

  it('should detect architecture patterns', () => {
    const result = analyzeCodebase(mockParsedFiles);
    expect(result.architecture.length).toBeGreaterThan(0);
  });

  it('should detect tech stack', () => {
    const result = analyzeCodebase(mockParsedFiles);
    expect(result.techStack).toContain('TypeScript');
  });

  it('should generate a summary', () => {
    const result = analyzeCodebase(mockParsedFiles);
    expect(result.summary).toContain('Files analyzed');
    expect(result.summary).toContain('Modules detected');
  });

  it('should handle empty input', () => {
    const result = analyzeCodebase([]);
    expect(result.modules).toEqual([]);
    expect(result.techStack).toEqual([]);
    expect(result.summary).toContain('Files analyzed: 0');
  });
});
