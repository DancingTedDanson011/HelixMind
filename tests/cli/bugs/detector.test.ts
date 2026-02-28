import { describe, it, expect } from 'vitest';
import { detectBugReport } from '../../../src/cli/bugs/detector.js';

describe('detectBugReport', () => {
  describe('positive detection — English', () => {
    it('should detect "X doesn\'t work"', () => {
      const result = detectBugReport('The login button doesn\'t work anymore');
      expect(result.isBug).toBe(true);
      expect(result.description).toBeTruthy();
    });

    it('should detect "X is broken"', () => {
      const result = detectBugReport('The sidebar is broken on mobile');
      expect(result.isBug).toBe(true);
    });

    it('should detect crash reports', () => {
      const result = detectBugReport('The app crashes when I click submit');
      expect(result.isBug).toBe(true);
    });

    it('should detect "fix the X"', () => {
      const result = detectBugReport('Fix the authentication error in login.ts');
      expect(result.isBug).toBe(true);
    });

    it('should detect "there is a bug"', () => {
      const result = detectBugReport('There is a bug in the payment flow');
      expect(result.isBug).toBe(true);
    });

    it('should detect "throws an error"', () => {
      const result = detectBugReport('The API throws an error when called');
      expect(result.isBug).toBe(true);
    });
  });

  describe('positive detection — German', () => {
    it('should detect "funktioniert nicht"', () => {
      const result = detectBugReport('Der Login funktioniert nicht mehr');
      expect(result.isBug).toBe(true);
    });

    it('should detect "ist kaputt"', () => {
      const result = detectBugReport('Die Navigation ist kaputt');
      expect(result.isBug).toBe(true);
    });

    it('should detect "geht nicht"', () => {
      const result = detectBugReport('Das Formular geht nicht');
      expect(result.isBug).toBe(true);
    });

    it('should detect "stürzt ab"', () => {
      const result = detectBugReport('Die App stürzt ab beim Speichern');
      expect(result.isBug).toBe(true);
    });

    it('should detect "es gibt einen Fehler"', () => {
      const result = detectBugReport('Es gibt einen Fehler beim Login');
      expect(result.isBug).toBe(true);
    });

    it('should detect "fix den/diesen"', () => {
      const result = detectBugReport('Fix den Bug in der auth.ts');
      expect(result.isBug).toBe(true);
    });
  });

  describe('negative detection — should NOT trigger', () => {
    it('should not detect normal coding requests', () => {
      const result = detectBugReport('Add a new user registration feature');
      expect(result.isBug).toBe(false);
    });

    it('should not detect general questions', () => {
      const result = detectBugReport('How does the authentication system work?');
      expect(result.isBug).toBe(false);
    });

    it('should not detect refactoring requests', () => {
      const result = detectBugReport('Refactor the database module to use connection pooling');
      expect(result.isBug).toBe(false);
    });

    it('should not trigger on single keyword in context', () => {
      const result = detectBugReport('Create an error handling middleware');
      expect(result.isBug).toBe(false);
    });
  });

  describe('file extraction', () => {
    it('should extract file path with line number', () => {
      const result = detectBugReport('There is a bug in src/auth/login.ts:42 that crashes');
      expect(result.isBug).toBe(true);
      expect(result.file).toBe('src/auth/login.ts');
      expect(result.line).toBe(42);
    });

    it('should extract file path without line number', () => {
      const result = detectBugReport('The component.tsx is broken and not rendering');
      expect(result.isBug).toBe(true);
      expect(result.file).toBe('component.tsx');
    });

    it('should not extract URLs as file paths', () => {
      const result = detectBugReport('The API at https://api.example.com/auth doesn\'t work');
      expect(result.isBug).toBe(true);
      // file should not be the URL
      if (result.file) {
        expect(result.file).not.toContain('https://');
      }
    });
  });

  describe('evidence extraction', () => {
    it('should add user report as evidence', () => {
      const result = detectBugReport('The login button is broken');
      expect(result.evidence.some(e => e.type === 'user_report')).toBe(true);
    });

    it('should detect stack traces as evidence', () => {
      const msg = 'It crashes with:\n  at Object.login (src/auth.ts:10:5)\n  at main (index.ts:3:1)';
      const result = detectBugReport(msg);
      expect(result.isBug).toBe(true);
      expect(result.evidence.some(e => e.type === 'stack_trace')).toBe(true);
    });
  });

  describe('description building', () => {
    it('should create concise description from short messages', () => {
      const result = detectBugReport('The sidebar is broken on mobile');
      expect(result.description).toBe('The sidebar is broken on mobile');
    });

    it('should truncate very long messages', () => {
      const longMsg = 'The login button is broken ' + 'and '.repeat(50) + 'it fails every time';
      const result = detectBugReport(longMsg);
      expect(result.description.length).toBeLessThanOrEqual(150);
    });
  });
});
