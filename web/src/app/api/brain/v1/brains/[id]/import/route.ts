import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { deflateSync } from 'zlib';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/brain/v1/import', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const auth = await requireApiKeyWithPlan(req, 'ENTERPRISE');
  if (!auth) return NextResponse.json({ error: 'Unauthorized or insufficient plan' }, { status: 403 });

  const brain = await prisma.brainInstance.findFirst({
    where: { id, userId: auth.userId },
  });
  if (!brain) return NextResponse.json({ error: 'Brain not found' }, { status: 404 });

  const body = await req.json();
  const { nodes, edges } = body;

  if (!Array.isArray(nodes)) {
    return NextResponse.json({ error: 'nodes must be an array' }, { status: 400 });
  }

  const nodesJson = JSON.stringify(nodes);
  const compressedNodes = deflateSync(Buffer.from(nodesJson));
  const compressedEdges = edges ? deflateSync(Buffer.from(JSON.stringify(edges))) : null;
  const newVersion = brain.syncVersion + 1;

  await prisma.brainSnapshot.create({
    data: {
      brainId: id,
      version: newVersion,
      nodesJson: compressedNodes,
      edgesJson: compressedEdges,
      sizeBytes: compressedNodes.length + (compressedEdges?.length || 0),
      metadata: { nodeCount: nodes.length, importedAt: Date.now() },
    },
  });

  await prisma.brainInstance.update({
    where: { id },
    data: {
      syncVersion: newVersion,
      nodeCount: nodes.length,
      lastSyncedAt: new Date(),
    },
  });

  // Keep max 10 snapshots
  const snapshots = await prisma.brainSnapshot.findMany({
    where: { brainId: id },
    orderBy: { version: 'desc' },
    skip: 10,
    select: { id: true },
  });
  if (snapshots.length > 0) {
    await prisma.brainSnapshot.deleteMany({
      where: { id: { in: snapshots.map((s) => s.id) } },
    });
  }

  return NextResponse.json({
    success: true,
    version: newVersion,
    nodeCount: nodes.length,
  });
}
