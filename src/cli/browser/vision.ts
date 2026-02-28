/**
 * Vision processing — analyze screenshots with vision-capable LLMs.
 *
 * Supports Anthropic (claude-3+), OpenAI (gpt-4o/turbo), and Ollama (llava, llama3.2-vision).
 * Falls back to page text extraction for non-vision models.
 */

import type { LLMProvider, ToolMessage, ToolDefinition, ContentBlock } from '../providers/types.js';

/** Image content block for vision-capable models */
export interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
    data: string;
  };
}

/** Vision-enhanced content block (extends base types) */
export type VisionContentBlock = ContentBlock | ImageBlock;

/** Check if a model supports vision based on provider + model name */
export function supportsVision(providerName: string, modelName: string): boolean {
  const model = modelName.toLowerCase();

  switch (providerName.toLowerCase()) {
    case 'anthropic': {
      // All Claude 3+ models support vision
      if (model.includes('claude-3') || model.includes('claude-sonnet-4') || model.includes('claude-opus-4')) return true;
      // claude-4 and beyond
      if (model.match(/claude-(\d+)/) && parseInt(model.match(/claude-(\d+)/)?.[1] ?? '0') >= 3) return true;
      return false;
    }
    case 'openai': {
      // GPT-4o variants, GPT-4 Turbo, o1, o3, o4 all support vision
      if (model.includes('gpt-4o')) return true;
      if (model.includes('gpt-4-turbo')) return true;
      if (model.match(/\bo[134]\b/)) return true;
      if (model.includes('gpt-4-vision')) return true;
      // GPT-3.5 and plain GPT-4 do not
      return false;
    }
    case 'ollama': {
      // Known vision-capable Ollama models
      const visionModels = [
        'llava', 'llava-llama3', 'llava-phi3',
        'bakllava',
        'llama3.2-vision',
        'moondream', 'moondream2',
        'minicpm-v',
        'cogvlm',
      ];
      return visionModels.some(vm => model.includes(vm));
    }
    default:
      return false;
  }
}

export class VisionProcessor {
  constructor(
    private provider: LLMProvider,
  ) {}

  /** Check if the current provider/model supports vision */
  canProcessImages(): boolean {
    return supportsVision(this.provider.name, this.provider.model);
  }

  /**
   * Analyze a screenshot with the LLM.
   * If the model doesn't support vision, returns a fallback message.
   *
   * @param screenshot — PNG buffer
   * @param prompt — what to look for in the screenshot
   * @param fallbackText — page text to use if model doesn't support vision
   */
  async analyzeScreenshot(
    screenshot: Buffer,
    prompt: string = 'Describe what you see on this webpage.',
    fallbackText?: string,
  ): Promise<string> {
    if (!this.canProcessImages()) {
      if (fallbackText) {
        return `[Vision not available for ${this.provider.model}. Page text extracted instead:]\n\n${fallbackText}`;
      }
      return `[Vision not available for ${this.provider.model}. Use a vision-capable model (Claude 3+, GPT-4o, llava) for screenshot analysis.]`;
    }

    // Build vision message
    const base64 = screenshot.toString('base64');
    const visionMessage = this.buildVisionMessage(base64, prompt);

    // Send to LLM
    const response = await this.provider.chatWithTools(
      visionMessage,
      'You are analyzing a screenshot from a web browser. Describe what you see concisely and accurately.',
      [], // no tools needed
    );

    // Extract text response
    const textBlocks = response.content.filter(
      (b): b is { type: 'text'; text: string } => b.type === 'text'
    );
    return textBlocks.map(b => b.text).join('\n') || '[No description generated]';
  }

  /** Build provider-specific vision message */
  private buildVisionMessage(base64: string, prompt: string): ToolMessage[] {
    const providerName = this.provider.name.toLowerCase();

    if (providerName === 'anthropic') {
      return [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64,
            },
          } as any,
          { type: 'text', text: prompt },
        ],
      }];
    }

    if (providerName === 'openai' || providerName === 'ollama') {
      // OpenAI and Ollama (via OpenAI-compat API) use image_url format
      return [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64}`,
            },
          } as any,
          { type: 'text', text: prompt },
        ],
      }];
    }

    // Unknown provider — try text-only
    return [{
      role: 'user',
      content: prompt,
    }];
  }
}
