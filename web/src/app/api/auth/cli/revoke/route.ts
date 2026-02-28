import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = authHeader?.replace(/^Bearer\s+/i, '');

    if (!apiKey || !apiKey.startsWith('hm_')) {
      return NextResponse.json({ error: 'Missing or invalid API key' }, { status: 401 });
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const result = await prisma.apiKey.updateMany({
      where: { keyHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Key not found or already revoked' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CLI revoke error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
