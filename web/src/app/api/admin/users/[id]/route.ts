import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const rateLimited = checkRateLimit(req, 'api/admin/users/id', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await requireRole('ADMIN', 'SUPPORT');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }
    const isSupport = session.user.role === 'SUPPORT';

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        locale: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        // Explicitly exclude passwordHash and sensitive Stripe IDs
        subscription: {
          select: {
            plan: true,
            status: true,
            billingPeriod: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        },
        apiKeys: isSupport
          ? { where: { revokedAt: null }, select: { id: true, name: true, createdAt: true } }
          : { where: { revokedAt: null }, select: { id: true, name: true, keyPrefix: true, scopes: true, createdAt: true } },
        _count: { select: { tickets: true, usageLogs: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('User detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateUserSchema = z.object({
  role: z.enum(['USER', 'SUPPORT', 'ADMIN']).optional(),
  name: z.string().min(1).optional(),
  locale: z.enum(['en', 'de']).optional(),
  plan: z.enum(['FREE', 'PRO', 'TEAM', 'ENTERPRISE']).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const rateLimited = checkRateLimit(req, 'api/admin/users/id', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await requireRole('ADMIN');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }
    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { role, name, locale, plan } = parsed.data;

    // SECURITY: Prevent admins from promoting themselves to higher roles
    if (role && role === 'ADMIN' && id === session.user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    // Prevent demotion of ANY admin when only 1 remains (not just self-demotion)
    if (role && role !== 'ADMIN') {
      const targetUser = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (targetUser?.role === 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          return NextResponse.json({ error: 'Cannot demote the last admin' }, { status: 400 });
        }
      }
    }

    // Atomic update: user fields + subscription in a single transaction
    await prisma.$transaction(async (tx) => {
      if (role || name || locale) {
        await tx.user.update({
          where: { id },
          data: {
            ...(role && { role }),
            ...(name && { name }),
            ...(locale && { locale }),
          },
        });
      }

      if (plan) {
        // SECURITY: Log admin plan overrides for audit trail
        console.warn(`[ADMIN AUDIT] User ${session.user.id} (${session.user.email}) changed plan for user ${id} to ${plan}`);
        await tx.subscription.upsert({
          where: { userId: id },
          update: { plan },
          create: { userId: id, plan, status: 'ACTIVE' },
        });
      }
    });

    const updated = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        locale: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        subscription: { select: { plan: true, status: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
