import { describe, it, expect } from 'vitest';
import { runStaticChecks, extractCodeContent } from '../../../src/cli/validation/static-checks.js';

describe('Static Checks', () => {
  // ── HTML Valid ──

  describe('html-valid', () => {
    it('should pass valid HTML', () => {
      const output = '```html\n<div><p>Hello</p></div>\n```';
      const [result] = runStaticChecks(output, ['html-valid']);
      expect(result.passed).toBe(true);
    });

    it('should fail on unclosed tags', () => {
      const output = '```html\n<div><p>Hello</div>\n```';
      const [result] = runStaticChecks(output, ['html-valid']);
      expect(result.passed).toBe(false);
      expect(result.details).toContain('Mismatched');
    });

    it('should fail on stray closing tags', () => {
      const output = '```html\n</div>\n```';
      const [result] = runStaticChecks(output, ['html-valid']);
      expect(result.passed).toBe(false);
    });

    it('should handle void elements correctly', () => {
      const output = '```html\n<div><img src="x"><br><input type="text"></div>\n```';
      const [result] = runStaticChecks(output, ['html-valid']);
      expect(result.passed).toBe(true);
    });

    it('should handle self-closing tags', () => {
      const output = '```html\n<div><MyComponent /><br /></div>\n```';
      const [result] = runStaticChecks(output, ['html-valid']);
      expect(result.passed).toBe(true);
    });
  });

  // ── Links Valid ──

  describe('links-valid', () => {
    it('should pass valid links', () => {
      const output = '```html\n<a href="/about">About</a>\n```';
      const [result] = runStaticChecks(output, ['links-valid']);
      expect(result.passed).toBe(true);
    });

    it('should fail on empty href', () => {
      const output = '```html\n<a href="">Click</a>\n```';
      const [result] = runStaticChecks(output, ['links-valid']);
      expect(result.passed).toBe(false);
    });

    it('should fail on undefined src', () => {
      const output = '```html\n<img src="undefined">\n```';
      const [result] = runStaticChecks(output, ['links-valid']);
      expect(result.passed).toBe(false);
    });
  });

  // ── IDs Unique ──

  describe('ids-unique', () => {
    it('should pass unique IDs', () => {
      const output = '```html\n<div id="a"></div><div id="b"></div>\n```';
      const [result] = runStaticChecks(output, ['ids-unique']);
      expect(result.passed).toBe(true);
    });

    it('should fail on duplicate IDs', () => {
      const output = '```html\n<div id="main"></div><div id="main"></div>\n```';
      const [result] = runStaticChecks(output, ['ids-unique']);
      expect(result.passed).toBe(false);
      expect(result.details).toContain('main');
    });
  });

  // ── Img Alt ──

  describe('img-alt', () => {
    it('should pass images with alt', () => {
      const output = '```html\n<img src="x" alt="Photo">\n```';
      const [result] = runStaticChecks(output, ['img-alt']);
      expect(result.passed).toBe(true);
    });

    it('should fail images without alt', () => {
      const output = '```html\n<img src="x">\n```';
      const [result] = runStaticChecks(output, ['img-alt']);
      expect(result.passed).toBe(false);
    });
  });

  // ── Syntax Valid ──

  describe('syntax-valid', () => {
    it('should pass valid JSON', () => {
      const output = '```json\n{"key": "value"}\n```';
      const [result] = runStaticChecks(output, ['syntax-valid'], { lang: 'json' });
      expect(result.passed).toBe(true);
    });

    it('should fail invalid JSON', () => {
      const output = '```json\n{key: "value"}\n```';
      const [result] = runStaticChecks(output, ['syntax-valid'], { lang: 'json' });
      expect(result.passed).toBe(false);
    });

    it('should detect unbalanced brackets', () => {
      const output = '```ts\nfunction foo() {\n  if (true) {\n    return;\n}\n```';
      const [result] = runStaticChecks(output, ['syntax-valid']);
      expect(result.passed).toBe(false);
    });

    it('should pass balanced code', () => {
      const output = '```ts\nfunction foo() {\n  if (true) {\n    return;\n  }\n}\n```';
      const [result] = runStaticChecks(output, ['syntax-valid']);
      expect(result.passed).toBe(true);
    });
  });

  // ── SQL Injection ──

  describe('sql-injection', () => {
    it('should pass parameterized queries', () => {
      const output = '```ts\ndb.query("SELECT * FROM users WHERE id = ?", [id]);\n```';
      const [result] = runStaticChecks(output, ['sql-injection']);
      expect(result.passed).toBe(true);
    });

    it('should fail template literal SQL', () => {
      const output = '```ts\ndb.query(`SELECT * FROM users WHERE id = ${userId}`);\n```';
      const [result] = runStaticChecks(output, ['sql-injection']);
      expect(result.passed).toBe(false);
    });
  });

  // ── Async/Await ──

  describe('async-await', () => {
    it('should pass properly awaited code', () => {
      const output = '```ts\nasync function foo() {\n  const data = await fetch("/api");\n  return data;\n}\n```';
      const [result] = runStaticChecks(output, ['async-await']);
      expect(result.passed).toBe(true);
    });

    it('should flag async function without await', () => {
      const output = '```ts\nasync function bar() {\n  return 42;\n}\n```';
      const [result] = runStaticChecks(output, ['async-await']);
      expect(result.passed).toBe(false);
    });
  });

  // ── No Hardcoded ──

  describe('no-hardcoded', () => {
    it('should pass clean code', () => {
      const output = '```ts\nconst apiKey = process.env.API_KEY;\n```';
      const [result] = runStaticChecks(output, ['no-hardcoded']);
      expect(result.passed).toBe(true);
    });

    it('should fail on OpenAI key pattern', () => {
      const output = '```ts\nconst key = "sk-abcdefghijklmnopqrstuvwxyz12345678";\n```';
      const [result] = runStaticChecks(output, ['no-hardcoded']);
      expect(result.passed).toBe(false);
    });

    it('should fail on GitHub PAT', () => {
      const output = '```ts\nconst token = "ghp_abcdefghijklmnopqrstuvwxyz12345678ab";\n```';
      const [result] = runStaticChecks(output, ['no-hardcoded']);
      expect(result.passed).toBe(false);
    });
  });

  // ── Assertions Exist ──

  describe('assertions-exist', () => {
    it('should pass tests with assertions', () => {
      const output = "```ts\nit('works', () => {\n  expect(1).toBe(1);\n});\n```";
      const [result] = runStaticChecks(output, ['assertions-exist']);
      expect(result.passed).toBe(true);
    });
  });

  // ── No Secrets ──

  describe('no-secrets', () => {
    it('should fail on plaintext password in config', () => {
      const output = '```json\n{"password": "mysecretpassword123"}\n```';
      const [result] = runStaticChecks(output, ['no-secrets']);
      expect(result.passed).toBe(false);
    });

    it('should pass clean config', () => {
      const output = '```json\n{"port": 3000, "host": "localhost"}\n```';
      const [result] = runStaticChecks(output, ['no-secrets']);
      expect(result.passed).toBe(true);
    });
  });

  // ── Code Extraction ──

  describe('extractCodeContent', () => {
    it('should extract fenced code blocks', () => {
      const input = 'Here is code:\n```ts\nconst x = 1;\n```\nDone.';
      const code = extractCodeContent(input, ['ts', 'typescript']);
      expect(code).toBe('const x = 1;\n');
    });

    it('should extract multiple code blocks', () => {
      const input = '```ts\nconst a = 1;\n```\n\n```ts\nconst b = 2;\n```';
      const code = extractCodeContent(input, ['ts', 'typescript']);
      expect(code).toContain('const a = 1;');
      expect(code).toContain('const b = 2;');
    });

    it('should return null for non-code content', () => {
      const code = extractCodeContent('Hello, this is just text.', ['ts']);
      expect(code).toBeNull();
    });

    it('should detect raw code without fences', () => {
      const code = extractCodeContent('import { foo } from "bar";\nconst x = foo();', ['ts']);
      expect(code).not.toBeNull();
    });
  });

  // ── Multiple Checks ──

  it('should run multiple checks at once', () => {
    const output = '```html\n<div id="a"><p>Test</p></div>\n```';
    const results = runStaticChecks(output, ['html-valid', 'ids-unique', 'links-valid']);
    expect(results.length).toBe(3);
    expect(results.every(r => r.passed)).toBe(true);
  });

  it('should skip unknown check IDs', () => {
    const results = runStaticChecks('test', ['nonexistent-check']);
    expect(results.length).toBe(0);
  });
});
