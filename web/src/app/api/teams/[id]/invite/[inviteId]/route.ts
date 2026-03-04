import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTeamRole } from '@/lib/team-auth';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { validateId } from '@/lib/validation';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/invite/id', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const { id, inviteId } = await params;
    const invalidId = validateId(id);
    if (invalidId) return invalidId;
    const invalidInviteId = validateId(inviteId, 'inviteId');
    if (invalidInviteId) return invalidInviteId;

    const authResult = await requireTeamRole(id, 'OWNER', 'ADMIN');
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invite = await prisma.teamInvite.findFirst({
      where: { id: inviteId, teamId: id },
    });
    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    await prisma.teamInvite.delete({ where: { id: inviteId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invite DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
