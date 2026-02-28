/**
 * Web Search Provider — Searches the internet for relevant knowledge.
 *
 * Uses DuckDuckGo Lite HTML search (no API key required).
 * Falls back gracefully if no internet connection.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Search the web using DuckDuckGo Lite.
 * Returns up to `maxResults` results.
 */
export async function webSearch(
  query: string,
  maxResults: number = 5,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  try {
    // Use DuckDuckGo Lite (HTML, no JS required)
    const encoded = encodeURIComponent(query);
    const url = `https://lite.duckduckgo.com/lite/?q=${encoded}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'HelixMind/0.1 (AI Coding Assistant)',
        'Accept': 'text/html',
      },
      signal,
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return parseDuckDuckGoLite(html, maxResults);
  } catch (err) {
    // Network error, timeout, etc. — log and return empty
    if (process.env.DEBUG) {
      console.error('[webSearch] Error:', err instanceof Error ? err.message : String(err));
    }
    return [];
  }
}

/**
 * Parse DuckDuckGo Lite HTML results.
 * The Lite version returns a simple table-based layout.
 */
function parseDuckDuckGoLite(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // DDG Lite puts results in table rows with class "result-link" or similar
  // Each result has: <a class="result-link" href="URL">Title</a>
  // followed by <td class="result-snippet">Snippet</td>

  // Extract links and snippets using regex (no DOM parser needed)
  // DDG Lite wraps result URLs in redirect links: //duckduckgo.com/l/?uddg=<encoded_url>&rut=...
  // Match both direct hrefs and redirect hrefs (single or double quotes)
  const linkPattern = /<a[^>]*rel=["']nofollow["'][^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/g;
  const snippetPattern = /<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g;

  const links: Array<{ url: string; title: string }> = [];
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const rawHref = match[1].replace(/&amp;/g, '&');
    const title = decodeHtmlEntities(match[2].trim());

    // Extract the real URL from DDG redirect links
    let url: string | null = null;

    if (rawHref.includes('uddg=')) {
      // DDG redirect link — extract the actual destination URL from the uddg parameter
      try {
        const uddgValue = rawHref.split('uddg=')[1]?.split('&')[0];
        if (uddgValue) {
          url = decodeURIComponent(uddgValue);
        }
      } catch {
        // Failed to decode — skip this link
      }
    } else if (rawHref.startsWith('http')) {
      // Direct link (rare but possible)
      url = rawHref;
    }

    // Skip DDG internal links, ads, and invalid URLs
    if (url && url.startsWith('http') && !url.includes('duckduckgo.com')) {
      links.push({ url, title });
    }
  }

  const snippets: string[] = [];
  while ((match = snippetPattern.exec(html)) !== null) {
    snippets.push(decodeHtmlEntities(stripHtml(match[1]).trim()));
  }

  // Pair links with snippets
  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] ?? '',
    });
  }

  return results;
}

/**
 * Fetch the text content of a web page.
 * Returns extracted text, limited to maxLength characters.
 */
export async function fetchPageContent(
  url: string,
  maxLength: number = 8000,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'HelixMind/0.1 (AI Coding Assistant)',
        'Accept': 'text/html',
      },
      signal,
      // 10 second timeout via AbortController if no signal provided
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return null; // Skip binary content
    }

    const html = await response.text();

    // Don't process huge pages
    if (html.length > 500_000) {
      return extractMainContent(html.slice(0, 200_000)).slice(0, maxLength);
    }

    return extractMainContent(html).slice(0, maxLength);
  } catch (err) {
    if (process.env.DEBUG) {
      console.error('[fetchPageContent] Error:', err instanceof Error ? err.message : String(err));
    }
    return null;
  }
}

/**
 * Extract the main readable content from HTML.
 * Focuses on article body, code blocks, and paragraphs.
 */
function extractMainContent(html: string): string {
  // Remove script, style, nav, header, footer
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '');

  // Extract code blocks first (important for dev docs)
  const codeBlocks: string[] = [];
  text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_m, code) => {
    const cleaned = decodeHtmlEntities(stripHtml(code)).trim();
    if (cleaned.length > 20) {
      codeBlocks.push('```\n' + cleaned + '\n```');
    }
    return '';
  });

  // Also get standalone <code> blocks
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, code) => {
    const cleaned = decodeHtmlEntities(stripHtml(code)).trim();
    if (cleaned.length > 50) {
      codeBlocks.push('`' + cleaned + '`');
    }
    return '';
  });

  // Get headings
  const headings: string[] = [];
  text.replace(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, (_m, content) => {
    headings.push('## ' + decodeHtmlEntities(stripHtml(content)).trim());
    return '';
  });

  // Get paragraphs
  const paragraphs: string[] = [];
  text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, content) => {
    const cleaned = decodeHtmlEntities(stripHtml(content)).trim();
    if (cleaned.length > 30) {
      paragraphs.push(cleaned);
    }
    return '';
  });

  // Get list items
  const listItems: string[] = [];
  text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, content) => {
    const cleaned = decodeHtmlEntities(stripHtml(content)).trim();
    if (cleaned.length > 15) {
      listItems.push('- ' + cleaned);
    }
    return '';
  });

  // Assemble: headings first, then paragraphs, then code blocks, then lists
  const sections: string[] = [];

  if (headings.length > 0) {
    sections.push(headings.slice(0, 10).join('\n'));
  }

  if (paragraphs.length > 0) {
    sections.push(paragraphs.slice(0, 15).join('\n\n'));
  }

  if (codeBlocks.length > 0) {
    sections.push(codeBlocks.slice(0, 5).join('\n\n'));
  }

  if (listItems.length > 0) {
    sections.push(listItems.slice(0, 20).join('\n'));
  }

  return sections.join('\n\n');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)));
}
