import type { ToolDefinition } from '../../providers/types.js';
import type { UndoStack } from '../undo.js';
import type { BugJournal } from '../../bugs/journal.js';
import type { BrowserController } from '../../browser/controller.js';
import type { VisionProcessor } from '../../browser/vision.js';

export interface ToolContext {
  projectRoot: string;
  undoStack: UndoStack;
  spiralEngine?: any;
  bugJournal?: BugJournal;
  browserController?: BrowserController;
  visionProcessor?: VisionProcessor;
  onBrowserScreenshot?: (info: { url: string; title?: string; imageBase64?: string; analysis?: string }) => void;
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
  await import('./bug-report.js');
  await import('./bug-list.js');

  // Browser tools — conditional (puppeteer-core is optional)
  try {
    await import('./browser-open.js');
    await import('./browser-navigate.js');
    await import('./browser-screenshot.js');
    await import('./browser-click.js');
    await import('./browser-type.js');
    await import('./browser-close.js');
  } catch {
    // puppeteer-core not installed — browser tools not available
  }
}
