import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'browser_click',
    description: 'Click an element on the page by CSS selector. The browser must be open.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element to click (e.g. "button.submit", "#login-btn", "a[href=\'/about\']")' },
      },
      required: ['selector'],
    },
  },

  async execute(input, ctx) {
    if (!ctx.browserController) {
      return 'Browser not available. Use browser_open first.';
    }

    if (!ctx.browserController.isOpen()) {
      return 'Browser is not open. Use browser_open first.';
    }

    const selector = input.selector as string;

    try {
      await ctx.browserController.click(selector);
      // Brief wait for page to react
      await new Promise(resolve => setTimeout(resolve, 500));
      const url = ctx.browserController.getUrl() || 'unknown';
      const title = await ctx.browserController.getTitle();
      return `Clicked: ${selector}\nCurrent page: ${title} (${url})`;
    } catch (err) {
      return `Click failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
