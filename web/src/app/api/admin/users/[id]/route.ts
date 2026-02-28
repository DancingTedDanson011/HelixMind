import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireRole('ADMIN', 'SUPPORT');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const isSupport = session.user.role === 'SUPPORT';

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        subscription: true,
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
  try {
    const session = await requireRole('ADMIN');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { role, name, locale, plan } = parsed.data;

    // Update user fields
    if (role || name || locale) {
      await prisma.user.update({
        where: { id },
        data: {
          ...(role && { role }),
          ...(name && { name }),
          ...(locale && { locale }),
        },
      });
    }

    // Update subscription plan
    if (plan) {
      await prisma.subscription.upsert({
        where: { userId: id },
        update: { plan },
        create: { userId: id, plan, status: 'ACTIVE' },
      });
    }

    const updated = await prisma.user.findUnique({
      where: { id },
      include: { subscription: { select: { plan: true, status: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
