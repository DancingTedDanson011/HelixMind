import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTeamRole } from '@/lib/team-auth';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { validateId } from '@/lib/validation';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/id', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const { id } = await params;
    const invalid = validateId(id);
    if (invalid) return invalid;

    const authResult = await requireTeamRole(id);
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { members: true, invites: true, brainShares: true } },
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        plan: team.plan,
        ownerId: team.ownerId,
        memberCount: team._count.members,
        inviteCount: team._count.invites,
        brainShareCount: team._count.brainShares,
        createdAt: team.createdAt.toISOString(),
        members: team.members.map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Team GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/id', GENERAL_RATE_LIMIT);
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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const team = await prisma.team.update({
      where: { id },
      data: { name: parsed.data.name },
    });

    return NextResponse.json({
      team: { id: team.id, name: team.name, slug: team.slug },
    });
  } catch (error) {
    console.error('Team PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/id', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const { id } = await params;
    const invalid = validateId(id);
    if (invalid) return invalid;

    const authResult = await requireTeamRole(id, 'OWNER');
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.team.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Team DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
