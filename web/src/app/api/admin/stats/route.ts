import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Fallback prices if PlanConfig is not seeded
const DEFAULT_PRICES = {
  PRO:  { monthly: 19, yearly: 190 },
  TEAM: { monthly: 39, yearly: 390 },
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      recentSignups,
      openTickets,
      totalTickets,
      subscriptionBreakdown,
      planConfigs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.ticket.count(),
      // Group active/trialing/past_due subscriptions by plan + billing period
      prisma.subscription.groupBy({
        by: ['plan', 'status', 'billingPeriod'],
        _count: true,
        where: { plan: { in: ['PRO', 'TEAM'] } },
      }),
      // Try to load prices from PlanConfig
      prisma.planConfig.findMany({
        where: { plan: { in: ['PRO', 'TEAM'] } },
        select: { plan: true, monthlyPrice: true, yearlyPrice: true },
      }),
    ]);

    // Build price lookup from PlanConfig, fall back to defaults
    const prices: Record<string, { monthly: number; yearly: number }> = {};
    for (const plan of ['PRO', 'TEAM'] as const) {
      const config = planConfigs.find((c) => c.plan === plan);
      prices[plan] = {
        monthly: config?.monthlyPrice ?? DEFAULT_PRICES[plan].monthly,
        yearly: config?.yearlyPrice ?? DEFAULT_PRICES[plan].yearly,
      };
    }

    // Parse subscription breakdown
    let proMonthly = 0, proYearly = 0;
    let teamMonthly = 0, teamYearly = 0;
    let pastDue = 0, trialing = 0, canceled = 0;

    for (const row of subscriptionBreakdown) {
      const count = row._count;

      if (row.status === 'PAST_DUE') { pastDue += count; continue; }
      if (row.status === 'TRIALING') { trialing += count; continue; }
      if (row.status === 'CANCELED') { canceled += count; continue; }
      if (row.status !== 'ACTIVE') continue;

      if (row.plan === 'PRO') {
        if (row.billingPeriod === 'YEARLY') proYearly += count;
        else proMonthly += count;
      } else if (row.plan === 'TEAM') {
        if (row.billingPeriod === 'YEARLY') teamYearly += count;
        else teamMonthly += count;
      }
    }

    const proUsers = proMonthly + proYearly;
    const teamUsers = teamMonthly + teamYearly;

    // Accurate MRR: monthly subs pay monthly price, yearly subs pay yearly/12
    const mrr = Math.round(
      proMonthly * prices.PRO.monthly +
      proYearly * (prices.PRO.yearly / 12) +
      teamMonthly * prices.TEAM.monthly +
      teamYearly * (prices.TEAM.yearly / 12)
    );

    // Accurate ARR: monthly subs * 12, yearly subs pay yearly price
    const arr = Math.round(
      proMonthly * prices.PRO.monthly * 12 +
      proYearly * prices.PRO.yearly +
      teamMonthly * prices.TEAM.monthly * 12 +
      teamYearly * prices.TEAM.yearly
    );

    return NextResponse.json({
      totalUsers,
      proUsers,
      teamUsers,
      proMonthly,
      proYearly,
      teamMonthly,
      teamYearly,
      mrr,
      arr,
      pastDue,
      trialing,
      canceled,
      openTickets,
      totalTickets,
      recentSignups,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
