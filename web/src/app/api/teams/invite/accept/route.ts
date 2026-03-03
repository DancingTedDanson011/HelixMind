import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { z } from 'zod';

const acceptSchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: Request) {
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

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (invite.expiresAt < new Date()) {
      await prisma.teamInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 });
    }

    if (invite.email !== session.user.email) {
      return NextResponse.json({ error: 'Invite is for a different email' }, { status: 403 });
    }

    // Check if already a member
    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId: session.user.id } },
    });
    if (existing) {
      await prisma.teamInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ error: 'Already a team member' }, { status: 409 });
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
