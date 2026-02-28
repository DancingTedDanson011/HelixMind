/**
 * Context window trimmer — sliding window that drops old messages
 * when the conversation exceeds the token budget.
 *
 * Estimates ~4 characters per token for rough sizing.
 * Preserves user→assistant message pairs to avoid breaking conversation flow.
 */

import type { ToolMessage } from '../providers/types.js';
import { renderInfo } from '../ui/chat-view.js';
import type { SessionBuffer } from './session-buffer.js';

const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count for a message array.
 */
export function estimateTokens(messages: ToolMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      chars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if ('text' in block) chars += (block as any).text?.length ?? 0;
        if ('content' in block) chars += String((block as any).content ?? '').length;
        if ('input' in block) chars += JSON.stringify((block as any).input ?? {}).length;
      }
    }
  }
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/**
 * Trim conversation history to fit within the token budget.
 *
 * Strategy:
 * - Keep the most recent messages that fit within 75% of budget
 * - Drop from the front (oldest messages)
 * - Always keep at least the last 4 messages (current turn)
 * - Insert a "[trimmed]" marker at the start
 *
 * Returns the number of messages dropped.
 */
export function trimConversation(
  history: ToolMessage[],
  maxTokens: number,
  sessionBuffer?: SessionBuffer,
): number {
  const currentTokens = estimateTokens(history);
  const trimTarget = Math.floor(maxTokens * 0.75); // trim to 75%

  if (currentTokens <= maxTokens) {
    return 0; // no trimming needed
  }

  // Minimum messages to keep (current user message + some context)
  const minKeep = Math.min(6, history.length);

  // Binary search for how many messages to drop from the front
  let dropCount = 0;
  let remaining = [...history];

  while (estimateTokens(remaining) > trimTarget && remaining.length > minKeep) {
    // Drop 2 messages at a time (user + assistant pair)
    const toDrop = Math.min(2, remaining.length - minKeep);
    remaining = remaining.slice(toDrop);
    dropCount += toDrop;
  }

  if (dropCount === 0) return 0;

  // Summarize dropped messages into session buffer before removing them
  if (sessionBuffer && dropCount > 0) {
    summarizeDropped(history.slice(0, dropCount), sessionBuffer);
  }

  // Actually mutate the history array
  history.splice(0, dropCount);

  // Ensure the first remaining message is a clean 'user' text message.
  // Drop leading messages that would break the API contract:
  // 1. assistant messages (breaks user/assistant alternation)
  // 2. user messages containing tool_result blocks (orphaned — their
  //    corresponding assistant tool_use message was already trimmed)
  while (history.length > 0) {
    const first = history[0];
    if (first.role === 'assistant') {
      // Drop leading assistant messages
      history.shift();
      dropCount++;
    } else if (first.role === 'user' && hasToolResultContent(first)) {
      // Drop orphaned tool_result messages whose tool_use was trimmed
      history.shift();
      dropCount++;
    } else {
      break;
    }
  }

  // Insert trimmed marker at the start (always a 'user' message)
  history.unshift({
    role: 'user',
    content: `[System: ${dropCount} earlier messages were trimmed to fit the context window. The session buffer contains a summary of the conversation so far.]`,
  });

  renderInfo(`  Context trimmed: ${dropCount} old messages removed to free space.`);
  return dropCount;
}

/**
 * Check if a message contains tool_result content blocks.
 * These are user-role messages that are paired with a preceding assistant
 * message containing tool_use blocks. If the assistant message was trimmed,
 * this tool_result becomes orphaned and must also be removed.
 */
function hasToolResultContent(msg: ToolMessage): boolean {
  if (!Array.isArray(msg.content)) return false;
  return msg.content.some(
    (block: any) => block.type === 'tool_result',
  );
}

/**
 * Extract key information from dropped messages into the session buffer.
 * Preserves goals, entities, and assistant decisions that would otherwise be lost.
 */
function summarizeDropped(dropped: ToolMessage[], sessionBuffer: SessionBuffer): void {
  for (const msg of dropped) {
    if (typeof msg.content !== 'string') continue;

    if (msg.role === 'user') {
      // Re-extract goals and entities from user messages being dropped
      sessionBuffer.extractGoals(msg.content);
      sessionBuffer.extractEntities(msg.content);
    } else if (msg.role === 'assistant') {
      // Save a condensed version of the assistant response as a decision
      const text = msg.content.trim();
      if (text.length > 30) {
        sessionBuffer.addDecision(text.slice(0, 300));
      }
    }
  }
}
