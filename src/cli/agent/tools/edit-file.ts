import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { registerTool } from './registry.js';
import { validatePath } from '../sandbox.js';
import { UndoStack } from '../undo.js';

registerTool({
  definition: {
    name: 'edit_file',
    description: 'Make targeted edits to a file. Replaces a specific string with a new string. The old_string must appear exactly once in the file for a precise match.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the file' },
        old_string: { type: 'string', description: 'The exact string to find and replace (must be unique in the file)' },
        new_string: { type: 'string', description: 'The replacement string (empty string to delete)' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },

  async execute(input, ctx) {
    const filePath = validatePath(input.path as string, ctx.projectRoot);
    const oldStr = input.old_string as string;
    const newStr = input.new_string as string;

    const original = readFileSync(filePath, 'utf-8');
    const occurrences = original.split(oldStr).length - 1;

    if (occurrences === 0) {
      return `Error: old_string not found in ${input.path}. The exact text does not exist in the file.`;
    }

    if (occurrences > 1) {
      return `Error: old_string found ${occurrences} times in ${input.path}. It must be unique. Provide more surrounding context to make it unique.`;
    }

    const updated = original.replace(oldStr, newStr);

    // Write the file
    writeFileSync(filePath, updated, 'utf-8');

    // Push to undo stack
    ctx.undoStack.push({
      id: randomUUID(),
      timestamp: Date.now(),
      tool: 'edit_file',
      path: filePath,
      originalContent: original,
      newContent: updated,
    });

    // Generate a simple diff description
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');

    return `File edited: ${input.path}\n  Replaced ${oldLines.length} line(s) with ${newLines.length} line(s).`;
  },
});
