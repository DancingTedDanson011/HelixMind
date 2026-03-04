import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/notifications', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const cursor = searchParams.get('cursor');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where = {
      userId: session.user.id,
      ...(unreadOnly && { readAt: null }),
    };

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = notifications.length > limit;
    if (hasMore) notifications.pop();

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
