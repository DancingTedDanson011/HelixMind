import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const db = new Database('C:/Users/DancingTedDanson/Desktop/Neuer Ordner (4)/.helixmind/spiral.db');
const now = Date.now();

const l4Nodes = [
  { type: 'architecture', content: 'GraphQL gateway replaced REST aggregation layer. Apollo Server with schema stitching for microservice federation.', summary: 'REST to GraphQL gateway migration' },
  { type: 'pattern', content: 'Event sourcing adopted for order processing pipeline. CQRS with separate read/write models and Kafka event bus.', summary: 'Event sourcing + CQRS pattern adoption' },
  { type: 'decision', content: 'Moved from Winston to Pino for structured logging. 3x faster serialization, native JSON output.', summary: 'Winston to Pino logging migration' },
  { type: 'code', content: 'Legacy ORM (Sequelize) replaced by Drizzle for type-safe queries. Eliminated N+1 issues with explicit join syntax.', summary: 'Sequelize to Drizzle ORM migration' },
  { type: 'architecture', content: 'Service mesh migration: Istio replaced manual service discovery with Consul. Automatic mTLS, traffic splitting, canary.', summary: 'Consul to Istio service mesh migration' },
  { type: 'pattern', content: 'Rate limiting moved from application layer to API gateway. Kong with Redis-backed sliding window counters.', summary: 'App-level to gateway rate limiting' },
  { type: 'decision', content: 'Feature flag system migrated from LaunchDarkly to self-hosted Unleash. Cost reduction 90%, same functionality.', summary: 'LaunchDarkly to Unleash feature flags' },
  { type: 'code', content: 'Image processing pipeline refactored from ImageMagick CLI to Sharp (libvips). 5x faster thumbnail generation.', summary: 'ImageMagick to Sharp image processing' },
  { type: 'architecture', content: 'Monorepo transition from Lerna to Turborepo. Build caching reduced CI from 12min to 3min average.', summary: 'Lerna to Turborepo monorepo migration' },
  { type: 'pattern', content: 'Authentication middleware chain refactored from Express middleware to NestJS guards with decorators.', summary: 'Express middleware to NestJS guards' },
  { type: 'decision', content: 'Replaced Redis pub/sub with NATS JetStream for inter-service messaging. Better durability and replay.', summary: 'Redis pub/sub to NATS JetStream' },
  { type: 'code', content: 'Date handling library migration: moment.js deprecated, replaced with date-fns for tree-shaking and smaller bundles.', summary: 'moment.js to date-fns migration' },
  { type: 'architecture', content: 'Database connection pooling moved from application-level to PgBouncer. Reduced connection overhead by 80%.', summary: 'App-level to PgBouncer connection pooling' },
  { type: 'pattern', content: 'Error boundary pattern adopted in React components. Sentry integration for automatic error reporting.', summary: 'React error boundaries + Sentry adoption' },
  { type: 'decision', content: 'CI/CD pipeline migrated from Jenkins to GitHub Actions. Self-hosted runners for build performance.', summary: 'Jenkins to GitHub Actions CI/CD' },
  { type: 'code', content: 'Cron job scheduler replaced from node-cron to BullMQ with Redis. Distributed job processing with retries.', summary: 'node-cron to BullMQ job scheduler' },
  { type: 'architecture', content: 'Frontend build split: Vite for development, esbuild for production. Sub-second HMR and 200ms prod builds.', summary: 'Dual build system Vite + esbuild' },
  { type: 'pattern', content: 'API versioning strategy changed from URL-based (/v1/) to header-based (Accept-Version). Cleaner routing.', summary: 'URL to header-based API versioning' },
  { type: 'decision', content: 'Switched from JWT refresh tokens to sliding session with Redis store. Better revocation and security.', summary: 'JWT refresh to sliding sessions' },
  { type: 'code', content: 'Form validation moved from Joi to Zod. TypeScript-first schema with automatic type inference.', summary: 'Joi to Zod schema validation' },
  { type: 'architecture', content: 'CDN strategy changed from CloudFront to Cloudflare Workers for edge computing. Dynamic content at edge.', summary: 'CloudFront to Cloudflare Workers' },
  { type: 'pattern', content: 'State synchronization pattern: optimistic updates with rollback using Tanstack Query mutation callbacks.', summary: 'Optimistic update pattern with Tanstack Query' },
  { type: 'decision', content: 'Email service migration from Sendgrid to Resend. Better DX, React email templates, lower cost.', summary: 'Sendgrid to Resend email migration' },
  { type: 'code', content: 'Legacy callback-based file operations replaced with fs/promises. Eliminated callback hell in file processing.', summary: 'Callback fs to fs/promises migration' },
  { type: 'architecture', content: 'Observability stack replaced: Datadog to self-hosted Grafana+Prometheus+Loki. 95% cost reduction.', summary: 'Datadog to Grafana observability stack' },
  { type: 'pattern', content: 'Repository pattern replaced with direct database access via Drizzle queries. Less abstraction, more clarity.', summary: 'Repository pattern to direct DB queries' },
  { type: 'decision', content: 'Mobile app approach changed from React Native to Progressive Web App. Reduced maintenance from 3 codebases to 1.', summary: 'React Native to PWA migration' },
  { type: 'code', content: 'XML config parsing replaced by TOML. Human-readable, type-safe parsing with @ltd/j-toml library.', summary: 'XML to TOML configuration migration' },
  { type: 'architecture', content: 'Database sharding implemented for user data. Consistent hashing across 8 PostgreSQL shards.', summary: 'Database sharding implementation' },
  { type: 'pattern', content: 'Retry logic standardized with exponential backoff + jitter. cockatiel library for circuit breaker.', summary: 'Standardized retry with circuit breaker' },
  { type: 'decision', content: 'Storage backend moved from local filesystem to S3-compatible MinIO. Horizontal scaling for uploads.', summary: 'Local storage to MinIO/S3 migration' },
  { type: 'code', content: 'Test data factories replaced manual fixtures. @faker-js/faker for realistic test data generation.', summary: 'Manual fixtures to Faker factories' },
  { type: 'architecture', content: 'Websocket infrastructure replaced socket.io with native ws library. 60% less memory per connection.', summary: 'socket.io to ws library migration' },
  { type: 'pattern', content: 'Pagination strategy changed from offset-based to cursor-based. Consistent results with real-time data changes.', summary: 'Offset to cursor-based pagination' },
  { type: 'decision', content: 'Search engine migrated from Elasticsearch to Meilisearch. Simpler operations, faster indexing, smaller footprint.', summary: 'Elasticsearch to Meilisearch migration' },
  { type: 'code', content: 'HTTP client replaced axios with native fetch + ofetch wrapper. Smaller bundle, better error handling.', summary: 'Axios to native fetch migration' },
  { type: 'architecture', content: 'Multi-tenant isolation changed from shared schema to schema-per-tenant in PostgreSQL. Better data isolation.', summary: 'Shared to per-tenant schema isolation' },
  { type: 'pattern', content: 'Dependency injection moved from InversifyJS to tsyringe. Lighter weight, better TypeScript integration.', summary: 'InversifyJS to tsyringe DI migration' },
  { type: 'decision', content: 'Documentation system changed from Docusaurus to Starlight (Astro). Faster builds, better i18n support.', summary: 'Docusaurus to Starlight docs migration' },
  { type: 'code', content: 'ID generation changed from auto-increment to ULIDs. Sortable, distributed-safe, URL-friendly identifiers.', summary: 'Auto-increment to ULID ID generation' },
  { type: 'architecture', content: 'Background job processing moved from in-process to separate worker nodes. Isolation prevents job crashes from affecting API.', summary: 'In-process to worker node job processing' },
  { type: 'pattern', content: 'Configuration management centralized with dotenv-vault. Encrypted .env files with team sharing and rotation.', summary: 'dotenv to dotenv-vault config management' },
  { type: 'decision', content: 'Package manager migrated from npm to pnpm. 40% disk savings, strict dependency resolution, faster installs.', summary: 'npm to pnpm package manager migration' },
  { type: 'code', content: 'CSS-in-JS removed (styled-components) in favor of Tailwind + CSS Modules. 30% smaller CSS bundle.', summary: 'styled-components to Tailwind migration' },
  { type: 'architecture', content: 'API gateway pattern implemented with Fastify. Request validation, rate limiting, auth in single entry point.', summary: 'Fastify API gateway implementation' },
  { type: 'pattern', content: 'Database migration tool switched from knex to Drizzle Kit. Declarative schema diffs, automatic SQL generation.', summary: 'Knex to Drizzle Kit migrations' },
  { type: 'decision', content: 'Container orchestration simplified from Kubernetes to Docker Compose + Coolify. 90% less ops complexity.', summary: 'Kubernetes to Docker Compose + Coolify' },
  { type: 'code', content: 'PDF generation replaced puppeteer-based rendering with @react-pdf/renderer. Streaming PDF creation, 10x faster.', summary: 'Puppeteer to @react-pdf PDF generation' },
  { type: 'architecture', content: 'Session storage moved from server memory to distributed Redis cluster. Horizontal scaling without sticky sessions.', summary: 'Memory to Redis distributed sessions' },
  { type: 'pattern', content: 'Webhook delivery system implemented with outbox pattern. Guaranteed delivery with PostgreSQL + BullMQ.', summary: 'Outbox pattern for webhook delivery' },
];

