import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { inflateSync } from 'zlib';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { validateId } from '@/lib/validation';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/brain/v1/stats', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const invalid = validateId(id);
  if (invalid) return invalid;

  const auth = await requireApiKeyWithPlan(req, 'ENTERPRISE');
  if (!auth) return NextResponse.json({ error: 'Unauthorized or insufficient plan' }, { status: 403 });

  const brain = await prisma.brainInstance.findFirst({
    where: { id, userId: auth.userId },
  });
  if (!brain) return NextResponse.json({ error: 'Brain not found' }, { status: 404 });

  const snapshotCount = await prisma.brainSnapshot.count({ where: { brainId: id } });
  const totalSize = await prisma.brainSnapshot.aggregate({
    where: { brainId: id },
    _sum: { sizeBytes: true },
  });

  // Calculate level counts from latest snapshot
  const levelCounts: Record<number, number> = {};
  const latest = await prisma.brainSnapshot.findFirst({
    where: { brainId: id },
    orderBy: { version: 'desc' },
  });

  // SECURITY: Cap decompressed output to 100MB to prevent decompression bombs
  const MAX_DECOMPRESS_BYTES = 100 * 1024 * 1024;
  if (latest) {
    try {
      const nodes = JSON.parse(inflateSync(Buffer.from(latest.nodesJson), { maxOutputLength: MAX_DECOMPRESS_BYTES }).toString('utf-8'));
      if (Array.isArray(nodes)) {
        for (const node of nodes) {
          const level = node.level || 1;
          levelCounts[level] = (levelCounts[level] || 0) + 1;
        }
      }
    } catch { /* ignore parse errors */ }
  }

  return NextResponse.json({
    brainId: id,
    name: brain.name,
    type: brain.type,
    nodeCount: brain.nodeCount,
    levelCounts,
    syncVersion: brain.syncVersion,
    syncEnabled: brain.syncEnabled,
    lastSyncedAt: brain.lastSyncedAt,
    snapshotCount,
    totalSizeBytes: totalSize._sum.sizeBytes || 0,
    createdAt: brain.createdAt,
    lastAccessedAt: brain.lastAccessedAt,
  });
}
