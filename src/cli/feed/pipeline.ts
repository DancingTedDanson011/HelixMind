import { scanDirectory, type ScannedFile } from './scanner.js';
import { readFiles, type ReadFile } from './reader.js';
import { parseFiles, type ParsedFile } from './parser.js';
import { analyzeCodebase, type AnalysisResult, type DetectedModule } from './analyzer.js';
import type { SpiralEngine } from '../../spiral/engine.js';
import type { ContextType, RelationType } from '../../types.js';

export interface FeedProgress {
  stage: 'scanning' | 'reading' | 'parsing' | 'analyzing' | 'spiraling' | 'enriching' | 'done';
  current: number;
  total: number;
  currentFile?: string;
  detail?: string;
}

export interface FeedResult {
  filesScanned: number;
  filesRead: number;
  nodesCreated: number;
  relationsCreated: number;
  modules: DetectedModule[];
  architecture: string;
  techStack: string[];
  summary: string;
  /** Web enrichment results (if enabled) */
  webEnrichment?: {
    topics: string[];
    nodesStored: number;
    duration_ms: number;
  };
}

export type ProgressCallback = (progress: FeedProgress) => void;

export async function runFeedPipeline(
  rootDir: string,
  engine: SpiralEngine,
  options: {
    targetPath?: string;
    deep?: boolean;
    onProgress?: ProgressCallback;
  } = {},
): Promise<FeedResult> {
  const { targetPath, deep = false, onProgress } = options;

  // Stage 1: SCAN
  onProgress?.({ stage: 'scanning', current: 0, total: 0 });
  const scanned = await scanDirectory(rootDir, targetPath);
  onProgress?.({ stage: 'scanning', current: scanned.length, total: scanned.length, detail: `${scanned.length} files found` });

  if (scanned.length === 0) {
    return {
      filesScanned: 0, filesRead: 0, nodesCreated: 0, relationsCreated: 0,
      modules: [], architecture: 'Unknown', techStack: [], summary: 'No files found',
    };
  }

  // Stage 2: READ
  onProgress?.({ stage: 'reading', current: 0, total: scanned.length });
  const readResult = readFiles(scanned, deep);
  onProgress?.({ stage: 'reading', current: readResult.length, total: scanned.length, detail: `${readResult.length}/${scanned.length} files read` });

  // Stage 3: PARSE
  onProgress?.({ stage: 'parsing', current: 0, total: readResult.length });
  const parsed = parseFiles(readResult);
  onProgress?.({ stage: 'parsing', current: parsed.length, total: readResult.length, detail: 'extracting patterns' });

  // Stage 4: ANALYZE
  onProgress?.({ stage: 'analyzing', current: 0, total: 1 });
  const analysis = analyzeCodebase(parsed);
  onProgress?.({ stage: 'analyzing', current: 1, total: 1, detail: 'building relations' });

  // Stage 5: SPIRAL — Store everything in the engine
  onProgress?.({ stage: 'spiraling', current: 0, total: parsed.length + analysis.modules.length + 1 });

  let nodesCreated = 0;
  let relationsCreated = 0;
  const fileNodeIds = new Map<string, string>(); // relativePath → nodeId

  // 5a: Store individual file nodes (Level 1 — Focus)
  for (let i = 0; i < parsed.length; i++) {
    const file = parsed[i];
    onProgress?.({
      stage: 'spiraling',
      current: i,
      total: parsed.length + analysis.modules.length + 1,
      currentFile: file.relativePath,
    });

    const content = buildFileNodeContent(file);
    try {
      const result = await engine.store(content, 'code', {
        file: file.relativePath,
        language: file.language,
        tags: ['feed', 'file'],
      });
      fileNodeIds.set(file.relativePath, result.node_id);
      nodesCreated++;
    } catch {
      // Skip on error
    }
  }

  // 5b: Create import/dependency edges between file nodes
  for (const [filePath, deps] of analysis.dependencyGraph) {
    const sourceId = fileNodeIds.get(filePath);
    if (!sourceId) continue;

    for (const depPath of deps) {
      const targetId = fileNodeIds.get(depPath);
      if (!targetId) continue;

      try {
        engine.relate(sourceId, targetId, 'imports');
        relationsCreated++;
      } catch {
        // Duplicate edge
      }
    }
  }

  // 5c: Store module nodes (Level 2 — Association)
  const moduleNodeIds = new Map<string, string>();
  for (let i = 0; i < analysis.modules.length; i++) {
    const mod = analysis.modules[i];
    onProgress?.({
      stage: 'spiraling',
      current: parsed.length + i,
      total: parsed.length + analysis.modules.length + 1,
      detail: `Module: ${mod.name}`,
    });

    const content = `Module: ${mod.name}\n${mod.description}`;
    try {
      const result = await engine.store(content, 'module', {
        tags: ['feed', 'module', mod.name],
      });
      moduleNodeIds.set(mod.name, result.node_id);
      nodesCreated++;

      // Link module to its files
      for (const filePath of mod.files) {
        const fileNodeId = fileNodeIds.get(filePath);
        if (fileNodeId) {
          try {
            engine.relate(result.node_id, fileNodeId, 'belongs_to');
            relationsCreated++;
          } catch { /* duplicate */ }
        }
      }
    } catch { /* skip */ }
  }

  // 5d: Store architecture overview (Level 3 — Periphery)
  const archContent = [
    `Architecture: ${analysis.architecture}`,
    `Tech Stack: ${analysis.techStack.join(', ')}`,
    `Modules: ${analysis.modules.map(m => m.name).join(', ')}`,
    `Files: ${parsed.length}`,
    `Entry Points: ${analysis.entryPoints.join(', ')}`,
  ].join('\n');

  try {
    await engine.store(archContent, 'architecture', {
      tags: ['feed', 'architecture', 'overview'],
    });
    nodesCreated++;
  } catch { /* skip */ }

  // Stage 6: WEB ENRICHMENT — Search the internet for best practices about detected tech
  let webEnrichment: FeedResult['webEnrichment'] = undefined;
  if (analysis.techStack.length > 0) {
    onProgress?.({
      stage: 'enriching',
      current: 0,
      total: analysis.techStack.length,
      detail: 'searching web for best practices...',
    });

    try {
      const { enrichFromWeb } = await import('../../spiral/cloud/web-enricher.js');
      const { pushWebKnowledge, isBrainServerRunning } = await import('../brain/generator.js');

      // Build search queries from detected tech stack + architecture
      const queries: string[] = [];

      // Primary: tech stack combinations (e.g. "React + TypeScript best practices")
      if (analysis.techStack.length >= 2) {
        queries.push(`${analysis.techStack.slice(0, 3).join(' ')} best practices`);
      }

      // Secondary: individual technologies with their detected patterns
      for (const tech of analysis.techStack.slice(0, 4)) {
        queries.push(`${tech} project structure best practices`);
      }

      // Architecture-specific queries
      if (analysis.architecture !== 'Standard') {
        queries.push(`${analysis.architecture} ${analysis.techStack[0] ?? ''} architecture patterns`);
      }

      let totalStored = 0;
      const enrichedTopics: string[] = [];

      for (let i = 0; i < Math.min(queries.length, 3); i++) {
        onProgress?.({
          stage: 'enriching',
          current: i,
          total: Math.min(queries.length, 3),
          detail: queries[i],
        });

        const result = await enrichFromWeb(
          // Wrap in a technical-sounding message so topic detector picks it up
          `I need to understand ${queries[i]} for this project`,
          engine,
          {
            maxTopics: 1,
            maxPagesPerTopic: 2,
            minQuality: 0.35,
            onKnowledgeFound: (topic, summary, source) => {
              if (isBrainServerRunning()) {
                pushWebKnowledge(topic, summary, source);
              }
            },
          },
        );

        totalStored += result.nodesStored;
        enrichedTopics.push(...result.topics);
      }

      if (totalStored > 0) {
        webEnrichment = {
          topics: [...new Set(enrichedTopics)],
          nodesStored: totalStored,
          duration_ms: 0, // Captured in result
        };
      }

      onProgress?.({
        stage: 'enriching',
        current: Math.min(queries.length, 3),
        total: Math.min(queries.length, 3),
        detail: totalStored > 0 ? `+${totalStored} web knowledge nodes` : 'no relevant web content found',
      });
    } catch {
      // Web enrichment is optional, never block the feed
    }
  }

  onProgress?.({
    stage: 'done',
    current: parsed.length + analysis.modules.length + 1,
    total: parsed.length + analysis.modules.length + 1,
  });

  return {
    filesScanned: scanned.length,
    filesRead: readResult.length,
    nodesCreated,
    relationsCreated,
    modules: analysis.modules,
    architecture: analysis.architecture,
    techStack: analysis.techStack,
    summary: analysis.summary,
    webEnrichment,
  };
}

function buildFileNodeContent(file: ParsedFile): string {
  const parts: string[] = [file.summary];

  if (file.exports.length > 0) {
    parts.push('');
    parts.push('Exports:');
    for (const exp of file.exports.slice(0, 15)) {
      parts.push(`  ${exp.kind} ${exp.name} (line ${exp.line})`);
    }
  }

  if (file.imports.length > 0) {
    const internalImports = file.imports.filter(i => i.isRelative);
    const externalImports = file.imports.filter(i => !i.isRelative);

    if (internalImports.length > 0) {
      parts.push('');
      parts.push('Internal imports:');
      for (const imp of internalImports.slice(0, 10)) {
        parts.push(`  ${imp.source} → ${imp.specifiers.join(', ')}`);
      }
    }

    if (externalImports.length > 0) {
      parts.push('');
      parts.push('External deps:');
      for (const imp of externalImports.slice(0, 10)) {
        parts.push(`  ${imp.source}`);
      }
    }
  }

  if (file.todos.length > 0) {
    parts.push('');
    parts.push('TODOs:');
    for (const todo of file.todos.slice(0, 5)) {
      parts.push(`  ${todo}`);
    }
  }

  return parts.join('\n');
}
