import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/relay-auth';
import { stopWorker } from '@/lib/jarvis/worker-manager';

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

    const body = await req.json().catch(() => ({}));
    const success = stopWorker(result.userId, body.workerId);

    return NextResponse.json({ success });
  } catch (error) {
    console.error('Jarvis stop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
