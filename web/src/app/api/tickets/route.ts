import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import type { TicketStatus } from '@prisma/client';
import { z } from 'zod';

const createTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  content: z.string().min(10).max(5000),
  category: z.enum(['BUG', 'FEATURE', 'BILLING', 'ACCOUNT', 'GENERAL']).default('GENERAL'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

export async function GET(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/tickets', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPPORT';
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const validStatuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (status && !validStatuses.includes(status as TicketStatus)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        ...(isAdmin ? {} : { userId: session.user.id }),
        ...(status ? { status: status as TicketStatus } : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(tickets);
  } catch (error) {
    console.error('Tickets fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/tickets', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const ticket = await prisma.ticket.create({
      data: {
        userId: session.user.id,
        subject: parsed.data.subject,
        category: parsed.data.category,
        priority: parsed.data.priority,
        messages: {
          create: {
            userId: session.user.id,
            content: parsed.data.content,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('Ticket creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
