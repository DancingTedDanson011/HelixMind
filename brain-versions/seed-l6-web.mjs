import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const db = new Database('C:/Users/DancingTedDanson/Desktop/Neuer Ordner (4)/.helixmind/spiral.db');
const now = Date.now();

const l6Nodes = [
  // --- Documentation & API References ---
  { type: 'web_knowledge', content: 'Three.js BufferGeometry docs: setAttribute() for position, color, size arrays. Float32Array for typed data. needsUpdate=true after modifications.', summary: 'Three.js BufferGeometry API reference' },
  { type: 'web_knowledge', content: 'MDN Web Workers API: postMessage() for data transfer, onmessage handler. Structured cloning for ArrayBuffer transfer. Terminate with worker.terminate().', summary: 'MDN Web Workers API documentation' },
  { type: 'web_knowledge', content: 'Node.js crypto.randomUUID() available since v19. Replacement for uuid package. Returns RFC 4122 v4 UUID string.', summary: 'Node.js crypto.randomUUID() docs' },
  { type: 'web_knowledge', content: 'SQLite WAL mode: Write-Ahead Logging enables concurrent reads during writes. PRAGMA journal_mode=WAL. Checkpoint with PRAGMA wal_checkpoint.', summary: 'SQLite WAL mode documentation' },
  { type: 'web_knowledge', content: 'Vitest configuration: vitest.config.ts with defineConfig. Coverage via @vitest/coverage-v8. Test isolation with pool: "forks".', summary: 'Vitest config and coverage setup' },
  { type: 'web_knowledge', content: 'TypeScript 5.5 decorator metadata: Stage 3 proposal support. @sealed, @log decorators with metadata reflection.', summary: 'TypeScript 5.5 decorator metadata' },
  { type: 'web_knowledge', content: 'ESM in Node.js: "type":"module" in package.json. import.meta.url for __dirname equivalent. Dynamic import() for CJS modules.', summary: 'ESM module system in Node.js' },
  { type: 'web_knowledge', content: 'Commander.js v13: .command() for subcommands, .option() with types, .action() handler. .parseAsync() for async operations.', summary: 'Commander.js v13 CLI framework docs' },
  { type: 'web_knowledge', content: 'better-sqlite3: Synchronous SQLite bindings for Node.js. db.prepare().run/get/all(). Transaction via db.transaction(). WAL mode support.', summary: 'better-sqlite3 API documentation' },
  { type: 'web_knowledge', content: 'Anthropic Claude API: Messages endpoint with streaming. Tool use via tools array. System prompt separate from messages.', summary: 'Anthropic Claude API reference' },

  // --- Stack Overflow / Forum Solutions ---
  { type: 'web_knowledge', content: 'SO solution: EBUSY error on Windows when deleting SQLite WAL files. Fix: wrap fs.rmSync in try/catch, retry after 100ms delay.', summary: 'Fix: EBUSY on Windows SQLite WAL cleanup' },
  { type: 'web_knowledge', content: 'SO solution: ESM + CJS interop for native modules. Use createRequire(import.meta.url) to load CJS-only packages in ESM context.', summary: 'Fix: CJS native modules in ESM context' },
  { type: 'web_knowledge', content: 'GitHub issue: chalk v5 is ESM-only. Import as `import chalk from "chalk"`. No more require(). Breaking change from v4.', summary: 'chalk v5 ESM migration guide' },
  { type: 'web_knowledge', content: 'SO solution: Three.js raycaster with Points geometry. Set threshold in raycaster.params.Points.threshold for point cloud picking.', summary: 'Three.js raycaster threshold for Points' },
  { type: 'web_knowledge', content: 'Reddit r/webgl: AdditiveBlending causes white saturation with many overlapping particles. Solution: use NormalBlending or reduce alpha.', summary: 'WebGL additive blending saturation fix' },
  { type: 'web_knowledge', content: 'SO solution: Web Worker inline creation via Blob URL. new Worker(URL.createObjectURL(new Blob([code], {type:"text/javascript"}))).', summary: 'Inline Web Worker via Blob URL pattern' },
  { type: 'web_knowledge', content: 'GitHub discussion: OrbitControls enableDamping causes stuttering on high-refresh monitors. Fix: dampingFactor=0.05, explicit controls.update() in rAF.', summary: 'OrbitControls damping on 240Hz monitors' },
  { type: 'web_knowledge', content: 'SO solution: requestAnimationFrame throttled to 1-2fps in background Chrome tabs. Use setTimeout fallback or document.hidden check.', summary: 'Chrome background tab rAF throttling' },
  { type: 'web_knowledge', content: 'Forum answer: sqlite-vec extension loading in ESM. Must use require() via createRequire, not import. Binary .node files cannot be imported.', summary: 'sqlite-vec ESM loading workaround' },
  { type: 'web_knowledge', content: 'SO solution: Force-directed graph O(n²) problem. Use Barnes-Hut approximation (octree) or grid-based spatial hashing for O(n) force calculation.', summary: 'Force graph O(n) spatial hashing optimization' },

  // --- Tutorials & Blog Posts ---
  { type: 'web_knowledge', content: 'Blog: Building a CLI agent loop — tool call → execute → result → repeat pattern. Max iterations guard prevents infinite loops.', summary: 'CLI agent loop architecture pattern' },
  { type: 'web_knowledge', content: 'Tutorial: Implementing spiral memory with decay. Nodes age through levels L1→L5 based on relevance score and access frequency.', summary: 'Spiral memory decay implementation' },
  { type: 'web_knowledge', content: 'Blog: WebSocket reconnection with exponential backoff. Base delay 1s, max 30s, jitter ±20%. Reset on successful message.', summary: 'WebSocket reconnection strategy' },
  { type: 'web_knowledge', content: 'Tutorial: Three.js ShaderMaterial custom vertex/fragment. Attributes via geometry.setAttribute(), uniforms via material.uniforms.', summary: 'Three.js custom ShaderMaterial tutorial' },
  { type: 'web_knowledge', content: 'Blog: MCP (Model Context Protocol) server architecture. STDIO transport, tool definitions with JSON schema, resource URIs.', summary: 'MCP server architecture overview' },
  { type: 'web_knowledge', content: 'Tutorial: Puppeteer-core vs puppeteer. Core requires manual Chrome path. chrome-finder library for cross-platform detection.', summary: 'Puppeteer-core setup with chrome-finder' },
  { type: 'web_knowledge', content: 'Blog: Embeddings for semantic search. all-MiniLM-L6-v2 produces 384d vectors. Cosine similarity for nearest-neighbor lookup.', summary: 'MiniLM embeddings for semantic search' },
  { type: 'web_knowledge', content: 'Tutorial: Building a REPL with readline. readline.createInterface for input, process.stdout for output. History with up/down arrows.', summary: 'Node.js REPL with readline tutorial' },
  { type: 'web_knowledge', content: 'Blog: Progressive Web App manifest.json. display: standalone, theme_color, icons array. Service worker for offline caching.', summary: 'PWA manifest and service worker setup' },
  { type: 'web_knowledge', content: 'Tutorial: Zod schema validation in TypeScript. z.object() for shapes, z.infer<> for types. Nested schemas with z.lazy() for recursion.', summary: 'Zod TypeScript validation patterns' },

  // --- Research & Best Practices ---
  { type: 'web_knowledge', content: 'Research: KNN search with sqlite-vec extension. vec_search() for approximate nearest neighbors. Quantized vectors (q8) for 4x storage reduction.', summary: 'sqlite-vec KNN search benchmarks' },
  { type: 'web_knowledge', content: 'Best practice: CLI permission models — safe (ask everything), auto (allow reads), yolo (allow all). Layered permission with escalation.', summary: 'CLI permission model best practices' },
  { type: 'web_knowledge', content: 'Research: Token counting for LLM context windows. Approximation: chars/4 for English, actual: tiktoken encoder. Budget allocation for system/user/assistant.', summary: 'LLM token counting and budgeting' },
  { type: 'web_knowledge', content: 'Best practice: Git checkpoint system. Snapshot working tree state at tool calls. Double-ESC for emergency revert. Diff-based restore.', summary: 'Git checkpoint system design' },
  { type: 'web_knowledge', content: 'Research: DuckDuckGo search API for programmatic web research. HTML scraping with content extraction. Rate limiting 1 req/sec.', summary: 'DuckDuckGo API for web research' },
  { type: 'web_knowledge', content: 'Best practice: Validation matrix for AI code output. Static checks (syntax, imports), dynamic checks (mini-LLM review), spiral checks (known patterns).', summary: 'AI code validation matrix design' },
  { type: 'web_knowledge', content: 'Research: Hugging Face transformers.js — browser/Node inference. Pipeline API for embeddings, classification, generation. ONNX runtime backend.', summary: 'Hugging Face transformers.js overview' },
  { type: 'web_knowledge', content: 'Best practice: Agent tool registry pattern. Each tool: name, description, input schema (Zod), execute function, permission level, undo support.', summary: 'Agent tool registry architecture' },
  { type: 'web_knowledge', content: 'Research: AGPL-3.0 license implications. Network use triggers copyleft. SaaS must provide source. Compatible with GPL-3.0.', summary: 'AGPL-3.0 license analysis' },
  { type: 'web_knowledge', content: 'Best practice: Structured logging with correlation IDs. JSON format for machine parsing. Log levels: debug/info/warn/error/fatal.', summary: 'Structured logging best practices' },

  // --- Technology Deep-Dives ---
  { type: 'web_knowledge', content: 'Deep dive: Ollama local LLM serving. ollama serve starts API on :11434. Model pulling, listing, running. Supports tool calling.', summary: 'Ollama local LLM server deep dive' },
  { type: 'web_knowledge', content: 'Deep dive: Next.js 15 App Router. Server Components by default. Client Components with "use client". Route groups, parallel routes, intercepting routes.', summary: 'Next.js 15 App Router architecture' },
  { type: 'web_knowledge', content: 'Deep dive: Prisma ORM with PostgreSQL. Schema-first design, migrations, type-safe queries. Prisma Client generation from schema.', summary: 'Prisma ORM PostgreSQL deep dive' },
  { type: 'web_knowledge', content: 'Deep dive: Stripe subscription lifecycle. Customer → Subscription → Invoice → Payment Intent. Webhook events for state changes.', summary: 'Stripe subscription lifecycle' },
  { type: 'web_knowledge', content: 'Deep dive: NextAuth v5 (Auth.js). Adapter pattern for database. JWT vs session strategy. Custom pages, callbacks, events.', summary: 'NextAuth v5 authentication deep dive' },
  { type: 'web_knowledge', content: 'Deep dive: Resend email API. React email templates with @react-email/components. Transactional email, batch sending, webhooks.', summary: 'Resend email API and React email' },
  { type: 'web_knowledge', content: 'Deep dive: Docker multi-stage builds for Node.js. Base → build → production stages. COPY --from for minimal runtime image.', summary: 'Docker multi-stage Node.js builds' },
  { type: 'web_knowledge', content: 'Deep dive: Tailwind CSS v4. New engine, @theme directive, CSS-first configuration. No more tailwind.config.js required.', summary: 'Tailwind CSS v4 migration guide' },
  { type: 'web_knowledge', content: 'Deep dive: React Three Fiber. Declarative Three.js in React. useFrame() for animation loop. useThree() for scene access.', summary: 'React Three Fiber overview' },
  { type: 'web_knowledge', content: 'Deep dive: WebSocket protocol. Upgrade handshake from HTTP. Binary frames for efficiency. Ping/pong for keepalive. Close codes.', summary: 'WebSocket protocol deep dive' },

  // --- Security & Performance ---
  { type: 'web_knowledge', content: 'Security: Content Security Policy headers. script-src, style-src, worker-src directives. blob: required for inline workers.', summary: 'CSP header configuration guide' },
  { type: 'web_knowledge', content: 'Performance: WebGL draw call batching. Merge geometries, use instancing for repeated objects. Minimize state changes between draws.', summary: 'WebGL draw call optimization' },
  { type: 'web_knowledge', content: 'Security: Path traversal prevention. Normalize paths, check prefix against allowed directories. Reject .. sequences and symlinks.', summary: 'Path traversal prevention techniques' },
  { type: 'web_knowledge', content: 'Performance: Node.js event loop optimization. Avoid blocking the main thread. Use worker_threads for CPU-intensive operations.', summary: 'Node.js event loop optimization' },
  { type: 'web_knowledge', content: 'Security: API key management in CLI tools. Environment variables, config files with restricted permissions. Never log or commit secrets.', summary: 'CLI API key management security' },
  { type: 'web_knowledge', content: 'Performance: SQLite performance tuning. PRAGMA cache_size, PRAGMA mmap_size. Batch inserts in transactions. Prepared statements.', summary: 'SQLite performance tuning guide' },
  { type: 'web_knowledge', content: 'Security: CORS configuration for WebSocket connections. Origin validation in upgrade handler. Token-based auth for WS endpoints.', summary: 'WebSocket CORS and auth patterns' },
  { type: 'web_knowledge', content: 'Performance: GPU particle systems. Point sprites vs instanced meshes. Vertex shader for size/position. Fragment shader for shape/glow.', summary: 'GPU particle system techniques' },

  // --- Ecosystem & Tooling ---
  { type: 'web_knowledge', content: 'npm: adm-zip for cross-platform ZIP handling. createArchive(), addFile(), writeZip(). Extract with extractAllTo(). In-memory buffer support.', summary: 'adm-zip ZIP archive library' },
  { type: 'web_knowledge', content: 'npm: fast-glob for file discovery. Pattern matching, ignore support, stats option. 3x faster than node-glob for large directories.', summary: 'fast-glob file discovery library' },
  { type: 'web_knowledge', content: 'npm: nanospinner for CLI progress indicators. createSpinner(), .start(), .success(), .error(). Minimal dependency footprint.', summary: 'nanospinner CLI spinner library' },
  { type: 'web_knowledge', content: 'npm: marked + marked-terminal for Markdown rendering in terminal. GFM support, syntax highlighting with cli-highlight.', summary: 'Terminal Markdown rendering stack' },
  { type: 'web_knowledge', content: 'npm: figlet + gradient-string for ASCII art headers. figlet.textSync() for banner text, gradient() for color gradients.', summary: 'figlet + gradient-string ASCII art' },
  { type: 'web_knowledge', content: 'npm: openai v5 SDK. Chat completions with streaming. Tool use with function calling. Compatible with Ollama and other OpenAI-compatible APIs.', summary: 'OpenAI v5 SDK compatibility' },
  { type: 'web_knowledge', content: 'npm: ws WebSocket library. Server and client implementations. Binary data support. Per-message deflate compression. Autoping/pong.', summary: 'ws WebSocket library reference' },
  { type: 'web_knowledge', content: 'npm: ignore library for .gitignore parsing. Accepts patterns, tests file paths. Used for respecting project ignore rules in file scanning.', summary: 'ignore library for gitignore parsing' },
  { type: 'web_knowledge', content: 'Chrome DevTools: Performance tab for WebGL profiling. GPU timing, frame breakdown, shader compilation. Identify bottlenecks in render pipeline.', summary: 'Chrome DevTools WebGL profiling' },
  { type: 'web_knowledge', content: 'npm: tsx — TypeScript execute. Runs .ts files directly without compilation. ESM support, watch mode. Replacement for ts-node.', summary: 'tsx TypeScript execution tool' },
];

