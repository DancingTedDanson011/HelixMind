import { describe, it, expect } from 'vitest';
import { detectFeedIntent } from '../../../src/cli/feed/intent.js';

describe('detectFeedIntent', () => {
  describe('German triggers', () => {
    it('should detect "Schau dir mal die Codebase an"', () => {
      const result = detectFeedIntent('Schau dir mal die Codebase an');
      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect "Mach dich mit dem Projekt vertraut"', () => {
      const result = detectFeedIntent('Mach dich mit dem Projekt vertraut');
      expect(result.detected).toBe(true);
    });

    it('should detect "Lies dir den Code durch"', () => {
      const result = detectFeedIntent('Lies dir den Code durch');
      expect(result.detected).toBe(true);
    });

    it('should detect "Analysiere das Repo"', () => {
      const result = detectFeedIntent('Analysiere das Repo');
      expect(result.detected).toBe(true);
    });

    it('should detect "Was ist das für ein Projekt?"', () => {
      const result = detectFeedIntent('Was ist das für ein Projekt?');
      expect(result.detected).toBe(true);
    });

    it('should detect "Verschaff dir einen Überblick"', () => {
      const result = detectFeedIntent('Verschaff dir einen Überblick');
      expect(result.detected).toBe(true);
    });

    it('should detect "Check mal das Projekt"', () => {
      const result = detectFeedIntent('Check mal das Projekt');
      expect(result.detected).toBe(true);
    });

    it('should detect "Guck mal rein"', () => {
      const result = detectFeedIntent('Guck mal rein');
      expect(result.detected).toBe(true);
    });

    it('should detect "Erkunde den Code"', () => {
      const result = detectFeedIntent('Erkunde den Code');
      expect(result.detected).toBe(true);
    });

    it('should detect "Versteh mal den Code"', () => {
      const result = detectFeedIntent('Versteh mal den Code');
      expect(result.detected).toBe(true);
    });
  });

  describe('English triggers', () => {
    it('should detect "Look at the codebase"', () => {
      const result = detectFeedIntent('Look at the codebase');
      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect "Understand this project"', () => {
      const result = detectFeedIntent('Understand this project');
      expect(result.detected).toBe(true);
    });

    it('should detect "Get familiar with the code"', () => {
      const result = detectFeedIntent('Get familiar with the code');
      expect(result.detected).toBe(true);
    });

    it('should detect "Analyze the repo"', () => {
      const result = detectFeedIntent('Analyze the repo');
      expect(result.detected).toBe(true);
    });

    it('should detect "What does this project do?"', () => {
      const result = detectFeedIntent('What does this project do?');
      expect(result.detected).toBe(true);
    });

    it('should detect "Explore the codebase"', () => {
      const result = detectFeedIntent('Explore the codebase');
      expect(result.detected).toBe(true);
    });

    it('should detect "Read through the source"', () => {
      const result = detectFeedIntent('Read through the source');
      expect(result.detected).toBe(true);
    });

    it('should detect "Scan the repo"', () => {
      const result = detectFeedIntent('Scan the repo');
      expect(result.detected).toBe(true);
    });

    it('should detect "Overview of the project"', () => {
      const result = detectFeedIntent('Overview of the project');
      expect(result.detected).toBe(true);
    });

    it('should detect "Dig into the code"', () => {
      const result = detectFeedIntent('Dig into the code');
      expect(result.detected).toBe(true);
    });
  });

  describe('Non-triggers', () => {
    it('should not detect "Fix the login bug"', () => {
      const result = detectFeedIntent('Fix the login bug');
      expect(result.detected).toBe(false);
    });

    it('should not detect "Write a function that sorts"', () => {
      const result = detectFeedIntent('Write a function that sorts');
      expect(result.detected).toBe(false);
    });

    it('should not detect "How do I use React hooks?"', () => {
      const result = detectFeedIntent('How do I use React hooks?');
      expect(result.detected).toBe(false);
    });

    it('should not detect "Deploy the application"', () => {
      const result = detectFeedIntent('Deploy the application');
      expect(result.detected).toBe(false);
    });

    it('should not detect empty string', () => {
      const result = detectFeedIntent('');
      expect(result.detected).toBe(false);
    });
  });

  describe('scope detection', () => {
    it('should detect file scope from path mention', () => {
      const result = detectFeedIntent('Look at src/auth/middleware.ts');
      expect(result.detected).toBe(true);
      expect(result.scope).toBe('file');
      expect(result.path).toContain('src/auth/middleware.ts');
    });

    it('should detect directory scope from path mention', () => {
      const result = detectFeedIntent('Analyze the src/ directory');
      expect(result.detected).toBe(true);
      expect(result.scope).toBe('directory');
      expect(result.path).toContain('src/');
    });

    it('should default to full_project scope', () => {
      const result = detectFeedIntent('Look at the codebase');
      expect(result.scope).toBe('full_project');
    });
  });

  describe('performance', () => {
    it('should complete in < 10ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        detectFeedIntent('Schau dir mal die Codebase an');
        detectFeedIntent('Fix the login bug');
        detectFeedIntent('Look at the project');
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100); // 300 calls in < 100ms = < 0.33ms each
    });
  });
});
