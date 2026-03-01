import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/relay-auth';
import { startWorker } from '@/lib/jarvis/worker-manager';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = authHeader?.replace(/^Bearer\s+/i, '');

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }

    const result = await validateApiKey(apiKey);
    if (!result) {
      return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const plan = user.subscription?.plan ?? 'FREE';
    const workerResult = startWorker(result.userId, plan);

    if (!workerResult.success) {
      return NextResponse.json({
        error: workerResult.error,
        plan,
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      worker: workerResult.worker,
      plan,
    });
  } catch (error) {
    console.error('Jarvis start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
