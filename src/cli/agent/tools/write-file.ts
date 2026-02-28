import { writeFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { registerTool } from './registry.js';
import { validatePath, SecurityError } from '../sandbox.js';
import { UndoStack } from '../undo.js';

/** Maximum file size in bytes (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum content length in characters (5MB) */
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024;

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

    // Validate content length
    if (content.length > MAX_CONTENT_LENGTH) {
      throw new SecurityError(`Content too long: ${content.length} characters (max ${MAX_CONTENT_LENGTH})`);
    }

    // Validate file size before writing
    if (content.length > MAX_FILE_SIZE) {
      throw new SecurityError(`Content too large: ${content.length} characters (max ${MAX_FILE_SIZE})`);
    }

    // Check if file exists and validate it's not too large
    let existed = false;
    try {
      const stats = statSync(filePath);
      if (stats.size > MAX_FILE_SIZE) {
        throw new SecurityError(`File too large: ${stats.size} bytes (max ${MAX_FILE_SIZE})`);
      }
      existed = true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new SecurityError(`Cannot access file: ${err}`);
      }
    }

    // Capture original state for undo
    const original = existed ? UndoStack.captureState(filePath) : null;

    // Ensure directory exists and is writable
    const dir = dirname(filePath);
    try {
      const dirStats = statSync(dir);
      if (!dirStats.isDirectory()) {
        throw new SecurityError(`Parent path is not a directory: ${dir}`);
      }
      // Try to write a test file to verify write permissions
      const testPath = `${dir}/.helixmind-write-test-${Date.now()}`;
      try {
        writeFileSync(testPath, 'test', 'utf-8');
        writeFileSync(testPath, 'test', 'utf-8'); // Verify append works
        unlinkSync(testPath);
      } catch (writeErr) {
        throw new SecurityError(`Cannot write to directory: ${dir}`);
      }
    } catch (err) {
      throw new SecurityError(`Parent directory not accessible: ${dir}`);
    }

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
