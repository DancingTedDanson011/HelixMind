import BetterSqlite3 from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { logger } from '../utils/logger.js';

// Tables first — indexes created AFTER migration (content_hash may not exist yet)
const SCHEMA_TABLES = `
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT,
  summary TEXT,
  level INTEGER NOT NULL DEFAULT 1 CHECK(level IN (1, 2, 3, 4, 5)),
  relevance_score REAL NOT NULL DEFAULT 1.0,
  token_count INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE(source_id, target_id, relation_type)
);

CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
`;

const SCHEMA_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_level ON nodes(level);
CREATE INDEX IF NOT EXISTS idx_nodes_relevance ON nodes(relevance_score);
CREATE INDEX IF NOT EXISTS idx_nodes_updated ON nodes(updated_at);
CREATE INDEX IF NOT EXISTS idx_nodes_accessed ON nodes(accessed_at);
CREATE INDEX IF NOT EXISTS idx_nodes_content_hash ON nodes(content_hash);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(relation_type);
`;

export class Database {
  readonly raw: BetterSqlite3.Database;
  readonly hasVecExtension: boolean;
  private closed = false;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    const dbPath = join(dataDir, 'spiral.db');

    this.raw = new BetterSqlite3(dbPath);

    // Performance pragmas
    this.raw.pragma('journal_mode = WAL');
    this.raw.pragma('foreign_keys = ON');
    this.raw.pragma('synchronous = NORMAL');

    // Try to load sqlite-vec extension
    this.hasVecExtension = this.tryLoadVecExtension();

    // Create tables (without indexes — old DBs may lack content_hash column)
    this.raw.exec(SCHEMA_TABLES);

    // Run migrations for existing databases (adds content_hash etc.)
    this.migrate();

    // Create indexes AFTER migration (content_hash column now exists)
    this.raw.exec(SCHEMA_INDEXES);

    logger.debug(`Database opened at ${dbPath} (vec: ${this.hasVecExtension})`);
  }

  private tryLoadVecExtension(): boolean {
    try {
      // Dynamic import to avoid crash if sqlite-vec is not installed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqliteVec = require('sqlite-vec');
      sqliteVec.load(this.raw);
      logger.info('sqlite-vec extension loaded');
      return true;
    } catch {
      logger.info('sqlite-vec not available, using JS fallback for vector search');
      return false;
    }
  }

  private migrate(): void {
    const versionRow = this.raw.prepare(
      "SELECT version FROM schema_version LIMIT 1"
    ).get() as { version: number } | undefined;

    const currentVersion = versionRow?.version ?? 0;

    if (currentVersion < 3) {
      const nodesSql = (this.raw.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='nodes'"
      ).get() as { sql: string } | undefined)?.sql ?? '';

      // Needs migration if: has old type CHECK, or has 3-level CHECK constraint
      const needsMigration = nodesSql.includes("CHECK(type IN") ||
        (nodesSql.includes("CHECK(level IN") && !nodesSql.includes('4, 5'));

      if (needsMigration) {
        this.raw.exec('PRAGMA foreign_keys = OFF');
        this.raw.exec('BEGIN TRANSACTION');

        try {
          this.raw.exec(`
            ALTER TABLE nodes RENAME TO nodes_old;
            CREATE TABLE nodes (
              id TEXT PRIMARY KEY, type TEXT NOT NULL, content TEXT NOT NULL,
              content_hash TEXT,
              summary TEXT, level INTEGER NOT NULL DEFAULT 1 CHECK(level IN (1, 2, 3, 4, 5)),
              relevance_score REAL NOT NULL DEFAULT 1.0,
              token_count INTEGER NOT NULL DEFAULT 0, metadata TEXT NOT NULL DEFAULT '{}',
              created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, accessed_at INTEGER NOT NULL
            );
            INSERT INTO nodes (id, type, content, summary, level, relevance_score, token_count, metadata, created_at, updated_at, accessed_at)
              SELECT id, type, content, summary, level, relevance_score, token_count, metadata, created_at, updated_at, accessed_at FROM nodes_old;
            DROP TABLE nodes_old;

            ALTER TABLE edges RENAME TO edges_old;
            CREATE TABLE edges (
              id TEXT PRIMARY KEY,
              source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
              target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
              relation_type TEXT NOT NULL, weight REAL NOT NULL DEFAULT 1.0,
              metadata TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL,
              UNIQUE(source_id, target_id, relation_type)
            );
            INSERT INTO edges SELECT * FROM edges_old;
            DROP TABLE edges_old;

            CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
            CREATE INDEX IF NOT EXISTS idx_nodes_level ON nodes(level);
            CREATE INDEX IF NOT EXISTS idx_nodes_relevance ON nodes(relevance_score);
            CREATE INDEX IF NOT EXISTS idx_nodes_updated ON nodes(updated_at);
            CREATE INDEX IF NOT EXISTS idx_nodes_accessed ON nodes(accessed_at);
            CREATE INDEX IF NOT EXISTS idx_nodes_content_hash ON nodes(content_hash);
            CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
            CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
            CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(relation_type);
          `);
          this.raw.exec('COMMIT');
        } catch (err) {
          this.raw.exec('ROLLBACK');
          logger.warn(`Migration failed: ${err}`);
        }
        this.raw.exec('PRAGMA foreign_keys = ON');
      }

      // Set version to 4 (includes content_hash)
      this.raw.exec('DELETE FROM schema_version');
      this.raw.prepare('INSERT INTO schema_version (version) VALUES (?)').run(4);
    }

    // Migration v3 → v4: add content_hash column for deduplication
    if (currentVersion === 3) {
      try {
        this.raw.exec('ALTER TABLE nodes ADD COLUMN content_hash TEXT');
        this.raw.exec('CREATE INDEX IF NOT EXISTS idx_nodes_content_hash ON nodes(content_hash)');
      } catch {
        // Column may already exist
      }
      this.raw.exec('DELETE FROM schema_version');
      this.raw.prepare('INSERT INTO schema_version (version) VALUES (?)').run(4);
    }
  }

  close(): void {
    if (!this.closed) {
      this.raw.close();
      this.closed = true;
    }
  }
}
