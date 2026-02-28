import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'browser_navigate',
    description: 'Navigate the browser to a URL. The browser must be open (use browser_open first).',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to navigate to' },
      },
      required: ['url'],
    },
  },

  async execute(input, ctx) {
    if (!ctx.browserController) {
      return 'Browser not available. Use browser_open first.';
    }

    try {
      const result = await ctx.browserController.navigate(input.url as string);
      return `Navigated to: ${result.url}\nPage title: ${result.title}`;
    } catch (err) {
      return `Navigation failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
