import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/notifications/read', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!notification.readAt) {
      await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
