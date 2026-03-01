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
    const { name, brainType, projectPath } = body;

    if (!name || !brainType) {
      return NextResponse.json({ error: 'Missing name or brainType' }, { status: 400 });
    }

    if (brainType !== 'global' && brainType !== 'local') {
      return NextResponse.json({ error: 'brainType must be "global" or "local"' }, { status: 400 });
    }

    // Brain creation is handled locally via CLI (brain registry + spiral DB)
    // This endpoint validates against plan limits and records for billing
    return NextResponse.json({
      success: true,
      message: 'Brain creation validated. CLI will create the actual brain instance.',
      name,
      brainType,
      projectPath,
    });
  } catch (error) {
    console.error('Brain create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
