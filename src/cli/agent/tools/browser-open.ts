import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'browser_open',
    description: 'Open a Chrome browser. Optionally navigate to a URL immediately. The browser stays open for subsequent browser_* tool calls.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Optional URL to navigate to after opening' },
        headless: { type: 'boolean', description: 'Run headless (no visible window). Default: false' },
      },
    },
  },

  async execute(input, ctx) {
    if (!ctx.browserController) {
      return 'Browser not available. puppeteer-core may not be installed. Run: npm install puppeteer-core';
    }

    const headless = input.headless === true;

    try {
      await ctx.browserController.launch(undefined, headless);
    } catch (err) {
      return `Failed to open browser: ${err instanceof Error ? err.message : String(err)}`;
    }

    const url = input.url as string | undefined;
    if (url) {
      try {
        const result = await ctx.browserController.navigate(url);
        return `Browser opened and navigated to: ${result.url}\nPage title: ${result.title}`;
      } catch (err) {
        return `Browser opened but navigation failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    return 'Browser opened successfully.';
  },
});
