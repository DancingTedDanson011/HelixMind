import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { clearSettingsCache } from '@/lib/settings';
import { z } from 'zod';

export async function GET() {
  try {
    const session = await requireRole('ADMIN');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Mask secret values — show only last 4 chars
    const masked = settings.map((s: typeof settings[number]) => ({
      ...s,
      value: s.isSecret && s.value
        ? '•'.repeat(Math.max(0, s.value.length - 4)) + s.value.slice(-4)
        : s.value,
      hasValue: !!s.value,
    }));

    return NextResponse.json(masked);
  } catch (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  category: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  isSecret: z.boolean().optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await requireRole('ADMIN');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { key, value, category, label, description, isSecret } = parsed.data;

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value,
        updatedBy: session.user.id,
        ...(category && { category }),
        ...(label && { label }),
        ...(description !== undefined && { description }),
        ...(isSecret !== undefined && { isSecret }),
      },
      create: {
        key,
        value,
        category: category || 'general',
        label: label || key,
        description,
        isSecret: isSecret ?? false,
        updatedBy: session.user.id,
      },
    });

    clearSettingsCache();

    return NextResponse.json({
      ...setting,
      value: setting.isSecret
        ? '•'.repeat(Math.max(0, setting.value.length - 4)) + setting.value.slice(-4)
        : setting.value,
    });
  } catch (error) {
    console.error('Setting update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireRole('ADMIN');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }

    await prisma.systemSetting.delete({ where: { key } });
    clearSettingsCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Setting delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
