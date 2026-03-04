import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes, createHash } from 'crypto';
import { checkRateLimit, DEVICE_CODE_RATE_LIMIT } from '@/lib/rate-limit';
import { z } from 'zod';

const confirmSchema = z.object({
  code: z.string().min(5).max(10),
});

export async function POST(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/auth/device/confirm', DEVICE_CODE_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const code = parsed.data.code.trim().toUpperCase();
    const record = await prisma.deviceCode.findUnique({ where: { code } });

    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 404 });
    }

    if (record.expiresAt < new Date()) {
      await prisma.deviceCode.delete({ where: { id: record.id } }).catch(() => {});
      return NextResponse.json({ error: 'Code expired' }, { status: 410 });
    }

    if (record.apiKey) {
      return NextResponse.json({ error: 'Code already used' }, { status: 409 });
    }

    // Create API key (same logic as authorize/route.ts)
    const keyName = `CLI: ${record.deviceName} (${record.deviceOs})`;

    // Revoke existing key for same device
    await prisma.apiKey.updateMany({
      where: {
        userId: session.user.id,
        name: keyName,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    // Check API key limit
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

    await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name: keyName,
        keyHash,
        keyPrefix,
        scopes: ['cli', 'relay'],
      },
    });

    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    // Update DeviceCode with result (CLI will pick it up via poll)
    await prisma.deviceCode.update({
      where: { id: record.id },
      data: {
        userId: session.user.id,
        apiKey: rawKey,
        email: user?.email,
        plan,
      },
    });

    return NextResponse.json({
      success: true,
      deviceName: record.deviceName,
      deviceOs: record.deviceOs,
    });
  } catch (error) {
    console.error('Device code confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
