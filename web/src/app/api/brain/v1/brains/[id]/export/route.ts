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
  const rateLimited = checkRateLimit(req, 'api/brain/v1/export', GENERAL_RATE_LIMIT);
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

  const snapshot = await prisma.brainSnapshot.findFirst({
    where: { brainId: id },
    orderBy: { version: 'desc' },
  });

  // SECURITY: Cap decompressed output to 100MB to prevent decompression bombs
  const MAX_DECOMPRESS_BYTES = 100 * 1024 * 1024;
  let nodes: unknown[] = [];
  let edges: unknown[] = [];
  if (snapshot) {
    try {
      nodes = JSON.parse(inflateSync(Buffer.from(snapshot.nodesJson), { maxOutputLength: MAX_DECOMPRESS_BYTES }).toString('utf-8'));
    } catch { nodes = []; }
    if (snapshot.edgesJson) {
      try {
        edges = JSON.parse(inflateSync(Buffer.from(snapshot.edgesJson), { maxOutputLength: MAX_DECOMPRESS_BYTES }).toString('utf-8'));
      } catch { edges = []; }
    }
  }

  return NextResponse.json({
    brain: {
      id: brain.id,
      name: brain.name,
      type: brain.type,
      nodeCount: brain.nodeCount,
      syncVersion: brain.syncVersion,
      createdAt: brain.createdAt,
    },
    nodes,
    edges,
    exportedAt: new Date().toISOString(),
  });
}
