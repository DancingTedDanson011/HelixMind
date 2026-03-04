import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  locale: z.enum(['en', 'de']).optional(),
});

// PATCH — update profile (name, locale)
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  if (!data.name && !data.locale) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.locale !== undefined && { locale: data.locale }),
    },
    select: { id: true, name: true, locale: true, updatedAt: true },
  });

  return NextResponse.json(user);
}
