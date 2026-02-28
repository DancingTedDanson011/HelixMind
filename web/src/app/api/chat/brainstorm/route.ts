import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/crypto';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await req.json();
  const { chatId, content } = body as { chatId: string; content: string };

  if (!chatId || !content?.trim()) {
    return new Response('chatId and content required', { status: 400 });
  }

  // Verify chat ownership
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId: session.user.id },
  });
  if (!chat) {
    return new Response('Chat not found', { status: 404 });
  }

  // Get user's Anthropic API key
  const llmKey = await prisma.userLLMKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'anthropic' } },
  });
  if (!llmKey) {
    return new Response('No Anthropic API key configured', { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = decryptApiKey(llmKey.encKey);
  } catch {
    return new Response('Failed to decrypt API key', { status: 500 });
  }

  // Load chat history
  const messages = await prisma.chatMessage.findMany({
    where: { chatId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  });

  // Build Anthropic messages
  const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Add the new user message
  anthropicMessages.push({ role: 'user', content: content.trim() });

  // Create SSE stream
  const encoder = new TextEncoder();
  let fullText = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const client = new Anthropic({ apiKey });

        const messageStream = client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: 'You are HelixMind, an AI coding assistant. Help the user brainstorm, plan, and design their ideas. Be concise, technical, and helpful. Respond in the same language as the user.',
          messages: anthropicMessages,
        });

        messageStream.on('text', (text) => {
          fullText += text;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`)
          );
        });

        await messageStream.finalMessage();

        // Signal completion
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', fullText })}\n\n`)
        );

        // Save assistant message to DB
        await prisma.chatMessage.create({
          data: { chatId, role: 'assistant', content: fullText },
        });

        // Update chat timestamp
        await prisma.chat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        });

        controller.close();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errMsg })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
