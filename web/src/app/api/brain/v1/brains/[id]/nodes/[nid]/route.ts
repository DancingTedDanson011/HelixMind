import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { inflateSync, deflateSync } from 'zlib';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { validateId } from '@/lib/validation';

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

// SECURITY: Cap decompressed output to 100MB to prevent decompression bombs
const MAX_DECOMPRESS_BYTES = 100 * 1024 * 1024;

function decompressNodes(snapshot: { nodesJson: Uint8Array }): SpiralNode[] {
  const json = inflateSync(Buffer.from(snapshot.nodesJson), { maxOutputLength: MAX_DECOMPRESS_BYTES }).toString('utf-8');
  return JSON.parse(json);
}

function compressNodes(nodes: SpiralNode[]): Buffer {
  return deflateSync(Buffer.from(JSON.stringify(nodes), 'utf-8'));
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; nid: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/brain/v1/nodes/nid', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id: brainId, nid } = await params;
    const invalidId = validateId(brainId);
    if (invalidId) return invalidId;
    const invalidNid = validateId(nid, 'nid');
    if (invalidNid) return invalidNid;

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
  const rateLimited = checkRateLimit(req, 'api/brain/v1/nodes/nid', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;
  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id: brainId, nid } = await params;
    const invalidId = validateId(brainId);
    if (invalidId) return invalidId;
    const invalidNid = validateId(nid, 'nid');
    if (invalidNid) return invalidNid;

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

    if (body.content !== undefined) {
      if (typeof body.content !== 'string' || body.content.length > 500_000) {
        return NextResponse.json({ error: 'content must be a string (max 500KB)' }, { status: 400 });
      }
      node.content = body.content;
    }
    if (body.level !== undefined) {
      const numLevel = Number(body.level);
      if (!Number.isInteger(numLevel) || numLevel < 1 || numLevel > 5) {
        return NextResponse.json({ error: 'level must be an integer 1-5' }, { status: 400 });
      }
      node.level = numLevel;
    }
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags) || body.tags.length > 100 || !body.tags.every((t: unknown) => typeof t === 'string' && (t as string).length <= 200)) {
        return NextResponse.json({ error: 'tags must be an array of strings (max 100 items, 200 chars each)' }, { status: 400 });
      }
      node.tags = body.tags;
    }
    if (body.connections !== undefined) {
      if (!Array.isArray(body.connections) || body.connections.length > 500 || !body.connections.every((c: unknown) => typeof c === 'string' && (c as string).length <= 128)) {
        return NextResponse.json({ error: 'connections must be an array of strings (max 500 items)' }, { status: 400 });
      }
      node.connections = body.connections;
    }
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
  const rateLimited = checkRateLimit(req, 'api/brain/v1/nodes/nid', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id: brainId, nid } = await params;
    const invalidId = validateId(brainId);
    if (invalidId) return invalidId;
    const invalidNid = validateId(nid, 'nid');
    if (invalidNid) return invalidNid;

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
