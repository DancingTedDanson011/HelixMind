import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current browser page. If a vision-capable model is active, the screenshot is analyzed by the LLM. Otherwise, the page text is extracted as fallback.',
    input_schema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'What to look for in the screenshot (e.g. "Is there an error message?"). Default: general description.',
        },
      },
    },
  },

  async execute(input, ctx) {
    if (!ctx.browserController) {
      return 'Browser not available. Use browser_open first.';
    }

    if (!ctx.browserController.isOpen()) {
      return 'Browser is not open. Use browser_open first.';
    }

    try {
      const screenshot = await ctx.browserController.screenshot();
      const prompt = (input.prompt as string) || 'Describe what you see on this webpage. Note any errors, key content, or interactive elements.';

      // If vision processor is available, analyze the screenshot
      if (ctx.visionProcessor) {
        // Get page text as fallback for non-vision models
        let fallbackText: string | undefined;
        try {
          fallbackText = await ctx.browserController.getPageText();
        } catch {
          // Page text extraction failed — vision-only
        }

        const analysis = await ctx.visionProcessor.analyzeScreenshot(screenshot, prompt, fallbackText);

        const url = ctx.browserController.getUrl() || 'unknown';
        const sizeKB = (screenshot.length / 1024).toFixed(1);
        return `Screenshot taken (${sizeKB} KB) — ${url}\n\n${analysis}`;
      }

      // No vision processor — extract page text instead
      const pageText = await ctx.browserController.getPageText();
      const url = ctx.browserController.getUrl() || 'unknown';
      return `Screenshot taken — ${url}\n[No vision model available. Page text:]\n\n${pageText}`;
    } catch (err) {
      return `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
