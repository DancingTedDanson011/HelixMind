import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { checkRateLimit, DEVICE_CODE_RATE_LIMIT } from '@/lib/rate-limit';

const SAFE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const CODE_LENGTH = 8;
const EXPIRES_IN_MS = 15 * 60 * 1000; // 15 minutes

const requestSchema = z.object({
  deviceName: z.string().max(200).default('CLI Device'),
  deviceOs: z.string().max(100).default('unknown'),
});

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  return code.slice(0, 4) + '-' + code.slice(4);
}

export async function POST(req: Request) {
  const limited = checkRateLimit(req, 'device-request', DEVICE_CODE_RATE_LIMIT);
  if (limited) return limited;

  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Clean up expired codes
    await prisma.deviceCode.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    // Generate unique code (retry on collision)
    let code = generateCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await prisma.deviceCode.findUnique({ where: { code } });
      if (!exists) break;
      code = generateCode();
    }

    const expiresAt = new Date(Date.now() + EXPIRES_IN_MS);

    // Generate a poll secret the CLI must present when polling for the result
    const pollSecret = randomBytes(32).toString('hex');

    await prisma.deviceCode.create({
      data: {
        code,
        pollSecret,
        expiresAt,
        deviceName: parsed.data.deviceName,
        deviceOs: parsed.data.deviceOs,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://helix-mind.ai';

    return NextResponse.json({
      code,
      pollSecret,
      expiresAt: expiresAt.toISOString(),
      verifyUrl: `${baseUrl}/auth/device`,
      pollInterval: 5,
    }, { status: 201 });
  } catch (error) {
    console.error('Device code request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
