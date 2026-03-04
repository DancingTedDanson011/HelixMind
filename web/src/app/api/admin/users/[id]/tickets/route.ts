import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const rateLimited = checkRateLimit(req, 'api/admin/users/tickets', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await requireRole('ADMIN', 'SUPPORT');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const tickets = await prisma.ticket.findMany({
      where: { userId: id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('User tickets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
