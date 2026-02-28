import type { ToolDefinition } from '../../providers/types.js';
import type { UndoStack } from '../undo.js';

export interface ToolContext {
  projectRoot: string;
  undoStack: UndoStack;
  spiralEngine?: any;
}

export interface ToolHandler {
  definition: ToolDefinition;
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

const tools = new Map<string, ToolHandler>();

export function registerTool(handler: ToolHandler): void {
  tools.set(handler.definition.name, handler);
}

export function getTool(name: string): ToolHandler | undefined {
  return tools.get(name);
}

export function getAllToolDefinitions(): ToolDefinition[] {
  return Array.from(tools.values()).map(t => t.definition);
}

export function getAllToolNames(): string[] {
  return Array.from(tools.keys());
}

/** Initialize all tools by importing their modules */
export async function initializeTools(): Promise<void> {
  await import('./read-file.js');
  await import('./write-file.js');
  await import('./edit-file.js');
  await import('./list-dir.js');
  await import('./search.js');
  await import('./find.js');
  await import('./run-command.js');
  await import('./git-status.js');
  await import('./git-diff.js');
  await import('./git-commit.js');
  await import('./git-log.js');
  await import('./spiral-query.js');
  await import('./spiral-store.js');
  await import('./web-research.js');
}
