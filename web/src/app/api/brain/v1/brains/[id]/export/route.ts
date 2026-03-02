import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { inflateSync } from 'zlib';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  let nodes: unknown[] = [];
  let edges: unknown[] = [];
  if (snapshot) {
    try {
      nodes = JSON.parse(inflateSync(Buffer.from(snapshot.nodesJson)).toString('utf-8'));
    } catch { nodes = []; }
    if (snapshot.edgesJson) {
      try {
        edges = JSON.parse(inflateSync(Buffer.from(snapshot.edgesJson)).toString('utf-8'));
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
