import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { registerTool } from './registry.js';
import { validatePath } from '../sandbox.js';
import { UndoStack } from '../undo.js';

registerTool({
  definition: {
    name: 'write_file',
    description: 'Create a new file or completely overwrite an existing file with the given content.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path for the file' },
        content: { type: 'string', description: 'The full file content to write' },
      },
      required: ['path', 'content'],
    },
  },

  async execute(input, ctx) {
    const filePath = validatePath(input.path as string, ctx.projectRoot);
    const content = input.content as string;
    const existed = existsSync(filePath);

    // Capture original state for undo
    const original = UndoStack.captureState(filePath);

    // Ensure directory exists
    const dir = dirname(filePath);
    mkdirSync(dir, { recursive: true });

    // Write file
    writeFileSync(filePath, content, 'utf-8');

    // Push to undo stack
    ctx.undoStack.push({
      id: randomUUID(),
      timestamp: Date.now(),
      tool: 'write_file',
      path: filePath,
      originalContent: original,
      newContent: content,
    });

    const lines = content.split('\n').length;
    const sizeKB = Buffer.byteLength(content, 'utf-8') / 1024;

    if (existed) {
      return `File overwritten: ${input.path} (${lines} lines, ${sizeKB.toFixed(1)} KB)`;
    }
    return `File created: ${input.path} (${lines} lines, ${sizeKB.toFixed(1)} KB)`;
  },
});