const insertNode = db.prepare('INSERT INTO nodes (id, type, content, summary, level, relevance_score, token_count, metadata, created_at, updated_at, accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insertEdge = db.prepare('INSERT OR IGNORE INTO edges (id, source_id, target_id, relation_type, weight, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

const newL6Ids = [];
const relTypes = ['references', 'supports', 'related_to', 'uses', 'inspired_by'];

const existingL1 = db.prepare('SELECT id FROM nodes WHERE level=1 ORDER BY RANDOM() LIMIT 40').all().map(r => r.id);
const existingL2 = db.prepare('SELECT id FROM nodes WHERE level=2 ORDER BY RANDOM() LIMIT 30').all().map(r => r.id);
const existingL3 = db.prepare('SELECT id FROM nodes WHERE level=3 ORDER BY RANDOM() LIMIT 20').all().map(r => r.id);
const existingL4 = db.prepare('SELECT id FROM nodes WHERE level=4 ORDER BY RANDOM() LIMIT 15').all().map(r => r.id);
const existingL5 = db.prepare('SELECT id FROM nodes WHERE level=5 ORDER BY RANDOM() LIMIT 10').all().map(r => r.id);

const insert = db.transaction(() => {
  for (const n of l6Nodes) {
    const id = randomUUID();
    newL6Ids.push(id);
    // L6 web knowledge: low relevance (0.05-0.25), old creation dates, various access times
    insertNode.run(id, n.type, n.content, n.summary, 6,
      0.05 + Math.random() * 0.2,
      n.content.length,
      JSON.stringify({ source: 'web', url: 'https://example.com/' + n.summary.toLowerCase().replace(/\s+/g, '-') }),
      now - 86400000 * (5 + Math.random() * 90),   // created 5-95 days ago
      now - 86400000 * Math.random() * 10,           // updated 0-10 days ago
      now - 86400000 * (1 + Math.random() * 30)      // accessed 1-31 days ago
    );
  }

  // L6↔L6 edges: form small clusters (satellite networks)
  // Group by topic — every ~7 nodes form a cluster
  const clusterSize = 7;
  for (let c = 0; c < newL6Ids.length; c += clusterSize) {
    const cluster = newL6Ids.slice(c, c + clusterSize);
    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        if (Math.random() < 0.6) {  // dense intra-cluster connections
          insertEdge.run(randomUUID(), cluster[i], cluster[j], 'related_to', 0.3 + Math.random() * 0.4, '{}', now);
        }
      }
    }
  }

  // Sparse inter-cluster edges (bridges between satellite clusters)
  for (let i = 0; i < newL6Ids.length; i++) {
    if (Math.random() < 0.15) {
      const j = Math.floor(Math.random() * newL6Ids.length);
      if (Math.abs(i - j) > clusterSize) {
        insertEdge.run(randomUUID(), newL6Ids[i], newL6Ids[j], 'references', 0.1 + Math.random() * 0.2, '{}', now);
      }
    }
  }

  // L6 → L1 (web knowledge supports active code): 1-2 connections each
  for (const l6id of newL6Ids) {
    const numL1 = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < numL1; k++) {
      const target = existingL1[Math.floor(Math.random() * existingL1.length)];
      if (target) insertEdge.run(randomUUID(), target, l6id, 'uses', 0.15 + Math.random() * 0.2, '{}', now);
    }
  }

  // L6 → L2 (web knowledge enriches active modules): 1 connection each
  for (const l6id of newL6Ids) {
    if (Math.random() < 0.7) {
      const target = existingL2[Math.floor(Math.random() * existingL2.length)];
      if (target) insertEdge.run(randomUUID(), l6id, target, 'supports', 0.1 + Math.random() * 0.2, '{}', now);
    }
  }

  // L6 → L3 (web knowledge as reference material): sparse
  for (const l6id of newL6Ids) {
    if (Math.random() < 0.4) {
      const target = existingL3[Math.floor(Math.random() * existingL3.length)];
      if (target) insertEdge.run(randomUUID(), l6id, target, 'references', 0.1 + Math.random() * 0.15, '{}', now);
    }
  }

  // L6 → L4/L5 (web knowledge informs archived decisions): very sparse
  for (const l6id of newL6Ids) {
    if (Math.random() < 0.2) {
      const pool = [...existingL4, ...existingL5];
      const target = pool[Math.floor(Math.random() * pool.length)];
      if (target) insertEdge.run(randomUUID(), l6id, target, 'inspired_by', 0.1 + Math.random() * 0.15, '{}', now);
    }
  }
});

insert();

const counts = db.prepare('SELECT level, count(*) as cnt FROM nodes GROUP BY level ORDER BY level').all();
console.log('Node counts per level:', JSON.stringify(counts));
const totalE = db.prepare('SELECT count(*) as c FROM edges').get();
console.log('Total edges:', totalE.c);
db.close();
console.log('Done: Added', l6Nodes.length, 'L6 Web Knowledge nodes');
