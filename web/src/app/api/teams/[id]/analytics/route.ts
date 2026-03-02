import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTeamRole } from '@/lib/team-auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const authResult = await requireTeamRole(id, 'OWNER', 'ADMIN');
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '30d';

    const now = new Date();
    let since: Date;
    switch (period) {
      case '24h':
        since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get all team member user IDs
    const members = await prisma.teamMember.findMany({
      where: { teamId: id },
      select: { userId: true, user: { select: { name: true, email: true } } },
    });
    const memberIds = members.map((m) => m.userId);

    // Aggregate usage logs for team members
    const logs = await prisma.usageLog.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: { gte: since },
      },
      select: { userId: true, action: true, metadata: true, createdAt: true },
    });

    // Per-member stats
    const memberStats = members.map((m) => {
      const userLogs = logs.filter((l) => l.userId === m.userId);
      const apiCalls = userLogs.filter((l) => l.action === 'api_call').length;
      const tokens = userLogs
        .filter((l) => l.action === 'token_usage')
        .reduce((sum, l) => sum + ((l.metadata as any)?.tokens || 0), 0);
      const jarvisTasks = userLogs.filter((l) => l.action === 'jarvis_task').length;
      return {
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        apiCalls,
        tokens,
        jarvisTasks,
      };
    });

    // Daily chart data
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.ceil((now.getTime() - since.getTime()) / dayMs);
    const dailyData = [];
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(since.getTime() + i * dayMs);
      const dayEnd = new Date(dayStart.getTime() + dayMs);
      const dayLogs = logs.filter((l) => l.createdAt >= dayStart && l.createdAt < dayEnd);
      dailyData.push({
        date: dayStart.toISOString().slice(0, 10),
        apiCalls: dayLogs.filter((l) => l.action === 'api_call').length,
        tokens: dayLogs
          .filter((l) => l.action === 'token_usage')
          .reduce((sum, l) => sum + ((l.metadata as any)?.tokens || 0), 0),
      });
    }

    // Totals
    const totalApiCalls = memberStats.reduce((s, m) => s + m.apiCalls, 0);
    const totalTokens = memberStats.reduce((s, m) => s + m.tokens, 0);
    const totalJarvisTasks = memberStats.reduce((s, m) => s + m.jarvisTasks, 0);

    // Count active brains for team
    const activeBrains = await prisma.brainInstance.count({
      where: { userId: { in: memberIds }, active: true },
    });

    return NextResponse.json({
      period,
      totals: { apiCalls: totalApiCalls, tokens: totalTokens, jarvisTasks: totalJarvisTasks, activeBrains },
      members: memberStats,
      daily: dailyData,
    });
  } catch (error) {
    console.error('Analytics GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
