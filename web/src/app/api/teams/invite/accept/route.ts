import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { z } from 'zod';

const acceptSchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/teams/invite/accept', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const invite = await prisma.teamInvite.findUnique({
      where: { token: parsed.data.token },
    });

    // SECURITY (WIDE-WEB-009): collapse all failure cases into one generic
    // response so attackers cannot enumerate which tokens exist, which have
    // expired, which belong to a different address, or which target someone
    // who is already a member. We ALSO do not auto-delete expired invites
    // here — deletion on read is a gadget for side-channel enumeration via
    // timing and database state; expired invites should be cleaned up by a
    // scheduled job, not by anonymous POSTs against this endpoint.
    const INVALID = NextResponse.json({ error: 'Invalid invite' }, { status: 400 });

    if (!invite) {
      return INVALID;
    }

    if (invite.expiresAt < new Date()) {
      return INVALID;
    }

    if (invite.email !== session.user.email) {
      return INVALID;
    }

    // Check if already a member
    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId: session.user.id } },
    });
    if (existing) {
      return INVALID;
    }

    // Create member and delete invite in transaction
    const member = await prisma.$transaction(async (tx) => {
      const m = await tx.teamMember.create({
        data: {
          teamId: invite.teamId,
          userId: session.user.id,
          role: invite.role,
        },
      });
      await tx.teamInvite.delete({ where: { id: invite.id } });
      return m;
    });

    // Notify team owner
    const team = await prisma.team.findUnique({
      where: { id: invite.teamId },
      select: { ownerId: true, name: true },
    });
    if (team) {
      createNotification({
        userId: team.ownerId,
        type: 'TEAM_INVITE',
        title: 'Invite Accepted',
        body: `${session.user.email} joined ${team.name}`,
        link: '/dashboard/team',
      }).catch((err) => console.error('Accept notification error:', err));
    }

    return NextResponse.json({
      member: {
        id: member.id,
        teamId: member.teamId,
        role: member.role,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
