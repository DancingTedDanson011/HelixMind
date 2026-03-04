import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { requireTeamRole } from '@/lib/team-auth';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const share = await prisma.teamBrainShare.findUnique({
      where: { teamId_brainId: { teamId: id, brainId } },
    });
    if (!share) {
      return NextResponse.json({ error: 'Shared brain not found' }, { status: 404 });
    }

    // Allow ADMIN+ or the person who shared it
    const isSharer = share.sharedById === session.user.id;
    if (!isSharer) {
      const authResult = await requireTeamRole(id, 'OWNER', 'ADMIN');
      if (!authResult) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
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
