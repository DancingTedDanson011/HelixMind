import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { deflateSync } from 'zlib';

const MAX_SNAPSHOTS_PER_BRAIN = 10;

export async function POST(req: Request) {
  try {
    const result = await requireApiKeyWithPlan(req, 'PRO', 'TEAM', 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. PRO, TEAM, or ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { brainId, version, nodesJson, metadata } = body;

    if (!brainId || version == null || !nodesJson) {
      return NextResponse.json(
        { error: 'Missing required fields: brainId, version, nodesJson' },
        { status: 400 },
      );
    }

    if (typeof nodesJson !== 'string') {
      return NextResponse.json(
        { error: 'nodesJson must be a JSON string' },
        { status: 400 },
      );
    }

    // Validate brain belongs to user
    const brain = await prisma.brainInstance.findFirst({
      where: { id: brainId, userId: result.userId },
      select: { id: true, syncEnabled: true },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    // Compress nodesJson
    const compressed = deflateSync(Buffer.from(nodesJson, 'utf-8'));
    const sizeBytes = compressed.length;

    // Create snapshot + update brain in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.brainSnapshot.create({
        data: {
          brainId,
          version: Number(version),
          nodesJson: compressed,
          metadata: metadata ?? undefined,
          sizeBytes,
        },
      });

      await tx.brainInstance.update({
        where: { id: brainId },
        data: {
          syncVersion: Number(version),
          lastSyncedAt: new Date(),
          syncEnabled: true,
        },
      });

      // Prune old snapshots: keep only the latest MAX_SNAPSHOTS_PER_BRAIN
      const allSnapshots = await tx.brainSnapshot.findMany({
        where: { brainId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (allSnapshots.length > MAX_SNAPSHOTS_PER_BRAIN) {
        const toDelete = allSnapshots.slice(MAX_SNAPSHOTS_PER_BRAIN).map(s => s.id);
        await tx.brainSnapshot.deleteMany({
          where: { id: { in: toDelete } },
        });
      }
    });

    return NextResponse.json({ success: true, version: Number(version), sizeBytes });
  } catch (error) {
    console.error('Brain sync push error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
