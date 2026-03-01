import { NextResponse } from 'next/server';
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

    // Brain rename is handled locally via WS (brain registry lives on CLI side)
    // This endpoint exists for cloud-synced brains (PRO+)
    return NextResponse.json({
      success: true,
      brainId,
      newName,
      message: 'Brain rename handled via CLI relay. Cloud sync coming with PRO plan.',
    });
  } catch (error) {
    console.error('Brain rename error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
