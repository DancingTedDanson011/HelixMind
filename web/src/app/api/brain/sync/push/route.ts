import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { deflateSync } from 'zlib';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { z } from 'zod';

const MAX_SNAPSHOTS_PER_BRAIN = 10;

const pushSchema = z.object({
  brainId: z.string().min(1).max(128),
  version: z.number({ coerce: true }).int().nonnegative(),
  nodesJson: z.string().min(1),
  metadata: z.any().optional(),
});

export async function POST(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/brain/sync/push', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const result = await requireApiKeyWithPlan(req, 'PRO', 'TEAM', 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. PRO, TEAM, or ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    // SECURITY: Enforce body size limit before parsing to prevent OOM
    const MAX_PUSH_BYTES = 50 * 1024 * 1024; // 50MB
    const rawText = await req.text();
    if (rawText.length > MAX_PUSH_BYTES) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    let rawBody: unknown;
    try {
      rawBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = pushSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { brainId, version, nodesJson, metadata } = parsed.data;

    // SECURITY: Enforce string size limit after parsing
    if (nodesJson.length > MAX_PUSH_BYTES) {
      return NextResponse.json({ error: 'nodesJson too large' }, { status: 413 });
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
