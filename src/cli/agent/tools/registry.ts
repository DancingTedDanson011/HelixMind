import type { ToolDefinition } from '../../providers/types.js';
import type { UndoStack } from '../undo.js';
import type { BugJournal } from '../../bugs/journal.js';
import type { BrowserController } from '../../browser/controller.js';
import type { VisionProcessor } from '../../browser/vision.js';
import type { LearningJournal } from '../../jarvis/learning.js';

export interface ToolContext {
  projectRoot: string;
  undoStack: UndoStack;
  spiralEngine?: any;
  bugJournal?: BugJournal;
  browserController?: BrowserController;
  visionProcessor?: VisionProcessor;
  onBrowserScreenshot?: (info: { url: string; title?: string; imageBase64?: string; analysis?: string }) => void;
  learningJournal?: LearningJournal;
  lockFile?: (path: string) => boolean;
  unlockFile?: (path: string) => void;
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

/** Initialize all tools by importing their modules (parallel for speed) */
export async function initializeTools(): Promise<void> {
  // Core tools — all independent, load in parallel (~150-300ms faster)
  await Promise.all([
    import('./read-file.js'),
    import('./write-file.js'),
    import('./edit-file.js'),
    import('./list-dir.js'),
    import('./search.js'),
    import('./find.js'),
    import('./run-command.js'),
    import('./git-status.js'),
    import('./git-diff.js'),
    import('./git-commit.js'),
    import('./git-log.js'),
    import('./spiral-query.js'),
    import('./spiral-store.js'),
    import('./web-research.js'),
    import('./bug-report.js'),
    import('./bug-list.js'),
  ]);

  // Browser tools — conditional (puppeteer-core is optional)
  try {
    await Promise.all([
      import('./browser-open.js'),
      import('./browser-navigate.js'),
      import('./browser-screenshot.js'),
      import('./browser-click.js'),
      import('./browser-type.js'),
      import('./browser-close.js'),
    ]);
  } catch {
    // puppeteer-core not installed — browser tools silently unavailable
    if (process.env.DEBUG) {
      console.error('[tools] Browser tools unavailable — install puppeteer-core for browser automation');
    }
  }
}
