import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/relay-auth';

export async function GET(req: Request) {
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

    const brains = await prisma.brainInstance.findMany({
      where: { userId: result.userId },
      select: {
        id: true,
        name: true,
        type: true,
        nodeCount: true,
        active: true,
        syncEnabled: true,
        lastSyncedAt: true,
        syncVersion: true,
        projectPath: true,
        createdAt: true,
      },
      orderBy: { lastAccessedAt: 'desc' },
    });

    return NextResponse.json({ brains, synced: true });
  } catch (error) {
    console.error('Brain list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
