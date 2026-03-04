import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { z } from 'zod';

const createLicenseSchema = z.object({
  seats: z.number().int().min(1).max(10000).default(10),
  features: z.array(z.string().max(100)).max(50).default([]),
  expiresAt: z.string().min(1),
  maxActivations: z.number().int().min(1).max(1000).default(1),
  teamId: z.string().uuid().optional(),
  plan: z.enum(['PRO', 'TEAM', 'ENTERPRISE']).default('ENTERPRISE'),
});

function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let group = '';
    const bytes = randomBytes(5);
    for (let i = 0; i < 5; i++) {
      group += chars[bytes[i] % chars.length];
    }
    groups.push(group);
  }
  return `HM-${groups.join('-')}`;
}

export async function GET(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/admin/licenses', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await requireRole('ADMIN');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const licenses = await prisma.license.findMany({
      include: {
        team: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mask keys — only show prefix
    const masked = licenses.map((l) => ({
      ...l,
      key: `${l.key.substring(0, 8)}...`,
    }));

    return NextResponse.json({ licenses: masked });
  } catch (error) {
    console.error('Admin licenses GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/admin/licenses', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await requireRole('ADMIN');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createLicenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { seats, features, expiresAt, maxActivations, teamId, plan } = parsed.data;

    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      return NextResponse.json({ error: 'expiresAt must be a valid future date' }, { status: 400 });
    }

    // Validate teamId if provided
    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }
    }

    const key = generateLicenseKey();
    const keyHash = createHash('sha256').update(key).digest('hex');

    const license = await prisma.license.create({
      data: {
        key,
        keyHash,
        plan,
        seats,
        features,
        expiresAt: expiryDate,
        maxActivations,
        teamId: teamId || null,
      },
      include: {
        team: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({ license, key }, { status: 201 });
  } catch (error) {
    console.error('Admin licenses POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/admin/licenses', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await requireRole('ADMIN');
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Valid license id is required' }, { status: 400 });
    }

    // Verify license exists before deleting
    const existing = await prisma.license.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    await prisma.license.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin licenses DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
