import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import type { TicketStatus } from '@prisma/client';
import { z } from 'zod';
import { validateId } from '@/lib/validation';

export async function GET(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/admin/tickets', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await requireRole('ADMIN', 'SUPPORT');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 100);

    const validStatuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    const where = status && validStatuses.includes(status as TicketStatus) ? { status: status as TicketStatus } : {};

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
  const rateLimited = checkRateLimit(req, 'api/admin/tickets', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

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

      // Notify ticket owner (only for non-internal messages)
      if (!isInternal) {
        const ticketData = await prisma.ticket.findUnique({
          where: { id },
          select: { userId: true, number: true },
        });
        if (ticketData && ticketData.userId !== session.user.id) {
          createNotification({
            userId: ticketData.userId,
            type: 'TICKET_REPLY',
            title: `Ticket #${ticketData.number} Reply`,
            body: 'Support has responded to your ticket',
            link: `/support/tickets`,
          }).catch((err) => console.error('Ticket notification error:', err));
        }
      }
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
