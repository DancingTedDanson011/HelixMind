import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { inflateSync } from 'zlib';
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/brain/v1/search', GENERAL_RATE_LIMIT);
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

    const brain = await prisma.brainInstance.findFirst({
      where: { id: brainId, userId: result.userId },
      select: { id: true },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    const snapshot = await prisma.brainSnapshot.findFirst({
      where: { brainId },
      orderBy: { version: 'desc' },
    });

    if (!snapshot) {
      return NextResponse.json({ nodes: [], total: 0 });
    }

    // SECURITY: Cap decompressed output to 100MB to prevent decompression bombs
    const MAX_DECOMPRESS_BYTES = 100 * 1024 * 1024;
    const json = inflateSync(Buffer.from(snapshot.nodesJson), { maxOutputLength: MAX_DECOMPRESS_BYTES }).toString('utf-8');
    let nodes: SpiralNode[] = JSON.parse(json);

    const url = new URL(req.url);
    const query = url.searchParams.get('q')?.toLowerCase();
    const levelParam = url.searchParams.get('level');
    const tagParam = url.searchParams.get('tag');

    if (query) {
      nodes = nodes.filter(n => n.content.toLowerCase().includes(query));
    }

    if (levelParam) {
      const level = parseInt(levelParam, 10);
      if (!isNaN(level)) {
        nodes = nodes.filter(n => n.level === level);
      }
    }

    if (tagParam) {
      const tag = tagParam.toLowerCase();
      nodes = nodes.filter(n => n.tags.some(t => t.toLowerCase() === tag));
    }

    // Paginate results to prevent unbounded response sizes
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 1000);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const total = nodes.length;
    nodes = nodes.slice(offset, offset + limit);

    return NextResponse.json({ nodes, total, limit, offset });
  } catch (error) {
    console.error('Brain v1 search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
