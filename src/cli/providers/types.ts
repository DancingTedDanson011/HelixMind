export interface StreamEvent {
  type: 'text' | 'done' | 'error';
  content: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Tool-use message types (Anthropic-style) */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

/** Reasoning content from models like DeepSeek-R1 (chain-of-thought) */
export interface ReasoningBlock {
  type: 'reasoning';
  text: string;
}

/** Image content for vision-capable models */
export interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
    data: string;
  };
}

export type ContentBlock = TextBlock | ToolUseBlock | ReasoningBlock | ImageBlock;

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ToolMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[] | ToolResultBlock[] | string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Token usage reported by the provider.
 * FIX: PROVIDERS-M1 — cache_creation_input_tokens / cache_read_input_tokens are
 * Anthropic-specific and optional for other providers.
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  /** Anthropic prompt caching: tokens written to the cache on this request */
  cache_creation_input_tokens?: number;
  /** Anthropic prompt caching: tokens read from the cache on this request */
  cache_read_input_tokens?: number;
}

export interface ToolResponse {
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage?: TokenUsage;
}

export interface LLMProvider {
  name: string;
  model: string;
  /** Context window size in tokens — used for auto-trimming */
  maxContextLength: number;
  /** FIX: PROVIDERS-C1 — stream() now accepts an AbortSignal for hard cancel. */
  stream(
    messages: ChatMessage[],
    systemPrompt: string,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent>;

  /** Chat with tool use support. Returns full response (non-streaming for tool calls). */
  chatWithTools(
    messages: ToolMessage[],
    systemPrompt: string,
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<ToolResponse>;

  countTokens?(text: string): Promise<number>;
}
