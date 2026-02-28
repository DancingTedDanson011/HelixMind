import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export async function GET(req: Request) {
  try {
    const session = await requireRole('ADMIN', 'SUPPORT');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const where = status ? { status: status as any } : {};

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          _count: { select: { messages: true } },
        },
        orderBy: [
          { status: 'asc' },    // OPEN first
          { priority: 'desc' }, // CRITICAL first
          { updatedAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return NextResponse.json({ tickets, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Admin tickets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateTicketSchema = z.object({
  id: z.string(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  message: z.string().min(1).optional(),
  isInternal: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireRole('ADMIN', 'SUPPORT');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { id, status, priority, message, isInternal } = parsed.data;

    // Update ticket status/priority
    if (status || priority) {
      await prisma.ticket.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(priority && { priority }),
          ...(status === 'RESOLVED' && { resolvedAt: new Date() }),
          ...(status === 'CLOSED' && { closedAt: new Date() }),
        },
      });
    }

    // Add message if provided
    if (message) {
      await prisma.ticketMessage.create({
        data: {
          ticketId: id,
          userId: session.user.id,
          content: message,
          isInternal: isInternal ?? false,
        },
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        messages: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json(ticket);
  } catch (error) {
    console.error('Ticket update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
