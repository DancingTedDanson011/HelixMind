import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export async function GET() {
  try {
    const session = await requireRole('ADMIN');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const plans = await prisma.planConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error('Plans fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updatePlanSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  monthlyPrice: z.number().nullable().optional(),
  yearlyPrice: z.number().nullable().optional(),
  tokenLimit: z.number().nullable().optional(),
  maxApiKeys: z.number().optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  stripePriceMonthly: z.string().nullable().optional(),
  stripePriceYearly: z.string().nullable().optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await requireRole('ADMIN');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { id, ...data } = parsed.data;

    const plan = await prisma.planConfig.update({
      where: { id },
      data,
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error('Plan update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
