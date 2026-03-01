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

    // For now, return empty array — brain data lives in CLI registry
    // Server-side brain sync will be implemented with cloud_sync feature
    return NextResponse.json({
      brains: [],
      synced: false,
      message: 'Brain list is managed locally. Enable cloud sync for server-side brain management.',
    });
  } catch (error) {
    console.error('Brain list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
