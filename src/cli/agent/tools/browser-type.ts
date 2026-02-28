import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'browser_type',
    description: 'Type text into an input element on the page by CSS selector. The browser must be open.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the input element (e.g. "input[name=\'email\']", "#search-box")' },
        text: { type: 'string', description: 'The text to type into the element' },
      },
      required: ['selector', 'text'],
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
    const text = input.text as string;

    try {
      await ctx.browserController.type(selector, text);
      return `Typed "${text.length > 50 ? text.slice(0, 50) + '...' : text}" into ${selector}`;
    } catch (err) {
      return `Type failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
