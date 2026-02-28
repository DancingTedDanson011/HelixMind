/**
 * Topic Detector — Extracts searchable topics from user messages.
 *
 * Identifies technologies, libraries, patterns, and concepts that
 * would benefit from fresh web knowledge.
 */

export interface DetectedTopic {
  /** Search query for the web */
  query: string;
  /** Relevance score 0-1 */
  relevance: number;
  /** Category: 'technology' | 'pattern' | 'error' | 'concept' */
  category: 'technology' | 'pattern' | 'error' | 'concept';
}

// Known technologies and frameworks for detection
const TECH_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Frontend
  { pattern: /\breact\b/i, label: 'React' },
  { pattern: /\bnext\.?js\b/i, label: 'Next.js' },
  { pattern: /\bvue\b/i, label: 'Vue.js' },
  { pattern: /\bsvelte\b/i, label: 'Svelte' },
  { pattern: /\bangular\b/i, label: 'Angular' },
  { pattern: /\btailwind\b/i, label: 'Tailwind CSS' },
  { pattern: /\bshadcn\b/i, label: 'shadcn/ui' },
  // Backend
  { pattern: /\bexpress\b/i, label: 'Express.js' },
  { pattern: /\bnest\.?js\b/i, label: 'NestJS' },
  { pattern: /\bfastify\b/i, label: 'Fastify' },
  { pattern: /\bdjango\b/i, label: 'Django' },
  { pattern: /\bflask\b/i, label: 'Flask' },
  { pattern: /\bspring\b/i, label: 'Spring Boot' },
  // Databases
  { pattern: /\bpostgres(?:ql)?\b/i, label: 'PostgreSQL' },
  { pattern: /\bmongo(?:db)?\b/i, label: 'MongoDB' },
  { pattern: /\bredis\b/i, label: 'Redis' },
  { pattern: /\bsqlite\b/i, label: 'SQLite' },
  { pattern: /\bprisma\b/i, label: 'Prisma' },
  { pattern: /\bdrizzle\b/i, label: 'Drizzle ORM' },
  // Auth
  { pattern: /\bjwt\b/i, label: 'JWT' },
  { pattern: /\boauth\b/i, label: 'OAuth' },
  { pattern: /\bpassport\b/i, label: 'Passport.js' },
  { pattern: /\bnext-?auth\b/i, label: 'NextAuth' },
  { pattern: /\bclerk\b/i, label: 'Clerk' },
  // DevOps
  { pattern: /\bdocker\b/i, label: 'Docker' },
  { pattern: /\bkubernetes\b|\bk8s\b/i, label: 'Kubernetes' },
  { pattern: /\bci\s*\/?\s*cd\b/i, label: 'CI/CD' },
  { pattern: /\bgithub\s+actions?\b/i, label: 'GitHub Actions' },
  // Languages
  { pattern: /\btypescript\b/i, label: 'TypeScript' },
  { pattern: /\brust\b/i, label: 'Rust' },
  { pattern: /\bpython\b/i, label: 'Python' },
  { pattern: /\bgo(?:lang)?\b/i, label: 'Go' },
  // Testing
  { pattern: /\bvitest\b/i, label: 'Vitest' },
  { pattern: /\bjest\b/i, label: 'Jest' },
  { pattern: /\bplaywright\b/i, label: 'Playwright' },
  { pattern: /\bcypress\b/i, label: 'Cypress' },
  // APIs & Protocols
  { pattern: /\bgraphql\b/i, label: 'GraphQL' },
  { pattern: /\bgrpc\b/i, label: 'gRPC' },
  { pattern: /\bwebsocket\b/i, label: 'WebSocket' },
  { pattern: /\brest\s+api\b/i, label: 'REST API' },
  // AI/ML
  { pattern: /\bopenai\b/i, label: 'OpenAI API' },
  { pattern: /\blangchain\b/i, label: 'LangChain' },
  { pattern: /\btransformer\b/i, label: 'Transformers' },
  { pattern: /\bembedding/i, label: 'Embeddings' },
  // Cloud
  { pattern: /\baws\b/i, label: 'AWS' },
  { pattern: /\bvercel\b/i, label: 'Vercel' },
  { pattern: /\bsupabase\b/i, label: 'Supabase' },
  { pattern: /\bfirebase\b/i, label: 'Firebase' },
  // Misc
  { pattern: /\bwebpack\b/i, label: 'Webpack' },
  { pattern: /\bvite\b/i, label: 'Vite' },
  { pattern: /\besbuild\b/i, label: 'esbuild' },
  { pattern: /\bturbopack\b/i, label: 'Turbopack' },
  { pattern: /\bstripe\b/i, label: 'Stripe' },
  { pattern: /\btelegram\b/i, label: 'Telegram Bot API' },
];

