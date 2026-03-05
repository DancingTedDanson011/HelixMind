import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/crypto';
import { checkRateLimit, AI_RATE_LIMIT } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ELEVENLABS_API = 'https://api.elevenlabs.io';

/** Resolve the user's ElevenLabs API key from UserLLMKey table */
async function getElevenLabsKey(userId: string): Promise<string | null> {
  const keyRecord = await prisma.userLLMKey.findUnique({
    where: { userId_provider: { userId, provider: 'elevenlabs' } },
  });
  if (!keyRecord) return null;
  try {
    return decryptApiKey(keyRecord.encKey);
  } catch {
    return null;
  }
}

/** Check that user has at least PRO plan for voice cloning */
async function hasVoiceCloneAccess(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });
  if (!subscription) return false;
  const allowedPlans = ['PRO', 'TEAM', 'ENTERPRISE'];
  const activeStatuses = ['ACTIVE', 'TRIALING'];
  return allowedPlans.includes(subscription.plan) && activeStatuses.includes(subscription.status);
}

// POST /api/voice/clone — upload audio to create a voice clone
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const limited = checkRateLimit(req, 'voice/clone', {
    ...AI_RATE_LIMIT,
    identifier: () => session.user!.id,
  });
  if (limited) return limited;

  // Check plan eligibility
  const hasAccess = await hasVoiceCloneAccess(session.user.id);
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Voice cloning requires a Pro plan or higher' },
      { status: 403 }
    );
  }

  // Get ElevenLabs API key
  const elevenLabsKey = await getElevenLabsKey(session.user.id);
  if (!elevenLabsKey) {
    return NextResponse.json(
      { error: 'No ElevenLabs API key configured' },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response('Invalid form data', { status: 400 });
  }

  const audio = formData.get('audio') as File | null;
  const name = formData.get('name') as string | null;

  if (!audio || !name?.trim()) {
    return NextResponse.json(
      { error: 'audio file and name are required' },
      { status: 400 }
    );
  }

  // Forward to ElevenLabs /v1/voices/add
  const elevenLabsForm = new FormData();
  elevenLabsForm.append('name', name.trim());
  elevenLabsForm.append('files', audio);

  let voiceId: string;
  try {
    const response = await fetch(`${ELEVENLABS_API}/v1/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': elevenLabsKey },
      body: elevenLabsForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs voice clone error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to create voice clone', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json() as { voice_id: string };
    voiceId = result.voice_id;
  } catch (error) {
    console.error('ElevenLabs API call failed:', error);
    return NextResponse.json({ error: 'Failed to reach ElevenLabs API' }, { status: 502 });
  }

  // Store in Prisma
  const clone = await prisma.userVoiceClone.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      voiceId,
      provider: 'elevenlabs',
    },
  });

  return NextResponse.json({ voiceId: clone.voiceId, name: clone.name }, { status: 201 });
}

// GET /api/voice/clone — list user's voice clones
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const limited = checkRateLimit(req, 'voice/clone', AI_RATE_LIMIT);
  if (limited) return limited;

  const clones = await prisma.userVoiceClone.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ clones });
}

// DELETE /api/voice/clone — remove a voice clone
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const limited = checkRateLimit(req, 'voice/clone', AI_RATE_LIMIT);
  if (limited) return limited;

  let body: { voiceId: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { voiceId } = body;
  if (!voiceId) {
    return NextResponse.json({ error: 'voiceId is required' }, { status: 400 });
  }

  // Verify ownership
  const clone = await prisma.userVoiceClone.findFirst({
    where: { voiceId, userId: session.user.id },
  });
  if (!clone) {
    return NextResponse.json({ error: 'Voice clone not found' }, { status: 404 });
  }

  // Get ElevenLabs key
  const elevenLabsKey = await getElevenLabsKey(session.user.id);

  // Delete from ElevenLabs (best-effort — don't fail if API key is missing)
  if (elevenLabsKey) {
    try {
      const response = await fetch(`${ELEVENLABS_API}/v1/voices/${voiceId}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': elevenLabsKey },
      });
      if (!response.ok) {
        console.warn('ElevenLabs delete voice failed:', response.status);
      }
    } catch (error) {
      console.warn('ElevenLabs delete API call failed:', error);
    }
  }

  // Delete from Prisma regardless
  await prisma.userVoiceClone.delete({ where: { id: clone.id } });

  return NextResponse.json({ success: true });
}
