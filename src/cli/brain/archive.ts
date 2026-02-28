import { createHash } from 'node:crypto';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import type { SpiralEngine } from '../../spiral/engine.js';
import { exportBrainData } from './exporter.js';

const ARCHIVE_VERSION = 1;
const SUPPORTED_VERSIONS = [1];

export interface ArchiveManifest {
  version: number;
  projectName: string;
  exportDate: string;
  nodeCount: number;
  edgeCount: number;
  checksum: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  cleared: number;
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  manifest?: ArchiveManifest;
}

/**
 * Export spiral data to a ZIP archive.
 */
export function exportToZip(
  engine: SpiralEngine,
  outputDir: string,
  projectName: string = 'HelixMind Project',
): string {
  const data = exportBrainData(engine, projectName);

  const nodesJson = JSON.stringify(data.nodes, null, 2);
  const edgesJson = JSON.stringify(data.edges, null, 2);

  // Compute checksum over data
  const checksum = computeChecksum(nodesJson, edgesJson);

  const manifest: ArchiveManifest = {
    version: ARCHIVE_VERSION,
    projectName,
    exportDate: new Date().toISOString(),
    nodeCount: data.nodes.length,
    edgeCount: data.edges.length,
    checksum,
  };

  const zip = new AdmZip();
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
  zip.addFile('nodes.json', Buffer.from(nodesJson));
  zip.addFile('edges.json', Buffer.from(edgesJson));

  const fileName = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.helixmind.zip`;
  const outputPath = join(outputDir, fileName);
  zip.writeZip(outputPath);

  return outputPath;
}

/**
 * Import spiral data from a ZIP archive.
 */
export function importFromZip(
  zipPath: string,
  engine: SpiralEngine,
  mode: 'merge' | 'replace',
): ImportResult {
  const validation = validateArchive(zipPath);
  if (!validation.valid) {
    return { imported: 0, skipped: 0, cleared: 0, errors: validation.errors };
  }

  const zip = new AdmZip(zipPath);
  const nodes = JSON.parse(zip.getEntry('nodes.json')!.getData().toString('utf-8'));
  const edges = JSON.parse(zip.getEntry('edges.json')!.getData().toString('utf-8'));

  let cleared = 0;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Get existing content hashes for dedup in merge mode
  const existingHashes = new Set<string>();
  if (mode === 'merge') {
    const existingData = exportBrainData(engine);
    for (const node of existingData.nodes) {
      existingHashes.add(contentHash(node.content));
    }
  }

  if (mode === 'replace') {
    // Clear all existing data
    const status = engine.status();
    cleared = status.total_nodes;
    engine.clearAll();
  }

  // Import nodes
  const idMap = new Map<string, string>(); // old id → new id
  for (const node of nodes) {
    try {
      const hash = contentHash(node.content);
      if (mode === 'merge' && existingHashes.has(hash)) {
        skipped++;
        continue;
      }

      const result = engine.importNode({
        type: node.type,
        content: node.content,
        level: node.level,
        relevanceScore: node.relevanceScore,
        metadata: {},
      });
      idMap.set(node.id, result.node_id);
      imported++;
    } catch (err) {
      errors.push(`Failed to import node ${node.id}: ${String(err)}`);
    }
  }

  // Import edges
  for (const edge of edges) {
    try {
      const newSource = idMap.get(edge.source);
      const newTarget = idMap.get(edge.target);
      if (newSource && newTarget) {
        engine.relate(newSource, newTarget, edge.type as any, edge.weight);
      }
    } catch {
      // Skip duplicate edges
    }
  }

  return { imported, skipped, cleared, errors };
}

/**
 * Validate a ZIP archive without importing.
 */
export function validateArchive(zipPath: string): ValidationResult {
  const errors: string[] = [];

  let zip: AdmZip;
  try {
    zip = new AdmZip(zipPath);
  } catch {
    return { valid: false, errors: ['Invalid ZIP file'] };
  }

  // Check manifest
  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) {
    return { valid: false, errors: ['Missing manifest.json'] };
  }

  let manifest: ArchiveManifest;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString('utf-8'));
  } catch {
    return { valid: false, errors: ['Invalid manifest.json format'] };
  }

  // Check version
  if (!SUPPORTED_VERSIONS.includes(manifest.version)) {
    errors.push(`Unsupported archive version: ${manifest.version}`);
  }

  // Check required files
  if (!zip.getEntry('nodes.json')) {
    errors.push('Missing nodes.json');
  }
  if (!zip.getEntry('edges.json')) {
    errors.push('Missing edges.json');
  }

  // Checksum validation
  if (manifest.checksum && zip.getEntry('nodes.json') && zip.getEntry('edges.json')) {
    const nodesData = zip.getEntry('nodes.json')!.getData().toString('utf-8');
    const edgesData = zip.getEntry('edges.json')!.getData().toString('utf-8');
    const computed = computeChecksum(nodesData, edgesData);

    if (computed !== manifest.checksum) {
      errors.push('Checksum mismatch: archive data may be corrupted or tampered');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    manifest: errors.length === 0 ? manifest : undefined,
  };
}

function computeChecksum(nodesJson: string, edgesJson: string): string {
  const hash = createHash('sha256');
  hash.update(nodesJson);
  hash.update(edgesJson);
  return hash.digest('hex');
}

function contentHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}
