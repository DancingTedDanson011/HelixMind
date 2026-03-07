import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { validateId } from '@/lib/validation';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/brain/v1/brains/id', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id } = await params;
    const invalid = validateId(id);
    if (invalid) return invalid;

    const brain = await prisma.brainInstance.findFirst({
      where: { id, userId: result.userId },
      include: {
        _count: { select: { snapshots: true } },
      },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    return NextResponse.json({
      brain: {
        id: brain.id,
        name: brain.name,
        type: brain.type,
        projectPath: brain.projectPath,
        nodeCount: brain.nodeCount,
        active: brain.active,
        syncEnabled: brain.syncEnabled,
        lastSyncedAt: brain.lastSyncedAt,
        syncVersion: brain.syncVersion,
        snapshotCount: brain._count.snapshots,
        createdAt: brain.createdAt,
        updatedAt: brain.updatedAt,
      },
    });
  } catch (error) {
    console.error('Brain v1 get error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/brain/v1/brains/id', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;
  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id } = await params;
    const invalid = validateId(id);
    if (invalid) return invalid;

    const body = await req.json();

    // Verify ownership
    const brain = await prisma.brainInstance.findFirst({
      where: { id, userId: result.userId },
      select: { id: true },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    // Validate update fields
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > 200) {
        return NextResponse.json({ error: 'name must be a string (1-200 chars)' }, { status: 400 });
      }
      data.name = body.name;
    }
    if (body.syncEnabled !== undefined) data.syncEnabled = Boolean(body.syncEnabled);
    if (body.active !== undefined) data.active = Boolean(body.active);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await prisma.brainInstance.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      brain: {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        active: updated.active,
        syncEnabled: updated.syncEnabled,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Brain v1 update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/brain/v1/brains/id', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;
  try {
    const result = await requireApiKeyWithPlan(req, 'ENTERPRISE');
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized. ENTERPRISE plan required.' },
        { status: 401 },
      );
    }

    const { id } = await params;
    const invalid = validateId(id);
    if (invalid) return invalid;

    // Verify ownership
    const brain = await prisma.brainInstance.findFirst({
      where: { id, userId: result.userId },
      select: { id: true },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    // Delete brain and all snapshots (cascading)
    await prisma.brainInstance.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error('Brain v1 delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
