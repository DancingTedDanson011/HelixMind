/**
 * Content Extractor — Processes raw web content into spiral-ready knowledge.
 *
 * Takes HTML text/extracted content and produces clean, structured
 * knowledge chunks that can be stored in the spiral brain.
 */

export interface ExtractedKnowledge {
  /** Compressed summary of the content */
  summary: string;
  /** Code examples found */
  codeExamples: string[];
  /** Key points / best practices */
  keyPoints: string[];
  /** Source URL */
  source: string;
  /** Estimated quality score 0-1 */
  quality: number;
}

/**
 * Extract structured knowledge from page content.
 */
export function extractKnowledge(
  content: string,
  sourceUrl: string,
  topic: string,
): ExtractedKnowledge {
  const codeExamples = extractCodeBlocks(content);
  const keyPoints = extractKeyPoints(content, topic);
  const summary = buildSummary(content, topic, keyPoints);
  const quality = assessQuality(content, codeExamples, keyPoints, topic);

  return {
    summary,
    codeExamples: codeExamples.slice(0, 3), // Max 3 code examples
    keyPoints: keyPoints.slice(0, 8),         // Max 8 key points
    source: sourceUrl,
    quality,
  };
}

/**
 * Format extracted knowledge into a spiral-storable string.
 */
export function formatForSpiral(
  knowledge: ExtractedKnowledge,
  topic: string,
): string {
  const sections: string[] = [];

  sections.push(`[Web Knowledge: ${topic}]`);
  sections.push(`Source: ${knowledge.source}`);
  sections.push('');

  if (knowledge.summary) {
    sections.push(knowledge.summary);
    sections.push('');
  }

  if (knowledge.keyPoints.length > 0) {
    sections.push('Key Points:');
    for (const point of knowledge.keyPoints) {
      sections.push(`- ${point}`);
    }
    sections.push('');
  }

  if (knowledge.codeExamples.length > 0) {
    sections.push('Code Examples:');
    for (const code of knowledge.codeExamples) {
      sections.push(code);
      sections.push('');
    }
  }

  return sections.join('\n').slice(0, 4000); // Max 4000 chars per node
}

/**
 * Extract code blocks from content (markdown-style or raw).
 */
function extractCodeBlocks(content: string): string[] {
  const blocks: string[] = [];

  // Markdown fenced code blocks
  const fencedPattern = /```[\w]*\n([\s\S]*?)```/g;
  let match;

  while ((match = fencedPattern.exec(content)) !== null) {
    const code = match[1].trim();
    if (code.length > 20 && code.length < 2000) {
      blocks.push('```\n' + code + '\n```');
    }
  }

  // Inline code (longer ones, likely examples)
  const inlinePattern = /`([^`]{50,500})`/g;
  while ((match = inlinePattern.exec(content)) !== null) {
    blocks.push('`' + match[1].trim() + '`');
  }

  return blocks;
}

/**
 * Extract key points related to the topic.
 */
function extractKeyPoints(content: string, topic: string): string[] {
  const points: string[] = [];
  const topicWords = topic.toLowerCase().split(/\s+/);
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty, very short, or very long lines
    if (trimmed.length < 20 || trimmed.length > 300) continue;

    // List items that mention the topic
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\./.test(trimmed)) {
      const lower = trimmed.toLowerCase();
      const isRelevant = topicWords.some(w => lower.includes(w));
      if (isRelevant) {
        points.push(trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
      }
    }

    // Sentences with "best practice", "should", "recommend", "important"
    if (/\b(best practice|should|recommend|important|always|never|avoid|prefer|use|tip)\b/i.test(trimmed)) {
      const lower = trimmed.toLowerCase();
      const isRelevant = topicWords.some(w => lower.includes(w));
      if (isRelevant && !trimmed.startsWith('#')) {
        // Clean up and add
        const clean = trimmed
          .replace(/^#+\s*/, '')
          .replace(/\*\*/g, '')
          .trim();
        if (clean.length > 20 && !points.includes(clean)) {
          points.push(clean);
        }
      }
    }
  }

  return points;
}

/**
 * Build a concise summary from the content.
 */
function buildSummary(content: string, topic: string, keyPoints: string[]): string {
  // If we have key points, build summary from them
  if (keyPoints.length >= 3) {
    return `${topic}: ${keyPoints.slice(0, 3).join('. ')}.`;
  }

  // Otherwise extract first relevant paragraph
  const paragraphs = content.split('\n\n');
  const topicWords = topic.toLowerCase().split(/\s+/);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 50 || trimmed.length > 500) continue;
    if (trimmed.startsWith('```') || trimmed.startsWith('#')) continue;

    const lower = trimmed.toLowerCase();
    if (topicWords.some(w => lower.includes(w))) {
      return trimmed.slice(0, 300);
    }
  }

  // Fallback: first substantial paragraph
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length > 50 && trimmed.length < 500 && !trimmed.startsWith('```')) {
      return trimmed.slice(0, 300);
    }
  }

  return `Web knowledge about ${topic}`;
}

/**
 * Assess the quality of extracted content.
 * Higher quality = more code examples, more key points, topic relevance.
 */
function assessQuality(
  content: string,
  codeExamples: string[],
  keyPoints: string[],
  topic: string,
): number {
  let score = 0.3; // Base score for having any content

  // Code examples boost quality
  if (codeExamples.length > 0) score += 0.2;
  if (codeExamples.length >= 2) score += 0.1;

  // Key points boost quality
  if (keyPoints.length >= 3) score += 0.15;
  if (keyPoints.length >= 5) score += 0.1;

  // Topic mention density
  const topicWords = topic.toLowerCase().split(/\s+/);
  const lower = content.toLowerCase();
  let mentions = 0;
  for (const word of topicWords) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    const matches = lower.match(regex);
    mentions += matches?.length ?? 0;
  }
  if (mentions > 5) score += 0.1;
  if (mentions > 15) score += 0.05;

  return Math.min(1.0, score);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
