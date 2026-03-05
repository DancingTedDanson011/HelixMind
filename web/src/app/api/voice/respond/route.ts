import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/crypto';
import { checkRateLimit, AI_RATE_LIMIT } from '@/lib/rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { toFile } from 'openai';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const limited = checkRateLimit(req, 'voice/respond', {
    ...AI_RATE_LIMIT,
    identifier: () => session.user!.id,
  });
  if (limited) return limited;

  let body: { audioBase64: string; format: string; chatId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { audioBase64, format, chatId } = body;
  if (!audioBase64 || !format) {
    return new Response('audioBase64 and format are required', { status: 400 });
  }

  // Step 1: Get user's OpenAI key for Whisper STT
  const openaiKeyRecord = await prisma.userLLMKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'openai' } },
  });
  if (!openaiKeyRecord) {
    return new Response('No OpenAI API key configured (required for voice transcription)', { status: 400 });
  }

  let openaiApiKey: string;
  try {
    openaiApiKey = decryptApiKey(openaiKeyRecord.encKey);
  } catch {
    return new Response('Failed to decrypt OpenAI API key', { status: 500 });
  }

  // Step 2: Transcribe audio with Whisper
  let transcript: string;
  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Decode base64 audio to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const mimeType = getMimeType(format);
    const fileName = `audio.${format}`;

    const audioFile = await toFile(audioBuffer, fileName, { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    transcript = transcription.text;
  } catch (error) {
    console.error('Whisper transcription error:', error);
    return new Response('Failed to transcribe audio', { status: 500 });
  }

  if (!transcript?.trim()) {
    return new Response('No speech detected in audio', { status: 400 });
  }

  // Step 3: Get user's Anthropic key for LLM response
  const anthropicKeyRecord = await prisma.userLLMKey.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: 'anthropic' } },
  });
  if (!anthropicKeyRecord) {
    return new Response('No Anthropic API key configured', { status: 400 });
  }

  let anthropicApiKey: string;
  try {
    anthropicApiKey = decryptApiKey(anthropicKeyRecord.encKey);
  } catch {
    return new Response('Failed to decrypt Anthropic API key', { status: 500 });
  }

  // Load chat history if chatId provided
  let chatMessages: Anthropic.MessageParam[] = [];
  if (chatId) {
    try {
      const chat = await prisma.chat.findFirst({
        where: { id: chatId, userId: session.user.id },
      });
      if (chat) {
        const messages = await prisma.chatMessage.findMany({
          where: { chatId },
          orderBy: { createdAt: 'asc' },
          select: { role: true, content: true },
        });
        chatMessages = messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      }
    } catch {
      // Non-fatal: proceed without history
    }
  }

  // Add current user voice message
  chatMessages.push({ role: 'user', content: transcript });

  // Step 4: Stream Anthropic response as SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Send transcript first
        sendEvent({ type: 'transcript', text: transcript });

        const client = new Anthropic({ apiKey: anthropicApiKey });

        let fullText = '';

        const messageStream = client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: 'You are HelixMind, an AI voice assistant. Respond naturally and concisely as this will be spoken aloud. Keep responses clear and conversational.',
          messages: chatMessages,
        });

        messageStream.on('text', (text) => {
          fullText += text;
          sendEvent({ type: 'text_chunk', text });
        });

        await messageStream.finalMessage();

        sendEvent({ type: 'complete', fullText });

        // Persist messages to chat if chatId provided
        if (chatId) {
          try {
            await prisma.chatMessage.createMany({
              data: [
                { chatId, role: 'user', content: transcript },
                { chatId, role: 'assistant', content: fullText },
              ],
            });
          } catch {
            // Non-fatal: response was already sent
          }
        }

        controller.close();
      } catch (error) {
        console.error('Voice respond stream error:', error);
        sendEvent({ type: 'error', message: 'Failed to generate response' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function getMimeType(format: string): string {
  const mimeMap: Record<string, string> = {
    webm: 'audio/webm',
    mp4: 'audio/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
  };
  return mimeMap[format.toLowerCase()] ?? 'audio/webm';
}
