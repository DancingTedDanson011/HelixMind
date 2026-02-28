import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { registerTool } from './registry.js';
import { validatePath } from '../sandbox.js';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', '.venv', 'target', 'coverage']);
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h',
  '.json', '.yaml', '.yml', '.toml', '.md', '.txt',
  '.html', '.css', '.scss', '.vue', '.svelte',
  '.sql', '.sh', '.bash', '.zsh', '.ps1',
  '.env.example', '.gitignore', '.dockerignore',
  '.xml', '.svg',
]);

registerTool({
  definition: {
    name: 'search_files',
    description: 'Search for a text pattern across files using regex. Like grep/ripgrep. Returns matching lines with file, line number, and context.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        path: { type: 'string', description: 'Directory to search in (default: project root)' },
        include: { type: 'string', description: 'File extension filter, e.g. "*.ts" or "*.py"' },
        max_results: { type: 'number', description: 'Maximum results to return (default: 20)' },
      },
      required: ['pattern'],
    },
  },

  async execute(input, ctx) {
    const searchDir = validatePath((input.path as string) || '.', ctx.projectRoot);
    const maxResults = (input.max_results as number) ?? 20;
    const includePattern = input.include as string | undefined;

    let regex: RegExp;
    try {
      regex = new RegExp(input.pattern as string, 'gi');
    } catch (e) {
      return `Error: Invalid regex pattern: ${e}`;
    }

    const includeExt = includePattern ? includePattern.replace('*', '') : null;
    const results: string[] = [];

    function searchDir2(dir: string): void {
      if (results.length >= maxResults) return;

      let items: string[];
      try {
        items = readdirSync(dir);
      } catch {
        return;
      }

      for (const item of items) {
        if (results.length >= maxResults) return;
        if (IGNORE_DIRS.has(item)) continue;

        const fullPath = join(dir, item);
        let stat;
        try {
          stat = statSync(fullPath);
        } catch {
          continue;
        }

        if (stat.isDirectory()) {
          searchDir2(fullPath);
        } else if (stat.isFile()) {
          const ext = extname(item);
          if (includeExt && ext !== includeExt) continue;
          if (!includeExt && !TEXT_EXTENSIONS.has(ext)) continue;
          if (stat.size > 512 * 1024) continue; // Skip large files

          try {
            const content = readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) break;
              regex.lastIndex = 0;
              if (regex.test(lines[i])) {
                const relPath = relative(ctx.projectRoot, fullPath);
                const lineNum = i + 1;
                results.push(`${relPath}:${lineNum}  │ ${lines[i].trim()}`);
              }
            }
          } catch {
            // Skip binary or unreadable files
          }
        }
      }
    }

    searchDir2(searchDir);

    if (results.length === 0) {
      return `No matches found for pattern: ${input.pattern}`;
    }

    return `Found ${results.length} match(es) for "${input.pattern}":\n\n${results.join('\n')}`;
  },
});
