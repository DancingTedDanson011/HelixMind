import { describe, it, expect } from 'vitest';
import { parseFiles } from '../../../src/cli/feed/parser.js';
import type { ReadFile } from '../../../src/cli/feed/reader.js';

describe('parseFiles', () => {
  it('should parse TypeScript exports', () => {
    const files: ReadFile[] = [{
      path: '/test/src/utils.ts',
      relativePath: 'src/utils.ts',
      content: `
export function add(a: number, b: number): number { return a + b; }
export class Calculator { multiply(a: number, b: number) { return a * b; } }
export type Result = { value: number };
export interface Config { debug: boolean; }
export const VERSION = '1.0.0';
export enum Color { Red, Green, Blue }
export default function main() {}
`,
      language: 'typescript',
      truncated: false,
    }];

    const parsed = parseFiles(files);
    expect(parsed).toHaveLength(1);

    const file = parsed[0];
    expect(file.exports.some(e => e.name === 'add' && e.kind === 'function')).toBe(true);
    expect(file.exports.some(e => e.name === 'Calculator' && e.kind === 'class')).toBe(true);
    expect(file.exports.some(e => e.name === 'Result' && e.kind === 'type')).toBe(true);
    expect(file.exports.some(e => e.name === 'Config' && e.kind === 'interface')).toBe(true);
    expect(file.exports.some(e => e.name === 'VERSION' && e.kind === 'const')).toBe(true);
    expect(file.exports.some(e => e.name === 'Color' && e.kind === 'enum')).toBe(true);
    expect(file.exports.some(e => e.name === 'default' && e.kind === 'default')).toBe(true);
  });

  it('should parse TypeScript imports', () => {
    const files: ReadFile[] = [{
      path: '/test/src/app.ts',
      relativePath: 'src/app.ts',
      content: `
import { readFile } from 'node:fs';
import express from 'express';
import { Config } from './types.js';
import type { User } from '../models/user.js';
`,
      language: 'typescript',
      truncated: false,
    }];

    const parsed = parseFiles(files);
    const file = parsed[0];

    expect(file.imports).toHaveLength(4);
    expect(file.imports.some(i => i.source === 'node:fs' && !i.isRelative)).toBe(true);
    expect(file.imports.some(i => i.source === 'express' && !i.isRelative)).toBe(true);
    expect(file.imports.some(i => i.source === './types.js' && i.isRelative)).toBe(true);
    expect(file.imports.some(i => i.source === '../models/user.js' && i.isRelative)).toBe(true);
  });

  it('should detect patterns', () => {
    const files: ReadFile[] = [{
      path: '/test/src/hooks.ts',
      relativePath: 'src/hooks.ts',
      content: `
export function useAuth() { return { user: null }; }
export function createRouter() { return {}; }
`,
      language: 'typescript',
      truncated: false,
    }];

    const parsed = parseFiles(files);
    expect(parsed[0].patterns).toContain('hook');
    expect(parsed[0].patterns).toContain('factory');
  });

  it('should extract TODOs', () => {
    const files: ReadFile[] = [{
      path: '/test/src/app.ts',
      relativePath: 'src/app.ts',
      content: `
// TODO: implement authentication
// FIXME: race condition
const x = 1;
`,
      language: 'typescript',
      truncated: false,
    }];

    const parsed = parseFiles(files);
    expect(parsed[0].todos).toHaveLength(2);
    expect(parsed[0].todos[0]).toContain('implement authentication');
  });

  it('should build a summary', () => {
    const files: ReadFile[] = [{
      path: '/test/src/api.ts',
      relativePath: 'src/api.ts',
      content: `
export function getUsers() { return []; }
export function createUser(name: string) { return { name }; }
import express from 'express';
`,
      language: 'typescript',
      truncated: false,
    }];

    const parsed = parseFiles(files);
    expect(parsed[0].summary).toContain('src/api.ts');
    expect(parsed[0].summary).toContain('getUsers');
  });

  it('should parse Python files', () => {
    const files: ReadFile[] = [{
      path: '/test/app.py',
      relativePath: 'app.py',
      content: `
import os
from flask import Flask
class App:
    pass
def main():
    pass
`,
      language: 'python',
      truncated: false,
    }];

    const parsed = parseFiles(files);
    expect(parsed[0].exports.some(e => e.name === 'App' && e.kind === 'class')).toBe(true);
    expect(parsed[0].exports.some(e => e.name === 'main' && e.kind === 'function')).toBe(true);
    expect(parsed[0].imports.some(i => i.source === 'os')).toBe(true);
    expect(parsed[0].imports.some(i => i.source === 'flask')).toBe(true);
  });
});
