import { NextResponse } from 'next/server';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/license/status', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const authResult = await requireApiKeyWithPlan(req);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find license linked to user's team or by most recent activation
    const teamMember = await prisma.teamMember.findFirst({
      where: { userId: authResult.userId },
      select: { teamId: true },
    });

    let license = null;
    if (teamMember) {
      license = await prisma.license.findFirst({
        where: { teamId: teamMember.teamId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!license) {
      // Fallback: find any license with recent activation
      license = await prisma.license.findFirst({
        where: { activations: { gt: 0 } },
        orderBy: { activatedAt: 'desc' },
      });
    }

    if (!license) {
      return NextResponse.json({
        active: false,
        plan: 'FREE',
        seats: 0,
        features: [],
        expiresAt: null,
        activations: 0,
        maxActivations: 0,
      });
    }

    const active = license.expiresAt > new Date() && license.activations <= license.maxActivations;

    return NextResponse.json({
      active,
      plan: license.plan,
      seats: license.seats,
      features: license.features,
      expiresAt: license.expiresAt.toISOString(),
      activations: license.activations,
      maxActivations: license.maxActivations,
    });
  } catch (error) {
    console.error('License status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
