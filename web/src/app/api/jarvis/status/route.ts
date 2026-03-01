import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/relay-auth';
import { getActiveWorkers, getAllWorkers } from '@/lib/jarvis/worker-manager';
import { getPendingCallCount } from '@/lib/jarvis/remote-tools';

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

    const active = getActiveWorkers(result.userId);
    const all = getAllWorkers(result.userId);
    const pendingToolCalls = getPendingCallCount();

    return NextResponse.json({
      activeWorkers: active.length,
      totalWorkers: all.length,
      workers: active,
      pendingToolCalls,
    });
  } catch (error) {
    console.error('Jarvis status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
