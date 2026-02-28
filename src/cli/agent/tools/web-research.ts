import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'web_research',
    description: 'Search the internet for current information about a topic and store findings in the spiral brain. Use this when you need up-to-date documentation, best practices, API references, or solutions for specific technologies. The results are automatically stored in the brain for future reference.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for (e.g. "Next.js 14 server actions best practices", "PostgreSQL connection pooling")',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of web pages to fetch and process (default: 3, max: 5)',
        },
        fetch_content: {
          type: 'boolean',
          description: 'Whether to fetch and extract content from result pages (default: true). Set to false for quick search-only.',
        },
      },
      required: ['query'],
    },
  },

  async execute(input, ctx) {
    const query = input.query as string;
    const maxResults = Math.min((input.max_results as number) ?? 3, 5);
    const fetchContent = (input.fetch_content as boolean) ?? true;

    try {
      const { webSearch, fetchPageContent } = await import('../../../spiral/cloud/search-provider.js');
      const { extractKnowledge, formatForSpiral } = await import('../../../spiral/cloud/content-extractor.js');

      // Search the web
      const searchResults = await webSearch(query, maxResults + 2);

      if (searchResults.length === 0) {
        return `No web results found for "${query}". The search may have failed due to network issues.`;
      }

      const parts: string[] = [];
      parts.push(`Web search results for "${query}":\n`);

      let storedCount = 0;

      for (let i = 0; i < Math.min(searchResults.length, maxResults); i++) {
        const result = searchResults[i];
        parts.push(`${i + 1}. ${result.title}`);
        parts.push(`   URL: ${result.url}`);
        if (result.snippet) {
          parts.push(`   ${result.snippet}`);
        }

        // Fetch and extract content if enabled
        if (fetchContent) {
          const content = await fetchPageContent(result.url, 8000);
          if (content) {
            const knowledge = extractKnowledge(content, result.url, query);

            if (knowledge.quality >= 0.3) {
              // Show extracted key points
              if (knowledge.keyPoints.length > 0) {
                parts.push(`   Key points:`);
                for (const point of knowledge.keyPoints.slice(0, 3)) {
                  parts.push(`     - ${point}`);
                }
              }

              // Show code examples
              if (knowledge.codeExamples.length > 0) {
                parts.push(`   Code example:`);
                parts.push(`   ${knowledge.codeExamples[0].slice(0, 500)}`);
              }

              // Store in spiral brain
              if (ctx.spiralEngine) {
                try {
                  const spiralContent = formatForSpiral(knowledge, query);
                  await ctx.spiralEngine.store(spiralContent, 'pattern', {
                    tags: ['web_knowledge', 'web_research', ...query.split(/\s+/).slice(0, 3)],
                    source: result.url,
                    web_topic: query,
                    quality: knowledge.quality,
                  });
                  storedCount++;
                } catch {
                  // Storage error, continue
                }
              }
            }
          }
        }

        parts.push('');
      }

      if (storedCount > 0) {
        parts.push(`\n[${storedCount} knowledge items stored in spiral brain for future reference]`);
      }

      return parts.join('\n');
    } catch (err) {
      return `Web research error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
