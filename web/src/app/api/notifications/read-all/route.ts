import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

export async function PATCH(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/notifications/read-all', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
