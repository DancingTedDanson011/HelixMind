import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { inflateSync } from 'zlib';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { validateId } from '@/lib/validation';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ brainId: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/brain/sync/pull', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const result = await requireApiKeyWithPlan(req, 'PRO', 'TEAM', 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. PRO, TEAM, or ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { brainId } = await params;
    const invalid = validateId(brainId, 'brainId');
    if (invalid) return invalid;

    // Verify brain belongs to user
    const brain = await prisma.brainInstance.findFirst({
      where: { id: brainId, userId: result.userId },
      select: { id: true },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    // Load latest snapshot
    const snapshot = await prisma.brainSnapshot.findFirst({
      where: { brainId },
      orderBy: { version: 'desc' },
    });

    if (!snapshot) {
      return NextResponse.json({ error: 'No snapshots found' }, { status: 404 });
    }

    // SECURITY: Cap decompressed output to 100MB to prevent decompression bombs
    const MAX_DECOMPRESS_BYTES = 100 * 1024 * 1024;
    const nodesJson = inflateSync(Buffer.from(snapshot.nodesJson), { maxOutputLength: MAX_DECOMPRESS_BYTES }).toString('utf-8');

    return NextResponse.json({
      brainId,
      version: snapshot.version,
      nodesJson,
      metadata: snapshot.metadata,
      createdAt: snapshot.createdAt,
    });
  } catch (error) {
    console.error('Brain sync pull error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
