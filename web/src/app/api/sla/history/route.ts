import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/sla/history', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    // Last 12 months of SLA reports
    const reports = await prisma.slaReport.findMany({
      orderBy: { period: 'desc' },
      take: 12,
    });

    // Daily uptime data for last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const checks = await prisma.uptimeCheck.findMany({
      where: { checkedAt: { gte: ninetyDaysAgo } },
      orderBy: { checkedAt: 'asc' },
      select: {
        healthy: true,
        responseMs: true,
        checkedAt: true,
      },
    });

    // Aggregate by day
    const dailyMap = new Map<string, { total: number; failed: number; responseSum: number }>();

    for (const check of checks) {
      const day = check.checkedAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(day) || { total: 0, failed: 0, responseSum: 0 };
      entry.total++;
      if (!check.healthy) entry.failed++;
      entry.responseSum += check.responseMs;
      dailyMap.set(day, entry);
    }

    const daily = [...dailyMap.entries()]
      .map(([date, data]) => ({
        date,
        uptimePercent: Math.round(((data.total - data.failed) / data.total) * 10000) / 100,
        avgResponseMs: Math.round(data.responseSum / data.total),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      reports: reports.map(r => ({
        period: r.period,
        uptimePercent: Math.round(r.uptimePercent * 100) / 100,
        avgResponseMs: Math.round(r.avgResponseMs),
        p95ResponseMs: Math.round(r.p95ResponseMs),
        p99ResponseMs: Math.round(r.p99ResponseMs),
        totalChecks: r.totalChecks,
        failedChecks: r.failedChecks,
        incidentCount: r.incidentCount,
      })),
      daily,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch history', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
