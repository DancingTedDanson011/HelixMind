import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { requireTeamPlan } from '@/lib/team-auth';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
});

export async function GET(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/teams', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teams = await prisma.team.findMany({
      where: {
        members: { some: { userId: session.user.id } },
      },
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        memberCount: t._count.members,
        myRole: t.members[0]?.role,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Teams GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/teams', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPlan = await requireTeamPlan(session.user.id);
    if (!hasPlan) {
      return NextResponse.json({ error: 'Team or Enterprise plan required' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.team.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 409 });
    }

    const team = await prisma.team.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        ownerId: session.user.id,
        members: {
          create: { userId: session.user.id, role: 'OWNER' },
        },
      },
      include: { _count: { select: { members: true } } },
    });

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        plan: team.plan,
        memberCount: team._count.members,
        myRole: 'OWNER',
        createdAt: team.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Teams POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
