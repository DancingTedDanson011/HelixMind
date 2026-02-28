import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'browser_close',
    description: 'Close the browser. Call this when you are done with browser interactions.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },

  async execute(_input, ctx) {
    if (!ctx.browserController) {
      return 'No browser to close.';
    }

    if (!ctx.browserController.isOpen()) {
      return 'Browser is already closed.';
    }

    try {
      await ctx.browserController.close();
      return 'Browser closed.';
    } catch (err) {
      return `Error closing browser: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
