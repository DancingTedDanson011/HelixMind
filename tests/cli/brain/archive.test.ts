import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { SpiralEngine } from '../../../src/spiral/engine.js';
import {
  exportToZip,
  importFromZip,
  validateArchive,
  type ArchiveManifest,
} from '../../../src/cli/brain/archive.js';
import type { SpiralConfig } from '../../../src/types.js';
import AdmZip from 'adm-zip';

function testConfig(dataDir: string): SpiralConfig {
  return {
    dataDir,
    maxTokens: 4000,
    model: 'Xenova/all-MiniLM-L6-v2',
    logLevel: 'error',
    embeddingDimensions: 384,
    levelThresholds: { l1Min: 0.7, l2Min: 0.5, l3Min: 0.3, l4Min: 0.1 },
    decayRate: 0.05,
    decayIntervalHours: 1,
  };
}

describe('ZIP Export', () => {
  let engine: SpiralEngine;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `helixmind-zip-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    engine = new SpiralEngine(testConfig(testDir));
  });

  afterEach(() => {
    engine.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should create a valid ZIP file', async () => {
    await engine.store('Test function', 'code');
    const zipPath = exportToZip(engine, testDir, 'TestProject');

    expect(existsSync(zipPath)).toBe(true);
    expect(zipPath.endsWith('.helixmind.zip')).toBe(true);
  });

  it('should contain manifest.json', async () => {
    await engine.store('Test function', 'code');
    const zipPath = exportToZip(engine, testDir, 'TestProject');

    const zip = new AdmZip(zipPath);
    const manifestEntry = zip.getEntry('manifest.json');
    expect(manifestEntry).not.toBeNull();

    const manifest: ArchiveManifest = JSON.parse(manifestEntry!.getData().toString('utf-8'));
    expect(manifest.version).toBe(1);
    expect(manifest.projectName).toBe('TestProject');
    expect(manifest.exportDate).toBeTruthy();
    expect(manifest.nodeCount).toBe(1);
  });

  it('should contain nodes.json and edges.json', async () => {
    await engine.store('Test function A', 'code');
    await engine.store('Test function B', 'code');
    const zipPath = exportToZip(engine, testDir, 'TestProject');

    const zip = new AdmZip(zipPath);
    expect(zip.getEntry('nodes.json')).not.toBeNull();
    expect(zip.getEntry('edges.json')).not.toBeNull();

    const nodes = JSON.parse(zip.getEntry('nodes.json')!.getData().toString('utf-8'));
    expect(nodes.length).toBe(2);
  });

  it('should include checksum in manifest', async () => {
    await engine.store('Checksum test', 'code');
    const zipPath = exportToZip(engine, testDir, 'TestProject');

    const zip = new AdmZip(zipPath);
    const manifest: ArchiveManifest = JSON.parse(zip.getEntry('manifest.json')!.getData().toString('utf-8'));
    expect(manifest.checksum).toBeTruthy();
    expect(typeof manifest.checksum).toBe('string');
  });
});

describe('ZIP Import (merge)', () => {
  let sourceEngine: SpiralEngine;
  let targetEngine: SpiralEngine;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(() => {
    sourceDir = join(tmpdir(), `helixmind-zip-src-${randomUUID()}`);
    targetDir = join(tmpdir(), `helixmind-zip-tgt-${randomUUID()}`);
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });
    sourceEngine = new SpiralEngine(testConfig(sourceDir));
    targetEngine = new SpiralEngine(testConfig(targetDir));
  });

  afterEach(() => {
    sourceEngine.close();
    targetEngine.close();
    try { rmSync(sourceDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
    try { rmSync(targetDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should merge nodes from ZIP into existing spiral', async () => {
    // Setup source with 2 nodes
    await sourceEngine.store('Source code A', 'code');
    await sourceEngine.store('Source code B', 'code');
    const zipPath = exportToZip(sourceEngine, sourceDir, 'Source');

    // Setup target with 1 node
    await targetEngine.store('Target code C', 'code');
    const beforeStatus = targetEngine.status();
    expect(beforeStatus.total_nodes).toBe(1);

    // Import with merge mode
    const result = importFromZip(zipPath, targetEngine, 'merge');
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);

    const afterStatus = targetEngine.status();
    expect(afterStatus.total_nodes).toBe(3);
  });

  it('should skip duplicate nodes on merge', async () => {
    // Store the same content
    await sourceEngine.store('Shared code', 'code');
    const zipPath = exportToZip(sourceEngine, sourceDir, 'Source');

    // Import same content
    await targetEngine.store('Shared code', 'code');
    const result = importFromZip(zipPath, targetEngine, 'merge');
    expect(result.skipped).toBe(1);

    const afterStatus = targetEngine.status();
    expect(afterStatus.total_nodes).toBe(1);
  });
});

describe('ZIP Import (replace)', () => {
  let sourceEngine: SpiralEngine;
  let targetEngine: SpiralEngine;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(() => {
    sourceDir = join(tmpdir(), `helixmind-zip-rsrc-${randomUUID()}`);
    targetDir = join(tmpdir(), `helixmind-zip-rtgt-${randomUUID()}`);
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });
    sourceEngine = new SpiralEngine(testConfig(sourceDir));
    targetEngine = new SpiralEngine(testConfig(targetDir));
  });

  afterEach(() => {
    sourceEngine.close();
    targetEngine.close();
    try { rmSync(sourceDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
    try { rmSync(targetDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should replace all nodes with ZIP content', async () => {
    // Setup source with 2 nodes
    await sourceEngine.store('New code A', 'code');
    await sourceEngine.store('New code B', 'code');
    const zipPath = exportToZip(sourceEngine, sourceDir, 'Source');

    // Setup target with 3 nodes
    await targetEngine.store('Old code X', 'code');
    await targetEngine.store('Old code Y', 'code');
    await targetEngine.store('Old code Z', 'code');
    expect(targetEngine.status().total_nodes).toBe(3);

    // Import with replace mode
    const result = importFromZip(zipPath, targetEngine, 'replace');
    expect(result.imported).toBe(2);
    expect(result.cleared).toBe(3);

    const afterStatus = targetEngine.status();
    expect(afterStatus.total_nodes).toBe(2);
  });
});

describe('Checksum Validation', () => {
  let engine: SpiralEngine;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `helixmind-zip-chk-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    engine = new SpiralEngine(testConfig(testDir));
  });

  afterEach(() => {
    engine.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should validate a valid archive', async () => {
    await engine.store('Valid data', 'code');
    const zipPath = exportToZip(engine, testDir, 'Test');
    const result = validateArchive(zipPath);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject a tampered archive', async () => {
    await engine.store('Valid data', 'code');
    const zipPath = exportToZip(engine, testDir, 'Test');

    // Tamper: modify nodes.json
    const zip = new AdmZip(zipPath);
    zip.updateFile('nodes.json', Buffer.from('[{"tampered": true}]'));
    zip.writeZip(zipPath);

    const result = validateArchive(zipPath);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Manifest Version Check', () => {
  let engine: SpiralEngine;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `helixmind-zip-ver-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    engine = new SpiralEngine(testConfig(testDir));
  });

  afterEach(() => {
    engine.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should reject archives with unsupported version', async () => {
    await engine.store('Version test', 'code');
    const zipPath = exportToZip(engine, testDir, 'Test');

    // Tamper: change version to 999
    const zip = new AdmZip(zipPath);
    const manifest = JSON.parse(zip.getEntry('manifest.json')!.getData().toString('utf-8'));
    manifest.version = 999;
    zip.updateFile('manifest.json', Buffer.from(JSON.stringify(manifest)));
    zip.writeZip(zipPath);

    const result = validateArchive(zipPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('version'))).toBe(true);
  });

  it('should reject archives with missing manifest', () => {
    // Create a ZIP without manifest
    const zip = new AdmZip();
    zip.addFile('random.txt', Buffer.from('not a helixmind archive'));
    const zipPath = join(testDir, 'bad.helixmind.zip');
    zip.writeZip(zipPath);

    const result = validateArchive(zipPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('manifest'))).toBe(true);
  });
});