// Pattern keywords that suggest the user needs specific guidance
const PATTERN_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bauthentication\b|\bauth\b|\banmeldung\b|\blogin\b/i, label: 'authentication' },
  { pattern: /\bauthorization\b|\bberechtig/i, label: 'authorization' },
  { pattern: /\bcaching\b|\bcache\b/i, label: 'caching strategy' },
  { pattern: /\brate\s*limit/i, label: 'rate limiting' },
  { pattern: /\bpagination\b/i, label: 'pagination' },
  { pattern: /\bfile\s*upload/i, label: 'file upload' },
  { pattern: /\breal\s*time\b|\breal-?time\b/i, label: 'real-time' },
  { pattern: /\bserver\s*side\s*render/i, label: 'SSR' },
  { pattern: /\bmiddleware\b/i, label: 'middleware' },
  { pattern: /\bmigration\b/i, label: 'database migration' },
  { pattern: /\bdeployment\b|\bdeploy\b/i, label: 'deployment' },
  { pattern: /\btesting\b|\btest\b/i, label: 'testing' },
  { pattern: /\bperformance\b|\boptimiz/i, label: 'performance optimization' },
  { pattern: /\bsecurity\b|\bsicher/i, label: 'security' },
  { pattern: /\bapi\s*design\b|\bapi\s*endpoint/i, label: 'API design' },
  { pattern: /\bstate\s*management\b/i, label: 'state management' },
  { pattern: /\berror\s*handling\b|\bfehlerbehandlung/i, label: 'error handling' },
  { pattern: /\bvalidation\b|\bvalidierung/i, label: 'validation' },
  { pattern: /\bwebhook/i, label: 'webhooks' },
  { pattern: /\bpayment/i, label: 'payment integration' },
];

// Error-related patterns (Stack Overflow-worthy)
const ERROR_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\berror\b.*\b(\w+Error)\b/i, label: '$1' },
  { pattern: /\bcannot\s+find\s+module/i, label: 'module resolution error' },
  { pattern: /\btype\s*error\b/i, label: 'TypeError' },
  { pattern: /\bsyntax\s*error\b/i, label: 'SyntaxError' },
  { pattern: /\bcors\b/i, label: 'CORS error' },
  { pattern: /\b404\b|\bnot\s+found\b/i, label: '404 not found' },
  { pattern: /\b500\b|\binternal\s+server/i, label: '500 server error' },
  { pattern: /\bmemory\s*leak/i, label: 'memory leak' },
  { pattern: /\bdeadlock\b/i, label: 'deadlock' },
  { pattern: /\btimeout\b/i, label: 'timeout issue' },
];

/**
 * Detect topics from a user message that would benefit from web research.
 * Returns topics sorted by relevance.
 */
export function detectTopics(userMessage: string): DetectedTopic[] {
  const topics: DetectedTopic[] = [];
  const seen = new Set<string>();

  // Detect technologies
  const techs: string[] = [];
  for (const { pattern, label } of TECH_PATTERNS) {
    if (pattern.test(userMessage)) {
      techs.push(label);
    }
  }

  // Detect patterns/concepts
  const patterns: string[] = [];
  for (const { pattern, label } of PATTERN_KEYWORDS) {
    if (pattern.test(userMessage)) {
      patterns.push(label);
    }
  }

  // Detect errors
  for (const { pattern, label } of ERROR_PATTERNS) {
    const match = userMessage.match(pattern);
    if (match) {
      const errorLabel = label.includes('$1') && match[1]
        ? label.replace('$1', match[1])
        : label;

      const query = techs.length > 0
        ? `${techs[0]} ${errorLabel} solution`
        : `${errorLabel} fix`;

      if (!seen.has(query)) {
        seen.add(query);
        topics.push({ query, relevance: 0.9, category: 'error' });
      }
    }
  }

  // Combine tech + pattern for specific queries
  // e.g. "React" + "authentication" → "React authentication best practices"
  if (techs.length > 0 && patterns.length > 0) {
    for (const tech of techs.slice(0, 2)) { // max 2 techs
      for (const pat of patterns.slice(0, 2)) { // max 2 patterns
        const query = `${tech} ${pat} best practices`;
        if (!seen.has(query)) {
          seen.add(query);
          topics.push({ query, relevance: 0.85, category: 'pattern' });
        }
      }
    }
  }

  // Add standalone tech topics (lower priority if we already have combos)
  for (const tech of techs) {
    const query = `${tech} latest best practices`;
    if (!seen.has(query)) {
      seen.add(query);
      topics.push({
        query,
        relevance: patterns.length > 0 ? 0.5 : 0.7,
        category: 'technology',
      });
    }
  }

  // Sort by relevance, limit to top 3
  topics.sort((a, b) => b.relevance - a.relevance);
  return topics.slice(0, 3);
}

/**
 * Check if a user message likely needs web enrichment.
 * Returns false for simple chat, greetings, or commands.
 */
export function needsEnrichment(userMessage: string): boolean {
  const msg = userMessage.trim().toLowerCase();

  // Skip very short messages
  if (msg.length < 15) return false;

  // Skip greetings and chat
  if (/^(hi|hello|hey|hallo|moin|danke|thanks|ok|ja|nein|yes|no)\b/.test(msg)) return false;

  // Skip slash commands
  if (msg.startsWith('/')) return false;

  // Detect topics
  const topics = detectTopics(userMessage);
  return topics.length > 0;
}
