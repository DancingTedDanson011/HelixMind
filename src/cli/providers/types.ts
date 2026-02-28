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

export type ContentBlock = TextBlock | ToolUseBlock | ReasoningBlock;

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

export interface ToolResponse {
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface LLMProvider {
  name: string;
  model: string;
  stream(
    messages: ChatMessage[],
    systemPrompt: string,
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
