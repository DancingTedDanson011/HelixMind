import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireRole('ADMIN', 'SUPPORT');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Get API calls this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const apiCallsThisMonth = await prisma.usageLog.count({
      where: { userId: id, createdAt: { gte: startOfMonth } },
    });

    // Get token usage (sum from metadata where action includes token info)
    const tokenLogs = await prisma.usageLog.findMany({
      where: {
        userId: id,
        createdAt: { gte: startOfMonth },
        metadata: { not: undefined },
      },
      select: { metadata: true },
      take: 1000,
    });

    let tokenUsage = 0;
    for (const log of tokenLogs) {
      const meta = log.metadata as Record<string, unknown> | null;
      if (meta && typeof meta === 'object' && 'tokens' in meta) {
        tokenUsage += Number(meta.tokens) || 0;
      }
    }

    // Get last active timestamp
    const lastLog = await prisma.usageLog.findFirst({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // Get recent actions (last 20)
    const recentActions = await prisma.usageLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, action: true, metadata: true, createdAt: true },
    });

    return NextResponse.json({
      apiCallsThisMonth,
      tokenUsage,
      lastActive: lastLog?.createdAt || null,
      recentActions,
    });
  } catch (error) {
    console.error('User activity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
