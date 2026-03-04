import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTeamRole } from '@/lib/team-auth';
import { createNotification } from '@/lib/notifications';
import { sendTeamInviteEmail } from '@/lib/email';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { validateId } from '@/lib/validation';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/invite', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const { id } = await params;
    const invalid = validateId(id);
    if (invalid) return invalid;

    const authResult = await requireTeamRole(id, 'OWNER', 'ADMIN');
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invites = await prisma.teamInvite.findMany({
      where: { teamId: id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      invites: invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Invites GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/invite', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const { id } = await params;
    const invalid = validateId(id);
    if (invalid) return invalid;

    const authResult = await requireTeamRole(id, 'OWNER', 'ADMIN');
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // SECURITY: Only OWNER can invite with ADMIN role
    if (parsed.data.role === 'ADMIN' && authResult.member.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only the team owner can invite admins' }, { status: 403 });
    }

    // SECURITY: Enforce seat limits based on team plan (members + pending invites)
    const teamForPlan = await prisma.team.findUnique({ where: { id }, select: { plan: true } });
    const SEAT_LIMITS: Record<string, number> = { FREE: 3, PRO: 5, TEAM: 50, ENTERPRISE: 500 };
    const maxSeats = SEAT_LIMITS[teamForPlan?.plan || 'FREE'] ?? 3;
    const [currentMembers, pendingInvites] = await Promise.all([
      prisma.teamMember.count({ where: { teamId: id } }),
      prisma.teamInvite.count({ where: { teamId: id, expiresAt: { gt: new Date() } } }),
    ]);
    if (currentMembers + pendingInvites >= maxSeats) {
      return NextResponse.json({ error: `Team seat limit reached (${maxSeats} including pending invites). Upgrade your plan.` }, { status: 403 });
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existingUser) {
      const existingMember = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: id, userId: existingUser.id } },
      });
      if (existingMember) {
        return NextResponse.json({ error: 'User is already a team member' }, { status: 409 });
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [invite, team] = await Promise.all([
      prisma.teamInvite.upsert({
        where: { teamId_email: { teamId: id, email: parsed.data.email } },
        update: { role: parsed.data.role, expiresAt },
        create: {
          teamId: id,
          email: parsed.data.email,
          role: parsed.data.role,
          expiresAt,
        },
      }),
      prisma.team.findUnique({ where: { id }, select: { name: true } }),
    ]);

    const teamName = team?.name || 'a team';
    const inviterName = authResult.session.user.name || 'A team admin';
    const siteUrl = process.env.NEXTAUTH_URL || 'https://helixmind.dev';
    const acceptUrl = `${siteUrl}/invite/accept?token=${invite.token}`;

    // In-app notification (only if user exists)
    if (existingUser) {
      await createNotification({
        userId: existingUser.id,
        type: 'TEAM_INVITE',
        title: `Team Invite: ${teamName}`,
        body: `${inviterName} invited you to join ${teamName} as ${parsed.data.role}`,
        link: `/invite/accept?token=${invite.token}`,
      });
    }

    // Email notification (fire-and-forget)
    sendTeamInviteEmail(
      parsed.data.email,
      teamName,
      inviterName,
      parsed.data.role,
      acceptUrl,
    ).catch((err) => console.error('Team invite email error:', err));

    // SECURITY: Do not expose the invite token in the API response.
    // The token is distributed via email only, preventing interception via
    // browser network logs, proxy logs, or XSS-based API response theft.
    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Invite POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
