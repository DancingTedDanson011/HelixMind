import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/relay-auth';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = authHeader?.replace(/^Bearer\s+/i, '');

    if (!apiKey) {
      return NextResponse.json({ valid: false, error: 'Missing API key' }, { status: 401 });
    }

    const result = await validateApiKey(apiKey);
    if (!result) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired API key' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ valid: false, error: 'User not found' }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      userId: result.userId,
      email: user.email,
      plan: user.subscription?.plan ?? 'FREE',
    });
  } catch (error) {
    console.error('CLI verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
