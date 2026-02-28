import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';

const authorizeSchema = z.object({
  state: z.string().min(1),
  deviceName: z.string().max(200).optional(),
  deviceOs: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = authorizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Check API key limit based on plan
    const sub = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });
    const plan = sub?.plan ?? 'FREE';

    const planConfig = await prisma.planConfig.findUnique({
      where: { plan },
    });
    const maxKeys = planConfig?.maxApiKeys ?? 3;

    const activeKeyCount = await prisma.apiKey.count({
      where: { userId: session.user.id, revokedAt: null },
    });

    if (activeKeyCount >= maxKeys) {
      return NextResponse.json(
        {
          error: 'API key limit reached',
          plan,
          maxKeys,
          message: `Your ${plan} plan allows ${maxKeys} API keys. Revoke an existing key or upgrade your plan.`,
        },
        { status: 403 },
      );
    }

    // Generate API key
    const rawKey = `hm_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 10);

    const deviceName = parsed.data.deviceName || 'CLI Device';
    const keyName = `CLI: ${deviceName} (${parsed.data.deviceOs || 'unknown'})`;

    await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name: keyName,
        keyHash,
        keyPrefix,
        scopes: ['cli', 'relay'],
      },
    });

    // Get user email for response
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    return NextResponse.json(
      {
        key: rawKey,
        state: parsed.data.state,
        userId: session.user.id,
        email: user?.email,
        plan,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('CLI authorize error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
