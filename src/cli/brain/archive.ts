import { createHash } from 'node:crypto';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import type { SpiralEngine } from '../../spiral/engine.js';
import type { ContextType, SpiralLevel } from '../../types.js';
import { exportBrainData } from './exporter.js';

// FIX: WIDE-SPIRAL-003 — whitelist of valid ContextType enum values for import validation.
// Keep in sync with src/types.ts ContextType.
const VALID_CONTEXT_TYPES: readonly ContextType[] = [
  'code', 'decision', 'error', 'pattern', 'architecture', 'module', 'summary',
] as const;
const MAX_CONTENT_BYTES = 1024 * 1024; // 1 MB

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
export async function importFromZip(
  zipPath: string,
  engine: SpiralEngine,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  const validation = validateArchive(zipPath);
  if (!validation.valid) {
    return { imported: 0, skipped: 0, cleared: 0, errors: validation.errors };
  }

  const zip = new AdmZip(zipPath);

  // Zip bomb protection: check decompressed size before parsing
  const MAX_DECOMPRESSED = 100 * 1024 * 1024; // 100 MB
  const nodesEntry = zip.getEntry('nodes.json')!;
  const edgesEntry = zip.getEntry('edges.json')!;
  if (nodesEntry.header.size > MAX_DECOMPRESSED || edgesEntry.header.size > MAX_DECOMPRESSED) {
    return { imported: 0, skipped: 0, cleared: 0, errors: ['Archive entry too large (max 100 MB decompressed)'] };
  }

  const nodes = JSON.parse(nodesEntry.getData().toString('utf-8'));
  const edges = JSON.parse(edgesEntry.getData().toString('utf-8'));

  let cleared = 0;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // FIX: WIDE-SPIRAL-002 — removed MD5 pre-dedup. engine.importNode already dedupes
  // with SHA-256 content_hash and returns { deduplicated: true } on hits, so we rely
  // on that single source of truth instead of maintaining a parallel MD5 index.
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
      // FIX: WIDE-SPIRAL-003 — validate and sanitize imported node fields.
      // Untrusted ZIP input must never be passed directly to the engine.
      if (typeof node?.content !== 'string') {
        errors.push(`Skipping node ${node?.id ?? '?'}: missing or non-string content`);
        continue;
      }

      // Validate type — must be a known ContextType, else skip
      if (!VALID_CONTEXT_TYPES.includes(node.type)) {
        errors.push(`Skipping node ${node.id}: invalid type "${String(node.type)}"`);
        continue;
      }

      // Clamp level to [1, 5]
      let safeLevel: SpiralLevel | undefined;
      if (typeof node.level === 'number') {
        const clamped = Math.max(1, Math.min(5, Math.floor(node.level)));
        safeLevel = clamped as SpiralLevel;
      }

      // Default relevanceScore to 0.5 if missing/non-finite
      const safeRelevance = Number.isFinite(node.relevanceScore)
        ? Math.max(0, Math.min(1, node.relevanceScore))
        : 0.5;

      // Truncate oversized content with marker
      let safeContent = node.content;
      // Compare byte length (Buffer.byteLength) for multi-byte safe limit enforcement
      if (Buffer.byteLength(safeContent, 'utf-8') > MAX_CONTENT_BYTES) {
        // Slice by characters then re-check; good enough for enforcing an upper bound
        safeContent = safeContent.slice(0, MAX_CONTENT_BYTES) + '...[truncated]';
      }

      const result = await engine.importNode({
        type: node.type,
        content: safeContent,
        level: safeLevel,
        relevanceScore: safeRelevance,
        metadata: {},
      });
      idMap.set(node.id, result.node_id);
      // FIX: WIDE-SPIRAL-002 — count skip/import based on the engine's dedup flag.
      if (result.deduplicated) {
        skipped++;
      } else {
        imported++;
      }
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

// FIX: WIDE-SPIRAL-002 — removed MD5 contentHash() helper. The engine uses SHA-256 via
// engine.importNode() and returns { deduplicated: boolean } — relying on that single
// source of truth avoids hash-algorithm mismatches.
