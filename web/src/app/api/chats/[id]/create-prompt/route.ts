import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/crypto';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: chatId } = await params;

  // Verify ownership
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId: session.user.id },
  });
  if (!chat) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  }

  // Get user's Anthropic key
  const llmKey = await prisma.userLLMKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'anthropic' } },
  });
  if (!llmKey) {
    return NextResponse.json({ error: 'No Anthropic API key configured' }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = decryptApiKey(llmKey.encKey);
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt API key' }, { status: 500 });
  }

  // Load all messages
  const messages = await prisma.chatMessage.findMany({
    where: { chatId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  });

  if (messages.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 messages to create a prompt' }, { status: 400 });
  }

  // Build conversation summary for the meta-prompt
  const conversationText = messages
    .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n');

  try {
    const client = new Anthropic({ apiKey });

    const result = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are a prompt engineer. Your job is to take a brainstorming conversation and distill it into a clear, structured agent task prompt that a coding agent can execute.

The output should be a well-structured prompt that includes:
1. **Goal** — What needs to be built/changed
2. **Requirements** — Specific features and behaviors
3. **Technical Details** — Architecture decisions, tech stack, patterns
4. **Acceptance Criteria** — How to verify the work is done
5. **Notes** — Any constraints or special considerations

Write the prompt in the same language as the conversation. Be specific and actionable.`,
      messages: [
        {
          role: 'user',
          content: `Here is the brainstorming conversation:\n\n${conversationText}\n\nCreate a structured agent task prompt from this conversation.`,
        },
      ],
    });

    const agentPrompt = result.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('');

    // Save to chat
    await prisma.chat.update({
      where: { id: chatId },
      data: { agentPrompt, status: 'prompt_ready' },
    });

    return NextResponse.json({ agentPrompt });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
