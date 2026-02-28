import { describe, it, expect } from 'vitest';
import { extractKnowledge, formatForSpiral } from '../../../src/spiral/cloud/content-extractor.js';

describe('Content Extractor', () => {
  describe('extractKnowledge', () => {
    it('extracts code blocks from markdown content', () => {
      const content = `
## Authentication with JWT

Here is how to implement JWT authentication:

\`\`\`javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: 1 }, 'secret');
\`\`\`

You should always validate tokens on the server side.
      `;

      const result = extractKnowledge(content, 'https://example.com/jwt', 'JWT authentication');
      expect(result.codeExamples.length).toBeGreaterThan(0);
      expect(result.source).toBe('https://example.com/jwt');
    });

    it('extracts key points with recommendations', () => {
      const content = `
## React Best Practices

- You should always use keys when rendering React lists
- Avoid using index as key in React components
- Use React.memo for expensive React components
- Always clean up React useEffect subscriptions
      `;

      const result = extractKnowledge(content, 'https://example.com/react', 'React best practices');
      expect(result.keyPoints.length).toBeGreaterThan(0);
    });

    it('builds a summary from content', () => {
      const content = `
React authentication is the process of verifying user identity in React applications.
The most common approaches include JWT tokens, session-based auth, and OAuth providers.
      `;

      const result = extractKnowledge(content, 'https://example.com', 'React authentication');
      expect(result.summary.length).toBeGreaterThan(10);
    });

    it('assesses quality based on content richness', () => {
      const richContent = `
## Express Middleware Best Practices

You should always validate input in Express middleware.
Use helmet for Express security headers.
Never expose Express error details in production.

\`\`\`javascript
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
\`\`\`

- Always use error handling Express middleware
- Use compression Express middleware for production
      `;

      const poorContent = 'Hello world. This is a page.';

      const richResult = extractKnowledge(richContent, 'https://example.com', 'Express middleware');
      const poorResult = extractKnowledge(poorContent, 'https://example.com', 'random topic');

      expect(richResult.quality).toBeGreaterThan(poorResult.quality);
    });

    it('limits code examples to 3', () => {
      const content = Array(10).fill('```\nconst x = 1;\nconst y = 2;\nconst z = 3;\n```').join('\n\n');
      const result = extractKnowledge(content, 'https://example.com', 'test');
      expect(result.codeExamples.length).toBeLessThanOrEqual(3);
    });

    it('limits key points to 8', () => {
      const content = Array(20).fill('- You should always use test in your test code for best results').join('\n');
      const result = extractKnowledge(content, 'https://example.com', 'test');
      expect(result.keyPoints.length).toBeLessThanOrEqual(8);
    });
  });

  describe('formatForSpiral', () => {
    it('formats knowledge into a spiral-storable string', () => {
      const knowledge = {
        summary: 'JWT authentication guide',
        codeExamples: ['```\nconst token = jwt.sign(data, secret);\n```'],
        keyPoints: ['Always validate tokens server-side', 'Use short expiry times'],
        source: 'https://example.com/jwt',
        quality: 0.8,
      };

      const formatted = formatForSpiral(knowledge, 'JWT authentication');
      expect(formatted).toContain('[Web Knowledge: JWT authentication]');
      expect(formatted).toContain('Source: https://example.com/jwt');
      expect(formatted).toContain('Key Points:');
      expect(formatted).toContain('Code Examples:');
    });

    it('truncates to max 4000 characters', () => {
      const knowledge = {
        summary: 'x'.repeat(5000),
        codeExamples: [],
        keyPoints: [],
        source: 'https://example.com',
        quality: 0.5,
      };

      const formatted = formatForSpiral(knowledge, 'test');
      expect(formatted.length).toBeLessThanOrEqual(4000);
    });

    it('includes topic and source in output', () => {
      const knowledge = {
        summary: 'Test summary',
        codeExamples: [],
        keyPoints: ['Point 1'],
        source: 'https://docs.example.com/api',
        quality: 0.6,
      };

      const formatted = formatForSpiral(knowledge, 'API design');
      expect(formatted).toContain('API design');
      expect(formatted).toContain('https://docs.example.com/api');
    });
  });
});
