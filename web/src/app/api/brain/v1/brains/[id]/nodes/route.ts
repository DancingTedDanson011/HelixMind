import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { inflateSync, deflateSync } from 'zlib';
import { randomUUID } from 'crypto';
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
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/brain/v1/nodes', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id: brainId } = await params;
    const invalid = validateId(brainId);
    if (invalid) return invalid;

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
  const rateLimited = checkRateLimit(req, 'api/brain/v1/nodes', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id: brainId } = await params;
    const invalid = validateId(brainId);
    if (invalid) return invalid;

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

    // SECURITY: Validate node field types and sizes
    if (typeof content !== 'string' || content.length > 500_000) {
      return NextResponse.json({ error: 'content must be a string (max 500KB)' }, { status: 400 });
    }
    const numLevel = Number(level);
    if (!Number.isInteger(numLevel) || numLevel < 1 || numLevel > 5) {
      return NextResponse.json({ error: 'level must be an integer 1-5' }, { status: 400 });
    }
    if (tags !== undefined && (!Array.isArray(tags) || tags.length > 100 || !tags.every((t: unknown) => typeof t === 'string' && t.length <= 200))) {
      return NextResponse.json({ error: 'tags must be an array of strings (max 100 items, 200 chars each)' }, { status: 400 });
    }
    if (connections !== undefined && (!Array.isArray(connections) || connections.length > 500 || !connections.every((c: unknown) => typeof c === 'string' && c.length <= 128))) {
      return NextResponse.json({ error: 'connections must be an array of strings (max 500 items)' }, { status: 400 });
    }

    const now = Date.now();
    const newNode: SpiralNode = {
      id: randomUUID(),
      content,
      level: numLevel,
      tags: tags ?? [],
      connections: connections ?? [],
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
    };

    // SECURITY: Perform version read + increment inside transaction to prevent race conditions
    const newVersion = await prisma.$transaction(async (tx) => {
      const currentBrain = await tx.brainInstance.findUniqueOrThrow({
        where: { id: brainId },
        select: { syncVersion: true },
      });

      const snapshot = await tx.brainSnapshot.findFirst({
        where: { brainId },
        orderBy: { version: 'desc' },
      });
      const existingNodes = snapshot ? decompressNodes(snapshot) : [];
      existingNodes.push(newNode);

      const compressed = compressNodes(existingNodes);
      const version = currentBrain.syncVersion + 1;

      await tx.brainSnapshot.create({
        data: {
          brainId,
          version,
          nodesJson: compressed,
          sizeBytes: compressed.length,
        },
      });

      await tx.brainInstance.update({
        where: { id: brainId },
        data: {
          syncVersion: version,
          nodeCount: existingNodes.length,
          lastSyncedAt: new Date(),
        },
      });

      return version;
    });

    return NextResponse.json({ node: newNode, version: newVersion }, { status: 201 });
  } catch (error) {
    console.error('Brain v1 node create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
