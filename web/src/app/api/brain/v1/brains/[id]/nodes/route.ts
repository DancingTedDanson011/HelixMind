import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { inflateSync, deflateSync } from 'zlib';
import { randomUUID } from 'crypto';

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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id: brainId } = await params;

    // Verify ownership
    const brain = await prisma.brainInstance.findFirst({
      where: { id: brainId, userId: result.userId },
      select: { id: true },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    const snapshot = await getLatestSnapshot(brainId);
    if (!snapshot) {
      return NextResponse.json({ nodes: [], total: 0 });
    }

    let nodes = decompressNodes(snapshot);

    // Filter by level
    const url = new URL(req.url);
    const levelParam = url.searchParams.get('level');
    if (levelParam) {
      const level = parseInt(levelParam, 10);
      if (!isNaN(level)) {
        nodes = nodes.filter(n => n.level === level);
      }
    }

    const total = nodes.length;

    // Pagination
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 1000);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    nodes = nodes.slice(offset, offset + limit);

    return NextResponse.json({ nodes, total, limit, offset });
  } catch (error) {
    console.error('Brain v1 nodes list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id: brainId } = await params;

    // Verify ownership
    const brain = await prisma.brainInstance.findFirst({
      where: { id: brainId, userId: result.userId },
      select: { id: true, syncVersion: true },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    const body = await req.json();
    const { content, level, tags, connections } = body;

    if (!content || level == null) {
      return NextResponse.json({ error: 'Missing content or level' }, { status: 400 });
    }

    const now = Date.now();
    const newNode: SpiralNode = {
      id: randomUUID(),
      content,
      level: Number(level),
      tags: tags ?? [],
      connections: connections ?? [],
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
    };

    // Get existing nodes from latest snapshot
    const snapshot = await getLatestSnapshot(brainId);
    const existingNodes = snapshot ? decompressNodes(snapshot) : [];
    existingNodes.push(newNode);

    const compressed = compressNodes(existingNodes);
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
          nodeCount: existingNodes.length,
          lastSyncedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ node: newNode, version: newVersion }, { status: 201 });
  } catch (error) {
    console.error('Brain v1 node create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
