/**
 * Web Knowledge Enricher — The Internet Layer.
 *
 * When the agent works on a topic, this module automatically:
 * 1. Detects what topics need fresh knowledge
 * 2. Searches the web for relevant docs, best practices, examples
 * 3. Extracts and compresses the useful parts
 * 4. Stores them in the spiral brain (as L2 Active nodes)
 *
 * The brain visualization shows new web knowledge arriving in real-time.
 */

import { detectTopics, needsEnrichment, type DetectedTopic } from './topic-detector.js';
import { webSearch, fetchPageContent, type SearchResult } from './search-provider.js';
import { extractKnowledge, formatForSpiral } from './content-extractor.js';
import { logger } from '../../utils/logger.js';

export interface EnrichmentResult {
  topics: string[];
  nodesStored: number;
  sourcesSearched: number;
  pagesFetched: number;
  duration_ms: number;
  /** New knowledge items (for brain visualization) */
  newKnowledge: Array<{
    topic: string;
    summary: string;
    source: string;
    quality: number;
  }>;
}

export interface EnrichmentOptions {
  /** Max topics to research per message (default: 2) */
  maxTopics?: number;
  /** Max pages to fetch per topic (default: 2) */
  maxPagesPerTopic?: number;
  /** Minimum quality score to store (default: 0.4) */
  minQuality?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Callback for live updates (brain visualization) */
  onKnowledgeFound?: (topic: string, summary: string, source: string) => void;
}

// Track recently searched topics to avoid redundant searches within a session
const recentSearches = new Map<string, number>();
const SEARCH_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Enrich the spiral brain with web knowledge about the current topic.
 * Runs in the background (non-blocking).
 *
 * @param userMessage - The user's message to analyze
 * @param spiralEngine - The spiral engine to store knowledge in
 * @param options - Configuration options
 */
export async function enrichFromWeb(
  userMessage: string,
  spiralEngine: any,
  options: EnrichmentOptions = {},
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const {
    maxTopics = 2,
    maxPagesPerTopic = 2,
    minQuality = 0.4,
    signal,
    onKnowledgeFound,
  } = options;

  const result: EnrichmentResult = {
    topics: [],
    nodesStored: 0,
    sourcesSearched: 0,
    pagesFetched: 0,
    duration_ms: 0,
    newKnowledge: [],
  };

  // Check if enrichment is needed
  if (!needsEnrichment(userMessage)) {
    result.duration_ms = Date.now() - startTime;
    return result;
  }

  // Detect topics
  const allTopics = detectTopics(userMessage);
  const topics = filterRecentTopics(allTopics).slice(0, maxTopics);

  if (topics.length === 0) {
    result.duration_ms = Date.now() - startTime;
    return result;
  }

  result.topics = topics.map(t => t.query);
  logger.debug(`Web enricher: researching ${topics.length} topics: ${result.topics.join(', ')}`);

  // Check if spiral already has knowledge about these topics
  const filteredTopics = await filterKnownTopics(topics, spiralEngine);

  // Research each topic
  for (const topic of filteredTopics) {
    if (signal?.aborted) break;

    try {
      // Mark as recently searched
      recentSearches.set(normalizeQuery(topic.query), Date.now());

      // Search the web
      const searchResults = await webSearch(topic.query, maxPagesPerTopic + 2, signal);
      result.sourcesSearched += searchResults.length;

      if (searchResults.length === 0) continue;

      // Fetch and process top results
      const pagesToFetch = searchResults.slice(0, maxPagesPerTopic);

      for (const searchResult of pagesToFetch) {
        if (signal?.aborted) break;

        const pageContent = await fetchPageContent(searchResult.url, 8000, signal);
        if (!pageContent) continue;

        result.pagesFetched++;

        // Extract knowledge
        const knowledge = extractKnowledge(pageContent, searchResult.url, topic.query);

        // Skip low quality
        if (knowledge.quality < minQuality) continue;

        // Format for spiral storage
        const spiralContent = formatForSpiral(knowledge, topic.query);

        // Store in spiral brain as L2 (Active) node
        try {
          await spiralEngine.store(spiralContent, 'pattern', {
            tags: ['web_knowledge', topic.category, ...topic.query.split(/\s+/).slice(0, 3)],
            source: searchResult.url,
            web_topic: topic.query,
            quality: knowledge.quality,
          });

          result.nodesStored++;

          const knowledgeItem = {
            topic: topic.query,
            summary: knowledge.summary.slice(0, 150),
            source: searchResult.url,
            quality: knowledge.quality,
          };
          result.newKnowledge.push(knowledgeItem);

          // Notify for live brain visualization
          onKnowledgeFound?.(topic.query, knowledge.summary.slice(0, 150), searchResult.url);

          logger.debug(`Stored web knowledge: ${topic.query} from ${searchResult.url} (quality: ${knowledge.quality.toFixed(2)})`);
        } catch {
          // Storage error, skip
        }
      }
    } catch (err) {
      logger.debug(`Web enricher error for "${topic.query}": ${err}`);
    }
  }

  result.duration_ms = Date.now() - startTime;
  logger.debug(`Web enricher complete: ${result.nodesStored} nodes stored in ${result.duration_ms}ms`);

  return result;
}

/**
 * Filter out topics that were recently searched.
 */
function filterRecentTopics(topics: DetectedTopic[]): DetectedTopic[] {
  const now = Date.now();
  return topics.filter(t => {
    const normalized = normalizeQuery(t.query);
    const lastSearch = recentSearches.get(normalized);
    if (lastSearch && now - lastSearch < SEARCH_COOLDOWN_MS) {
      return false;
    }
    return true;
  });
}

/**
 * Filter out topics the spiral already has good knowledge about.
 */
async function filterKnownTopics(
  topics: DetectedTopic[],
  spiralEngine: any,
): Promise<DetectedTopic[]> {
  const filtered: DetectedTopic[] = [];

  for (const topic of topics) {
    try {
      const existing = await spiralEngine.query(topic.query, undefined, [1, 2]);
      // If we already have 3+ relevant nodes in L1/L2, skip this topic
      const totalExisting = existing.level_1.length + existing.level_2.length;

      // Check if any existing nodes are web knowledge
      const hasWebKnowledge = [...existing.level_1, ...existing.level_2].some(
        (n: any) => n.content?.includes('[Web Knowledge:')
      );

      if (totalExisting < 3 || !hasWebKnowledge) {
        filtered.push(topic);
      }
    } catch {
      // If query fails, include the topic
      filtered.push(topic);
    }
  }

  return filtered;
}

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Clear the recent searches cache (for testing or session reset).
 */
export function clearSearchCache(): void {
  recentSearches.clear();
}

/**
 * Get current cache stats.
 */
export function getSearchCacheStats(): { size: number; topics: string[] } {
  return {
    size: recentSearches.size,
    topics: Array.from(recentSearches.keys()),
  };
}
