import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/relay-auth';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ brainId: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/brain/sync/status', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

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

    const { brainId } = await params;

    const brain = await prisma.brainInstance.findFirst({
      where: { id: brainId, userId: result.userId },
      select: {
        id: true,
        syncEnabled: true,
        syncVersion: true,
        lastSyncedAt: true,
        _count: { select: { snapshots: true } },
      },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    return NextResponse.json({
      brainId: brain.id,
      syncEnabled: brain.syncEnabled,
      syncVersion: brain.syncVersion,
      lastSyncedAt: brain.lastSyncedAt,
      snapshotCount: brain._count.snapshots,
    });
  } catch (error) {
    console.error('Brain sync status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