const l5Nodes = [
  { type: 'wisdom', content: 'Spiral memory concept discovered through research on human hippocampal memory consolidation. Frequently accessed memories strengthen, unused ones fade.', summary: 'Spiral memory from hippocampal research' },
  { type: 'knowledge', content: 'Vector database comparison 2023: Pinecone, Weaviate, Chroma, sqlite-vec. Chose sqlite-vec for zero-dependency, single-file portability.', summary: 'Vector DB: sqlite-vec for portability' },
  { type: 'wisdom', content: 'Agent tool design principle: every tool should be idempotent where possible. Re-running the same tool with same args should produce same result.', summary: 'Tool idempotency design principle' },
  { type: 'knowledge', content: 'LLM context window research: tested GPT-4-128k, Claude-3-200k. Found diminishing returns beyond 30k tokens for coding tasks.', summary: 'Context window diminishing returns at 30k' },
  { type: 'wisdom', content: 'Three-tier permission model emerged from analyzing 200+ developer tools. Auto (safe), Ask (risky), Dangerous (destructive) with escape hatch.', summary: 'Three-tier permissions from tool analysis' },
  { type: 'knowledge', content: 'Embedding model benchmarking: MiniLM-L6-v2 matched 95% of ada-002 quality on code similarity tasks at zero API cost.', summary: 'MiniLM-L6-v2 matches ada-002 at 95%' },
  { type: 'wisdom', content: 'Project architecture evolution: started as MCP-only server, added CLI when realized developers want integrated tools, not protocol intermediaries.', summary: 'MCP server to integrated CLI evolution' },
  { type: 'knowledge', content: 'SQLite WAL mode testing: 10x write throughput improvement for concurrent reads. Essential for spiral memory during active coding sessions.', summary: 'SQLite WAL mode 10x write improvement' },
  { type: 'wisdom', content: 'Validation matrix design: static checks catch 60% of issues instantly, dynamic (mini-LLM) catches 30%, spiral knowledge catches remaining 10%.', summary: 'Validation matrix: 60/30/10 catch rate' },
  { type: 'knowledge', content: 'Browser automation research: compared Playwright, Puppeteer, Selenium. Chose Puppeteer-core for minimal footprint and Chrome DevTools Protocol.', summary: 'Puppeteer-core for browser automation' },
  { type: 'wisdom', content: 'Checkpoint system designed after studying git stash and IDE local history. Auto-checkpoint at every tool call ensures zero work loss.', summary: 'Checkpoint system from git stash study' },
  { type: 'knowledge', content: 'Token counting optimization: tiktoken WASM too slow, switched to character-based estimation (4 chars/token) with 5% accuracy margin.', summary: 'Token counting: char estimation over tiktoken' },
  { type: 'wisdom', content: 'Bug journal auto-detection: pattern matching on user messages for frustration signals (funktioniert nicht, broken, error) triggers automatic bug tracking.', summary: 'Bug detection from frustration patterns' },
  { type: 'knowledge', content: 'WebSocket protocol design: chose JSON envelope with type field over binary protobuf. Debuggability trumps performance for dev tools.', summary: 'JSON WebSocket over protobuf for debuggability' },
  { type: 'wisdom', content: 'CLI UX principle: every action should have visual feedback within 100ms. Spinner for >500ms, progress bar for >3s, cancel option for >10s.', summary: 'CLI feedback timing: 100ms/500ms/3s/10s' },
  { type: 'knowledge', content: 'Spiral level decay algorithm: exponential decay with half-life based on access frequency. Active nodes survive, dormant ones sink to deeper levels.', summary: 'Exponential decay with access-based half-life' },
  { type: 'wisdom', content: 'Session management insight: developers context-switch constantly. Background sessions let agent work on security/refactoring while user stays in main chat.', summary: 'Background sessions for context switching' },
  { type: 'knowledge', content: 'Fast-glob benchmarking: 3x faster than globby for large repos. Combined with ignore library for .gitignore-aware file discovery.', summary: 'fast-glob 3x faster than globby' },
  { type: 'wisdom', content: 'Web knowledge enrichment: auto-fetching web info during coding sessions fills knowledge gaps. Topic detection → search → extract → store in spiral.', summary: 'Web enrichment auto-fills knowledge gaps' },
  { type: 'knowledge', content: 'Three.js performance testing: Points geometry with ShaderMaterial handles 50k+ nodes at 60fps. InstancedMesh slower for simple spheres.', summary: 'Three.js Points > InstancedMesh for 50k nodes' },
  { type: 'wisdom', content: 'Config design: ~/.helixmind/config.json for user prefs, .helixmind/ per project. Separation prevents project settings from leaking globally.', summary: 'Global vs project config separation' },
  { type: 'knowledge', content: 'Commander.js chosen over yargs/oclif for CLI framework. Simpler API, better TypeScript support, lower overhead.', summary: 'Commander.js over yargs/oclif for CLI' },
  { type: 'wisdom', content: 'Provider abstraction lesson: building LLMProvider interface early enabled painless Anthropic/OpenAI/Ollama switching without touching agent code.', summary: 'LLM provider abstraction enables switching' },
  { type: 'knowledge', content: 'DuckDuckGo search API: no auth required, reasonable rate limits. Perfect for web knowledge enrichment without API key management.', summary: 'DuckDuckGo: keyless search for enrichment' },
  { type: 'wisdom', content: 'Open source strategy: AGPL-3.0 ensures code stays open while allowing SaaS monetization. Inspired by GitLab dual-licensing approach.', summary: 'AGPL-3.0 for open + SaaS monetization' },
  { type: 'knowledge', content: 'MCP protocol evaluation: STDIO transport most reliable for local tools. HTTP+SSE flaky with long-running connections. WebSocket for real-time.', summary: 'MCP: STDIO for local, WS for real-time' },
  { type: 'wisdom', content: 'Brain visualization philosophy: 3D graph is not decoration, it is the developer thinking about their codebase. Each node is a memory, each edge a connection.', summary: 'Brain viz as developer thinking tool' },
  { type: 'knowledge', content: 'Adm-zip chosen for export/import over archiver. Simpler API, synchronous operations match CLI workflow, smaller dependency.', summary: 'adm-zip over archiver for exports' },
  { type: 'wisdom', content: 'YOLO mode design: developers sometimes need to move fast. Skip-permissions removes friction for experienced users who understand the risks.', summary: 'YOLO mode for experienced developers' },
  { type: 'knowledge', content: 'Marked + marked-terminal for rich markdown in CLI. Syntax highlighting via cli-highlight. Terminal becomes a document viewer.', summary: 'Marked + cli-highlight for rich CLI output' },
  { type: 'wisdom', content: 'Agent loop max iterations (25) chosen after testing: 90% of tasks complete in <10 iterations. 25 catches complex multi-step refactors without infinite loops.', summary: 'Agent 25-iteration limit from usage data' },
  { type: 'knowledge', content: 'Figlet + gradient-string for CLI branding. ASCII art header creates memorable first impression and brand recognition.', summary: 'Figlet + gradient for CLI brand identity' },
  { type: 'wisdom', content: 'Dual-connect architecture: local WebSocket for speed + relay for remote access. Same protocol both ways simplifies client implementation.', summary: 'Dual-connect: local WS + relay same protocol' },
  { type: 'knowledge', content: 'Chrome-finder algorithm: searches common install paths across Windows/Mac/Linux. Falls back to which/where for unusual installs.', summary: 'Chrome-finder cross-platform detection' },
  { type: 'wisdom', content: 'Tool classification insight: read operations are always safe, write operations need confirmation, delete operations need double confirmation.', summary: 'Tool safety: read=safe, write=ask, delete=confirm' },
  { type: 'knowledge', content: 'Zod schema validation chosen over io-ts, superstruct. Best TypeScript inference, smallest API surface, most active maintenance.', summary: 'Zod over io-ts/superstruct for validation' },
  { type: 'wisdom', content: 'SaaS pricing lesson: free tier must provide enough value to create habit. Pro tier monetizes power users. Enterprise is custom.', summary: 'SaaS pricing: free=habit, pro=power, ent=custom' },
  { type: 'knowledge', content: 'Next.js 15 App Router with server components: 40% reduction in client JS. RSC for data-heavy pages, client components only for interactivity.', summary: 'Next.js 15 RSC: 40% less client JS' },
  { type: 'wisdom', content: 'Internationalization strategy: next-intl with EN+DE first. German market is primary target. Other languages added based on user demand.', summary: 'i18n: EN+DE first, expand by demand' },
  { type: 'knowledge', content: 'Stripe integration: Checkout Sessions for payment, Customer Portal for self-service management. Webhook events for subscription state sync.', summary: 'Stripe: Checkout + Portal + Webhooks' },
];

