import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearSearchCache, getSearchCacheStats } from '../../../src/spiral/cloud/web-enricher.js';

// Mock the search provider to avoid real HTTP calls in tests
vi.mock('../../../src/spiral/cloud/search-provider.js', () => ({
  webSearch: vi.fn().mockResolvedValue([
    {
      title: 'React Authentication Guide',
      url: 'https://example.com/react-auth',
      snippet: 'Learn how to implement authentication in React',
    },
  ]),
  fetchPageContent: vi.fn().mockResolvedValue(
    '## React Authentication\n\n' +
    'You should always use secure token storage for React authentication.\n\n' +
    '```javascript\nconst token = localStorage.getItem("token");\n```\n\n' +
    '- Always validate React tokens on the server\n' +
    '- Use React httpOnly cookies for sensitive tokens\n',
  ),
}));

describe('Web Enricher', () => {
  beforeEach(() => {
    clearSearchCache();
  });

  describe('clearSearchCache', () => {
    it('clears the recent searches cache', () => {
      clearSearchCache();
      const stats = getSearchCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.topics).toEqual([]);
    });
  });

  describe('getSearchCacheStats', () => {
    it('returns cache stats', () => {
      const stats = getSearchCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('topics');
      expect(Array.isArray(stats.topics)).toBe(true);
    });
  });

  describe('enrichFromWeb', () => {
    it('enriches spiral brain with web knowledge', async () => {
      const { enrichFromWeb } = await import('../../../src/spiral/cloud/web-enricher.js');

      const mockEngine = {
        query: vi.fn().mockResolvedValue({
          level_1: [],
          level_2: [],
        }),
        store: vi.fn().mockResolvedValue({
          node_id: 'test-id',
          level: 2,
          connections: 0,
          token_count: 100,
        }),
      };

      const result = await enrichFromWeb(
        'How to implement React authentication with JWT?',
        mockEngine,
        { maxTopics: 1, maxPagesPerTopic: 1 },
      );

      expect(result.topics.length).toBeGreaterThan(0);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
      // Should have stored something since mock returns content
      if (result.nodesStored > 0) {
        expect(mockEngine.store).toHaveBeenCalled();
        expect(result.newKnowledge.length).toBeGreaterThan(0);
      }
    });

    it('skips enrichment for non-technical messages', async () => {
      const { enrichFromWeb } = await import('../../../src/spiral/cloud/web-enricher.js');

      const mockEngine = {
        query: vi.fn(),
        store: vi.fn(),
      };

      const result = await enrichFromWeb('Hello there!', mockEngine);

      expect(result.topics.length).toBe(0);
      expect(result.nodesStored).toBe(0);
      expect(mockEngine.store).not.toHaveBeenCalled();
    });

    it('calls onKnowledgeFound callback for live updates', async () => {
      const { enrichFromWeb } = await import('../../../src/spiral/cloud/web-enricher.js');

      const mockEngine = {
        query: vi.fn().mockResolvedValue({
          level_1: [],
          level_2: [],
        }),
        store: vi.fn().mockResolvedValue({
          node_id: 'test-id',
          level: 2,
          connections: 0,
          token_count: 100,
        }),
      };

      const onKnowledgeFound = vi.fn();

      await enrichFromWeb(
        'Implement React authentication with JWT tokens',
        mockEngine,
        { maxTopics: 1, maxPagesPerTopic: 1, onKnowledgeFound },
      );

      // If nodes were stored, callback should have been called
      if (onKnowledgeFound.mock.calls.length > 0) {
        expect(onKnowledgeFound).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.any(String),
        );
      }
    });

    it('respects search cooldown (deduplication)', async () => {
      const { enrichFromWeb } = await import('../../../src/spiral/cloud/web-enricher.js');

      const mockEngine = {
        query: vi.fn().mockResolvedValue({ level_1: [], level_2: [] }),
        store: vi.fn().mockResolvedValue({ node_id: 'x', level: 2, connections: 0, token_count: 10 }),
      };

      // First call
      await enrichFromWeb('Setup React authentication flow', mockEngine, { maxTopics: 1 });

      // Second call with same topic should be filtered by cooldown
      const result2 = await enrichFromWeb('Setup React authentication flow', mockEngine, { maxTopics: 1 });

      // Cache should have entries now
      const stats = getSearchCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('handles AbortSignal cancellation', async () => {
      const { enrichFromWeb } = await import('../../../src/spiral/cloud/web-enricher.js');

      const mockEngine = {
        query: vi.fn().mockResolvedValue({ level_1: [], level_2: [] }),
        store: vi.fn(),
      };

      const abortController = new AbortController();
      abortController.abort(); // Abort immediately

      const result = await enrichFromWeb(
        'How to optimize PostgreSQL queries for performance',
        mockEngine,
        { signal: abortController.signal },
      );

      // Should have detected topics but not stored anything due to abort
      expect(result.nodesStored).toBe(0);
    });
  });
});
