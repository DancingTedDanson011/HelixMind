import { describe, it, expect } from 'vitest';
import { detectTopics, needsEnrichment } from '../../../src/spiral/cloud/topic-detector.js';

describe('Topic Detector', () => {
  describe('detectTopics', () => {
    it('detects single technology', () => {
      const topics = detectTopics('How do I implement authentication in React?');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics.some(t => t.query.toLowerCase().includes('react'))).toBe(true);
    });

    it('detects multiple technologies', () => {
      const topics = detectTopics('Build a Next.js app with PostgreSQL and Prisma');
      expect(topics.length).toBeGreaterThan(0);
      const queries = topics.map(t => t.query.toLowerCase());
      expect(queries.some(q => q.includes('next') || q.includes('postgres') || q.includes('prisma'))).toBe(true);
    });

    it('combines tech + pattern for specific queries', () => {
      const topics = detectTopics('Implement JWT authentication in Express.js');
      expect(topics.length).toBeGreaterThan(0);
      // Should have a combined query like "Express.js authentication best practices"
      const combined = topics.find(t =>
        t.query.toLowerCase().includes('express') &&
        t.query.toLowerCase().includes('authentication'),
      );
      expect(combined).toBeDefined();
      expect(combined!.category).toBe('pattern');
    });

    it('detects error patterns', () => {
      const topics = detectTopics('I keep getting CORS errors when calling my React API');
      const errorTopics = topics.filter(t => t.category === 'error');
      expect(errorTopics.length).toBeGreaterThan(0);
      expect(errorTopics[0].query.toLowerCase()).toContain('cors');
    });

    it('returns empty for non-technical messages', () => {
      const topics = detectTopics('What is the meaning of life?');
      expect(topics.length).toBe(0);
    });

    it('limits to max 3 topics', () => {
      const topics = detectTopics(
        'Build a React Next.js app with PostgreSQL Prisma Express JWT OAuth WebSocket GraphQL deployment CI/CD Docker',
      );
      expect(topics.length).toBeLessThanOrEqual(3);
    });

    it('prioritizes error topics with high relevance', () => {
      const topics = detectTopics('React TypeError when using useState hook');
      const errorTopics = topics.filter(t => t.category === 'error');
      if (errorTopics.length > 0) {
        expect(errorTopics[0].relevance).toBeGreaterThanOrEqual(0.85);
      }
    });

    it('detects German-friendly patterns', () => {
      const topics = detectTopics('Implementiere Login-Authentifizierung mit React');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics.some(t => t.query.toLowerCase().includes('react'))).toBe(true);
    });
  });

  describe('needsEnrichment', () => {
    it('returns true for technical messages', () => {
      expect(needsEnrichment('How do I set up authentication in Next.js?')).toBe(true);
    });

    it('returns false for short messages', () => {
      expect(needsEnrichment('hi')).toBe(false);
      expect(needsEnrichment('thanks!')).toBe(false);
    });

    it('returns false for greetings', () => {
      expect(needsEnrichment('Hello, how are you doing today?')).toBe(false);
    });

    it('returns false for slash commands', () => {
      expect(needsEnrichment('/help me with React authentication')).toBe(false);
    });

    it('returns false for non-technical messages', () => {
      expect(needsEnrichment('What is the best pizza place nearby?')).toBe(false);
    });

    it('returns true for error messages', () => {
      expect(needsEnrichment('I am getting a TypeError in my React component when using hooks')).toBe(true);
    });
  });
});
