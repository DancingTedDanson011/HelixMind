import { readFileSync } from 'node:fs';
import type { ScannedFile } from './scanner.js';

export interface ReadFile {
  path: string;
  relativePath: string;
  content: string;
  language: string;
  truncated: boolean;
}

const MAX_LINES = 200;
const MAX_FILE_SIZE = 50_000; // 50KB

const EXT_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java',
  '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.cs': 'csharp', '.rb': 'ruby', '.php': 'php', '.swift': 'swift',
  '.kt': 'kotlin', '.scala': 'scala', '.lua': 'lua', '.sh': 'bash',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.xml': 'xml', '.html': 'html', '.css': 'css', '.scss': 'scss',
  '.sql': 'sql', '.graphql': 'graphql', '.proto': 'protobuf',
  '.md': 'markdown', '.txt': 'text',
};

export function readFiles(
  files: ScannedFile[],
  deep: boolean = false,
): ReadFile[] {
  const results: ReadFile[] = [];

  for (const file of files) {
    try {
      const result = readSingleFile(file, deep);
      if (result) results.push(result);
    } catch {
      // Skip unreadable files
    }
  }

  return results;
}

function readSingleFile(file: ScannedFile, deep: boolean): ReadFile | null {
  // Skip very large files unless in deep mode
  if (!deep && file.size > MAX_FILE_SIZE) return null;

  let content: string;
  try {
    content = readFileSync(file.path, 'utf-8');
  } catch {
    return null;
  }

  // Empty files
  if (!content.trim()) return null;

  const language = EXT_TO_LANGUAGE[file.ext] ?? 'text';
  let truncated = false;

  // For large files: truncate to MAX_LINES
  if (!deep) {
    const lines = content.split('\n');
    if (lines.length > MAX_LINES) {
      content = lines.slice(0, MAX_LINES).join('\n') + '\n// ... truncated';
      truncated = true;
    }
  }

  return {
    path: file.path,
    relativePath: file.relativePath,
    content,
    language,
    truncated,
  };
}
