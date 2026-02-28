import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { registerTool } from './registry.js';
import { validatePath } from '../sandbox.js';

registerTool({
  definition: {
    name: 'list_directory',
    description: 'List files and directories at the given path. Shows file sizes and types. Use for understanding project structure.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the directory (default: project root)' },
        recursive: { type: 'boolean', description: 'List recursively (default: false)' },
        max_depth: { type: 'number', description: 'Maximum recursion depth (default: 2)' },
      },
      required: [],
    },
  },

  async execute(input, ctx) {
    const dirPath = validatePath((input.path as string) || '.', ctx.projectRoot);
    const recursive = (input.recursive as boolean) ?? false;
    const maxDepth = (input.max_depth as number) ?? 2;

    // Check if the directory exists before listing
    try {
      const stat = statSync(dirPath);
      if (!stat.isDirectory()) {
        return `Error: "${input.path || '.'}" is not a directory (it's a file). Use read_file instead.`;
      }
    } catch {
      return `Error: Directory "${input.path || '.'}" does not exist in ${ctx.projectRoot}`;
    }

    const entries: string[] = [];
    const IGNORE = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', '.venv', 'target']);

    function listDir(dir: string, depth: number, prefix: string): void {
      if (depth > maxDepth) return;

      let items: string[];
      try {
        items = readdirSync(dir).sort();
      } catch {
        return;
      }

      for (const item of items) {
        if (IGNORE.has(item)) continue;
        const fullPath = join(dir, item);
        let stat;
        try {
          stat = statSync(fullPath);
        } catch {
          continue;
        }

        if (stat.isDirectory()) {
          entries.push(`${prefix}${item}/`);
          if (recursive && depth < maxDepth) {
            listDir(fullPath, depth + 1, prefix + '  ');
          }
        } else {
          const sizeKB = (stat.size / 1024).toFixed(1);
          entries.push(`${prefix}${item}  (${sizeKB} KB)`);
        }
      }
    }

    listDir(dirPath, 0, '');

    const relPath = relative(ctx.projectRoot, dirPath) || '.';
    return `Directory: ${relPath}/\n${entries.length} entries\n\n${entries.join('\n')}`;
  },
});
