import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptApiKey } from '@/lib/crypto';

// GET — list user's LLM keys (provider + hint only, never the real key)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keys = await prisma.userLLMKey.findMany({
    where: { userId: session.user.id },
    select: { id: true, provider: true, keyHint: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(keys);
}

// POST — save/update LLM key
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { provider, apiKey } = body as { provider?: string; apiKey?: string };

  if (!provider || !apiKey) {
    return NextResponse.json({ error: 'provider and apiKey required' }, { status: 400 });
  }

  const validProviders = ['anthropic', 'openai'];
  if (!validProviders.includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  // Basic key format validation
  if (provider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
    return NextResponse.json({ error: 'Invalid Anthropic key format' }, { status: 400 });
  }
  if (provider === 'openai' && !apiKey.startsWith('sk-')) {
    return NextResponse.json({ error: 'Invalid OpenAI key format' }, { status: 400 });
  }

  const encKey = encryptApiKey(apiKey);
  const keyHint = '...' + apiKey.slice(-4);

  const key = await prisma.userLLMKey.upsert({
    where: { userId_provider: { userId: session.user.id, provider } },
    create: { userId: session.user.id, provider, encKey, keyHint },
    update: { encKey, keyHint },
    select: { id: true, provider: true, keyHint: true, updatedAt: true },
  });

  return NextResponse.json(key);
}

// DELETE — remove LLM key by provider
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');

  if (!provider) {
    return NextResponse.json({ error: 'provider query param required' }, { status: 400 });
  }

  await prisma.userLLMKey.deleteMany({
    where: { userId: session.user.id, provider },
  });

  return NextResponse.json({ ok: true });
}
