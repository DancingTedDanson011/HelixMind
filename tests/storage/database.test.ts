import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/storage/database.js';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('Database', () => {
  let db: Database;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `spiral-db-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (db) db.close();
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Windows: EBUSY on WAL files is expected, temp dir will be cleaned later
    }
  });

  it('should create database file on initialization', () => {
    db = new Database(testDir);
    expect(existsSync(join(testDir, 'spiral.db'))).toBe(true);
  });

  it('should create nodes table', () => {
    db = new Database(testDir);
    const tables = db.raw.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('should create edges table', () => {
    db = new Database(testDir);
    const tables = db.raw.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='edges'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('should use WAL journal mode', () => {
    db = new Database(testDir);
    const result = db.raw.pragma('journal_mode') as { journal_mode: string }[];
    expect(result[0].journal_mode).toBe('wal');
  });

  it('should enable foreign keys', () => {
    db = new Database(testDir);
    const result = db.raw.pragma('foreign_keys') as { foreign_keys: number }[];
    expect(result[0].foreign_keys).toBe(1);
  });

  it('should handle close gracefully', () => {
    db = new Database(testDir);
    db.close();
    // Second close should not throw
    db.close();
  });

  it('should report whether vec extension is available', () => {
    db = new Database(testDir);
    // This may be true or false depending on sqlite-vec install
    expect(typeof db.hasVecExtension).toBe('boolean');
  });
});
