import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [
      totalUsers,
      proUsers,
      teamUsers,
      openTickets,
      totalTickets,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { plan: 'PRO', status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { plan: 'TEAM', status: 'ACTIVE' } }),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.ticket.count(),
    ]);

    const mrr = proUsers * 19 + teamUsers * 39;

    // Recent signups (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSignups = await prisma.user.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    return NextResponse.json({
      totalUsers,
      proUsers,
      teamUsers,
      mrr,
      openTickets,
      totalTickets,
      recentSignups,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
