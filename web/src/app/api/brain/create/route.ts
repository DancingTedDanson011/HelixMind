import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/relay-auth';
import { plans } from '@/lib/constants';
import type { Plan } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = authHeader?.replace(/^Bearer\s+/i, '');

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }

    const result = await validateApiKey(apiKey);
    if (!result) {
      return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 });
    }

    const body = await req.json();
    const { name, brainType, projectPath } = body;

    if (!name || !brainType) {
      return NextResponse.json({ error: 'Missing name or brainType' }, { status: 400 });
    }

    if (brainType !== 'global' && brainType !== 'local') {
      return NextResponse.json({ error: 'brainType must be "global" or "local"' }, { status: 400 });
    }

    // Check plan limits
    const sub = await prisma.subscription.findUnique({
      where: { userId: result.userId },
      select: { plan: true, status: true },
    });

    const plan = (sub?.status === 'ACTIVE' ? sub.plan : 'FREE') as Plan;
    const planConfig = plans[plan] ?? plans.FREE;
    const limits = planConfig.brains;

    const existingCounts = await prisma.brainInstance.groupBy({
      by: ['type'],
      where: { userId: result.userId },
      _count: true,
    });

    const globalCount = existingCounts.find(c => c.type === 'global')?._count ?? 0;
    const localCount = existingCounts.find(c => c.type === 'local')?._count ?? 0;

    if (brainType === 'global' && globalCount >= limits.maxGlobal) {
      return NextResponse.json(
        { error: `Plan limit reached: max ${limits.maxGlobal} global brain(s) for ${planConfig.name}` },
        { status: 403 },
      );
    }

    if (brainType === 'local' && localCount >= limits.maxLocal) {
      return NextResponse.json(
        { error: `Plan limit reached: max ${limits.maxLocal} local brain(s) for ${planConfig.name}` },
        { status: 403 },
      );
    }

    const brain = await prisma.brainInstance.create({
      data: {
        userId: result.userId,
        name,
        type: brainType,
        projectPath: projectPath ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      brain: {
        id: brain.id,
        name: brain.name,
        type: brain.type,
        projectPath: brain.projectPath,
        nodeCount: brain.nodeCount,
        active: brain.active,
        syncEnabled: brain.syncEnabled,
        syncVersion: brain.syncVersion,
        createdAt: brain.createdAt,
      },
    });
  } catch (error) {
    console.error('Brain create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
