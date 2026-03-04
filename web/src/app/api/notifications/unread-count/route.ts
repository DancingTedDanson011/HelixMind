import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/notifications/unread-count', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const count = await prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Unread count error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
