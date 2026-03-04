import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { requireTeamRole } from '@/lib/team-auth';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { validateId } from '@/lib/validation';
import { z } from 'zod';

const patchSchema = z.object({
  permission: z.enum(['READ', 'WRITE', 'ADMIN']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; brainId: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/brains/id', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const { id, brainId } = await params;
    const invalidId = validateId(id);
    if (invalidId) return invalidId;
    const invalidBrainId = validateId(brainId, 'brainId');
    if (invalidBrainId) return invalidBrainId;

    const authResult = await requireTeamRole(id, 'OWNER', 'ADMIN');
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const share = await prisma.teamBrainShare.findUnique({
      where: { teamId_brainId: { teamId: id, brainId } },
    });
    if (!share) {
      return NextResponse.json({ error: 'Shared brain not found' }, { status: 404 });
    }

    const updated = await prisma.teamBrainShare.update({
      where: { teamId_brainId: { teamId: id, brainId } },
      data: { permission: parsed.data.permission },
    });

    return NextResponse.json({
      share: { id: updated.id, permission: updated.permission },
    });
  } catch (error) {
    console.error('Brain share PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; brainId: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/brains/id', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const { id, brainId } = await params;
    const invalidId = validateId(id);
    if (invalidId) return invalidId;
    const invalidBrainId = validateId(brainId, 'brainId');
    if (invalidBrainId) return invalidBrainId;

    // SECURITY: Always verify team membership first, then check sharer identity.
    // This prevents ex-members from manipulating team resources after removal.
    const authResult = await requireTeamRole(id, 'OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const share = await prisma.teamBrainShare.findUnique({
      where: { teamId_brainId: { teamId: id, brainId } },
    });
    if (!share) {
      return NextResponse.json({ error: 'Shared brain not found' }, { status: 404 });
    }

    // Allow OWNER/ADMIN or the person who shared it (must still be a team member)
    const isSharer = share.sharedById === authResult.session.user.id;
    if (!isSharer && !['OWNER', 'ADMIN'].includes(authResult.member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.teamBrainShare.delete({
      where: { teamId_brainId: { teamId: id, brainId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Brain share DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
