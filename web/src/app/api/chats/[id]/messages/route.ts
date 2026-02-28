import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

    const chat = await prisma.chat.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!chat) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { chatId: id },
      orderBy: { createdAt: 'asc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return NextResponse.json({
      messages,
      nextCursor: messages.length === limit ? messages[messages.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Messages fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = createMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const chat = await prisma.chat.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!chat) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const message = await prisma.chatMessage.create({
      data: {
        chatId: id,
        role: parsed.data.role,
        content: parsed.data.content,
        metadata: parsed.data.metadata as any ?? undefined,
      },
    });

    // Touch chat updatedAt
    await prisma.chat.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Message creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
