/**
 * Context window trimmer — sliding window that drops old messages
 * when the conversation exceeds the token budget.
 *
 * Estimates ~4 characters per token for rough sizing.
 * Preserves user→assistant message pairs to avoid breaking conversation flow.
 */

import type { ToolMessage } from '../providers/types.js';
import { renderInfo } from '../ui/chat-view.js';

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

  // Actually mutate the history array
  history.splice(0, dropCount);

  // Ensure the first remaining message is a 'user' message to maintain
  // Anthropic API alternation requirement (user/assistant/user/assistant).
  // If the first remaining message is 'assistant', drop it too.
  while (history.length > 0 && history[0].role === 'assistant') {
    history.shift();
    dropCount++;
  }

  // Insert trimmed marker at the start (always a 'user' message)
  history.unshift({
    role: 'user',
    content: `[System: ${dropCount} earlier messages were trimmed to fit the context window. The session buffer contains a summary of the conversation so far.]`,
  });

  renderInfo(`  Context trimmed: ${dropCount} old messages removed to free space.`);
  return dropCount;
}