const insertNode = db.prepare('INSERT INTO nodes (id, type, content, summary, level, relevance_score, token_count, metadata, created_at, updated_at, accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insertEdge = db.prepare('INSERT OR IGNORE INTO edges (id, source_id, target_id, relation_type, weight, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

const allNewIds = [];
const relTypes = ['evolved_from', 'references', 'supports', 'related_to', 'depends_on', 'implements', 'extends', 'uses', 'inspired_by', 'contradicts'];

const existingL1 = db.prepare('SELECT id FROM nodes WHERE level=1 LIMIT 30').all().map(r => r.id);
const existingL2 = db.prepare('SELECT id FROM nodes WHERE level=2 LIMIT 20').all().map(r => r.id);
const existingL3 = db.prepare('SELECT id FROM nodes WHERE level=3 LIMIT 20').all().map(r => r.id);
const existingL4 = db.prepare('SELECT id FROM nodes WHERE level=4 LIMIT 10').all().map(r => r.id);

const insert = db.transaction(() => {
  for (const n of l4Nodes) {
    const id = randomUUID();
    allNewIds.push({ id, level: 4 });
    insertNode.run(id, n.type, n.content, n.summary, 4, 0.2 + Math.random() * 0.4, n.content.length, '{}', now - 86400000 * (20 + Math.random()*60), now, now - 86400000 * (5 + Math.random()*20));
  }
  for (const n of l5Nodes) {
    const id = randomUUID();
    allNewIds.push({ id, level: 5 });
    insertNode.run(id, n.type, n.content, n.summary, 5, 0.1 + Math.random() * 0.3, n.content.length, '{}', now - 86400000 * (60 + Math.random()*120), now, now - 86400000 * (30 + Math.random()*90));
  }

  // Edges between new nodes
  for (let i = 0; i < allNewIds.length; i++) {
    for (let j = i + 1; j < allNewIds.length; j++) {
      if (Math.random() < 0.25) {
        const rt = relTypes[Math.floor(Math.random() * relTypes.length)];
        insertEdge.run(randomUUID(), allNewIds[i].id, allNewIds[j].id, rt, 0.15 + Math.random() * 0.5, '{}', now);
      }
    }
  }

  // L4 -> L1/L2/L3 cross-level edges
  for (const n4 of allNewIds.filter(n => n.level === 4)) {
    for (let k = 0; k < 4; k++) {
      const target = existingL1[Math.floor(Math.random() * existingL1.length)];
      if (target) insertEdge.run(randomUUID(), target, n4.id, 'evolved_from', 0.3 + Math.random() * 0.4, '{}', now);
    }
    for (let k = 0; k < 2; k++) {
      const target = existingL2[Math.floor(Math.random() * existingL2.length)];
      if (target) insertEdge.run(randomUUID(), n4.id, target, 'references', 0.2 + Math.random() * 0.3, '{}', now);
    }
    for (let k = 0; k < 2; k++) {
      const target = existingL3[Math.floor(Math.random() * existingL3.length)];
      if (target) insertEdge.run(randomUUID(), n4.id, target, 'supports', 0.2 + Math.random() * 0.3, '{}', now);
    }
  }

  // L5 -> L4 and L5 -> L2/L3 cross-level edges
  const l4ids = [...existingL4, ...allNewIds.filter(n => n.level === 4).map(n => n.id)];
  for (const n5 of allNewIds.filter(n => n.level === 5)) {
    for (let k = 0; k < 3; k++) {
      const l4target = l4ids[Math.floor(Math.random() * l4ids.length)];
      if (l4target) insertEdge.run(randomUUID(), n5.id, l4target, 'inspired_by', 0.4 + Math.random() * 0.4, '{}', now);
    }
    for (let k = 0; k < 2; k++) {
      const target = existingL2[Math.floor(Math.random() * existingL2.length)];
      if (target) insertEdge.run(randomUUID(), n5.id, target, 'supports', 0.2 + Math.random() * 0.3, '{}', now);
    }
    for (let k = 0; k < 2; k++) {
      const target = existingL3[Math.floor(Math.random() * existingL3.length)];
      if (target) insertEdge.run(randomUUID(), n5.id, target, 'references', 0.2 + Math.random() * 0.3, '{}', now);
    }
  }
});
insert();

const counts = db.prepare('SELECT level, count(*) as cnt FROM nodes GROUP BY level ORDER BY level').all();
console.log('Node counts per level:', JSON.stringify(counts));
const totalE = db.prepare('SELECT count(*) as c FROM edges').get();
console.log('Total edges:', totalE.c);
db.close();
console.log('Done: Added', l4Nodes.length, 'L4 +', l5Nodes.length, 'L5 nodes');
