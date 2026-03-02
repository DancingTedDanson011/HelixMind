import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { requireTeamRole } from '@/lib/team-auth';
import { z } from 'zod';

const shareSchema = z.object({
  brainId: z.string().min(1),
  permission: z.enum(['READ', 'WRITE', 'ADMIN']).default('READ'),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const authResult = await requireTeamRole(id);
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const shares = await prisma.teamBrainShare.findMany({
      where: { teamId: id },
      include: {
        brain: {
          select: {
            id: true,
            name: true,
            type: true,
            nodeCount: true,
            active: true,
            lastAccessedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      brains: shares.map((s) => ({
        shareId: s.id,
        brainId: s.brain.id,
        name: s.brain.name,
        type: s.brain.type,
        nodeCount: s.brain.nodeCount,
        active: s.brain.active,
        permission: s.permission,
        sharedById: s.sharedById,
        lastAccessedAt: s.brain.lastAccessedAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Team brains GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const authResult = await requireTeamRole(id, 'OWNER', 'ADMIN');
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = shareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Verify brain belongs to current user
    const brain = await prisma.brainInstance.findFirst({
      where: { id: parsed.data.brainId, userId: session.user.id },
    });
    if (!brain) {
      return NextResponse.json({ error: 'Brain not found or not yours' }, { status: 404 });
    }

    // Check if already shared
    const existingShare = await prisma.teamBrainShare.findUnique({
      where: { teamId_brainId: { teamId: id, brainId: parsed.data.brainId } },
    });
    if (existingShare) {
      return NextResponse.json({ error: 'Brain already shared with this team' }, { status: 409 });
    }

    const share = await prisma.teamBrainShare.create({
      data: {
        teamId: id,
        brainId: parsed.data.brainId,
        sharedById: session.user.id,
        permission: parsed.data.permission,
      },
      include: {
        brain: { select: { id: true, name: true, type: true, nodeCount: true } },
      },
    });

    return NextResponse.json({
      share: {
        shareId: share.id,
        brainId: share.brain.id,
        name: share.brain.name,
        type: share.brain.type,
        nodeCount: share.brain.nodeCount,
        permission: share.permission,
        sharedById: share.sharedById,
        createdAt: share.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Team brains POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
