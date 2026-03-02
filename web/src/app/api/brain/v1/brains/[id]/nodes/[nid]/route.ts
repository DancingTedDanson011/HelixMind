import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { inflateSync, deflateSync } from 'zlib';

interface SpiralNode {
  id: string;
  content: string;
  level: number;
  tags: string[];
  connections: string[];
  createdAt: number;
  updatedAt: number;
  accessCount: number;
}

async function getLatestSnapshot(brainId: string) {
  return prisma.brainSnapshot.findFirst({
    where: { brainId },
    orderBy: { version: 'desc' },
  });
}

function decompressNodes(snapshot: { nodesJson: Uint8Array }): SpiralNode[] {
  const json = inflateSync(Buffer.from(snapshot.nodesJson)).toString('utf-8');
  return JSON.parse(json);
}

function compressNodes(nodes: SpiralNode[]): Buffer {
  return deflateSync(Buffer.from(JSON.stringify(nodes), 'utf-8'));
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; nid: string }> },
) {
  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id: brainId, nid } = await params;

    const brain = await prisma.brainInstance.findFirst({
      where: { id: brainId, userId: result.userId },
      select: { id: true },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    const snapshot = await getLatestSnapshot(brainId);
    if (!snapshot) {
      return NextResponse.json({ error: 'No snapshots found' }, { status: 404 });
    }

    const nodes = decompressNodes(snapshot);
    const node = nodes.find(n => n.id === nid);

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    return NextResponse.json({ node });
  } catch (error) {
    console.error('Brain v1 node get error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; nid: string }> },
) {
  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id: brainId, nid } = await params;

    const brain = await prisma.brainInstance.findFirst({
      where: { id: brainId, userId: result.userId },
      select: { id: true, syncVersion: true },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    const snapshot = await getLatestSnapshot(brainId);
    if (!snapshot) {
      return NextResponse.json({ error: 'No snapshots found' }, { status: 404 });
    }

    const nodes = decompressNodes(snapshot);
    const nodeIndex = nodes.findIndex(n => n.id === nid);

    if (nodeIndex === -1) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const body = await req.json();
    const node = nodes[nodeIndex];

    if (body.content !== undefined) node.content = body.content;
    if (body.level !== undefined) node.level = Number(body.level);
    if (body.tags !== undefined) node.tags = body.tags;
    if (body.connections !== undefined) node.connections = body.connections;
    node.updatedAt = Date.now();

    nodes[nodeIndex] = node;

    const compressed = compressNodes(nodes);
    const newVersion = brain.syncVersion + 1;

    await prisma.$transaction(async (tx) => {
      await tx.brainSnapshot.create({
        data: {
          brainId,
          version: newVersion,
          nodesJson: compressed,
          sizeBytes: compressed.length,
        },
      });

      await tx.brainInstance.update({
        where: { id: brainId },
        data: {
          syncVersion: newVersion,
          lastSyncedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ node, version: newVersion });
  } catch (error) {
    console.error('Brain v1 node update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; nid: string }> },
) {
  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id: brainId, nid } = await params;

    const brain = await prisma.brainInstance.findFirst({
      where: { id: brainId, userId: result.userId },
      select: { id: true, syncVersion: true },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    const snapshot = await getLatestSnapshot(brainId);
    if (!snapshot) {
      return NextResponse.json({ error: 'No snapshots found' }, { status: 404 });
    }

    const nodes = decompressNodes(snapshot);
    const filtered = nodes.filter(n => n.id !== nid);

    if (filtered.length === nodes.length) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const compressed = compressNodes(filtered);
    const newVersion = brain.syncVersion + 1;

    await prisma.$transaction(async (tx) => {
      await tx.brainSnapshot.create({
        data: {
          brainId,
          version: newVersion,
          nodesJson: compressed,
          sizeBytes: compressed.length,
        },
      });

      await tx.brainInstance.update({
        where: { id: brainId },
        data: {
          syncVersion: newVersion,
          nodeCount: filtered.length,
          lastSyncedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ success: true, deleted: nid, version: newVersion });
  } catch (error) {
    console.error('Brain v1 node delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
