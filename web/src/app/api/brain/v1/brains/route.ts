import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { plans } from '@/lib/constants';
import type { Plan } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const brains = await prisma.brainInstance.findMany({
      where: { userId: result.userId },
      select: {
        id: true,
        name: true,
        type: true,
        nodeCount: true,
        active: true,
        syncEnabled: true,
        lastSyncedAt: true,
        syncVersion: true,
        projectPath: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { lastAccessedAt: 'desc' },
    });

    return NextResponse.json({ brains });
  } catch (error) {
    console.error('Brain v1 list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { name, brainType, projectPath } = body;

    if (!name || !brainType) {
      return NextResponse.json({ error: 'Missing name or brainType' }, { status: 400 });
    }

    if (brainType !== 'global' && brainType !== 'local') {
      return NextResponse.json({ error: 'brainType must be "global" or "local"' }, { status: 400 });
    }

    // Enterprise has unlimited brains, but still check subscription
    const sub = await prisma.subscription.findUnique({
      where: { userId: result.userId },
      select: { plan: true },
    });

    const plan = (sub?.plan ?? 'FREE') as Plan;
    const planConfig = plans[plan] ?? plans.FREE;

    const brain = await prisma.brainInstance.create({
      data: {
        userId: result.userId,
        name,
        type: brainType,
        projectPath: projectPath ?? null,
      },
    });

    return NextResponse.json({
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
    }, { status: 201 });
  } catch (error) {
    console.error('Brain v1 create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
