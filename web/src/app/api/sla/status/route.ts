import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const checks = await prisma.uptimeCheck.findMany({
      where: { checkedAt: { gte: oneDayAgo } },
      orderBy: { checkedAt: 'desc' },
    });

    if (checks.length === 0) {
      return NextResponse.json({
        status: 'unknown',
        uptimePercent: null,
        avgResponseMs: null,
        lastChecked: null,
        endpoints: [],
      });
    }

    const totalChecks = checks.length;
    const failedChecks = checks.filter(c => !c.healthy).length;
    const uptimePercent = ((totalChecks - failedChecks) / totalChecks) * 100;
    const avgResponseMs =
      checks.reduce((sum, c) => sum + c.responseMs, 0) / totalChecks;

    // Group by endpoint, take the latest check per endpoint
    const endpointMap = new Map<string, typeof checks[0]>();
    for (const check of checks) {
      if (!endpointMap.has(check.endpoint)) {
        endpointMap.set(check.endpoint, check);
      }
    }

    const endpoints = [...endpointMap.entries()].map(([name, check]) => ({
      name,
      healthy: check.healthy,
      responseMs: check.responseMs,
      lastChecked: check.checkedAt.toISOString(),
    }));

    // Determine overall status
    const unhealthyEndpoints = endpoints.filter(e => !e.healthy).length;
    let status: 'operational' | 'degraded' | 'major_outage';
    if (unhealthyEndpoints === 0) {
      status = 'operational';
    } else if (unhealthyEndpoints < endpoints.length) {
      status = 'degraded';
    } else {
      status = 'major_outage';
    }

    return NextResponse.json({
      status,
      uptimePercent: Math.round(uptimePercent * 100) / 100,
      avgResponseMs: Math.round(avgResponseMs),
      lastChecked: checks[0].checkedAt.toISOString(),
      endpoints,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch status', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
