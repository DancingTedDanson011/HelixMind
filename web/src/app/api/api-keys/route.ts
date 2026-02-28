import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Generate key: hm_<32 random hex chars>
    const rawKey = `hm_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 10);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        keyHash,
        keyPrefix,
        scopes: parsed.data.scopes || ['read'],
      },
    });

    // Return the raw key only once
    return NextResponse.json({
      key: rawKey,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        createdAt: apiKey.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('API key creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    await prisma.apiKey.updateMany({
      where: { id, userId: session.user.id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API key revocation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
