import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/relay-auth';

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

    const body = await req.json();
    const { brainId, newName } = body;

    if (!brainId || !newName) {
      return NextResponse.json({ error: 'Missing brainId or newName' }, { status: 400 });
    }

    // Verify brain belongs to user
    const brain = await prisma.brainInstance.findFirst({
      where: { id: brainId, userId: result.userId },
      select: { id: true },
    });

    if (!brain) {
      return NextResponse.json({ error: 'Brain not found' }, { status: 404 });
    }

    const updated = await prisma.brainInstance.update({
      where: { id: brainId },
      data: { name: newName },
      select: { id: true, name: true },
    });

    return NextResponse.json({ success: true, brain: updated });
  } catch (error) {
    console.error('Brain rename error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
