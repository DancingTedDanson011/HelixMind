import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createChatSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  mode: z.enum(['normal', 'skip-permissions']).default('normal'),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const chats = await prisma.chat.findMany({
      where: { userId: session.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true, role: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(chats);
  } catch (error) {
    console.error('Chats fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createChatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const chat = await prisma.chat.create({
      data: {
        userId: session.user.id,
        title: parsed.data.title ?? 'New Chat',
        mode: parsed.data.mode,
      },
    });

    return NextResponse.json(chat, { status: 201 });
  } catch (error) {
    console.error('Chat creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
