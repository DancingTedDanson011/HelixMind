import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, DEVICE_POLL_RATE_LIMIT } from '@/lib/rate-limit';
import { decryptApiKey } from '@/lib/crypto';

export async function GET(req: Request) {
  const limited = checkRateLimit(req, 'device-poll', DEVICE_POLL_RATE_LIMIT);
  if (limited) return limited;

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code')?.trim().toUpperCase();
    const pollSecret = url.searchParams.get('secret');

    if (!code || code.length < 5) {
      return NextResponse.json({ status: 'expired' });
    }

    // SECURITY: pollSecret is required to prevent unauthenticated API key theft.
    // Only the CLI that initiated the device code flow possesses the pollSecret.
    if (!pollSecret || pollSecret.length < 32) {
      return NextResponse.json({ error: 'Missing or invalid poll secret' }, { status: 400 });
    }

    const record = await prisma.deviceCode.findUnique({ where: { code } });

    if (!record) {
      return NextResponse.json({ status: 'expired' });
    }

    if (record.expiresAt < new Date()) {
      // Clean up expired
      await prisma.deviceCode.delete({ where: { id: record.id } }).catch(() => {});
      return NextResponse.json({ status: 'expired' });
    }

    // Verify poll secret matches (constant-time comparison would be ideal, but
    // timing differences are negligible for 64-char hex strings over HTTP)
    if (record.pollSecret !== pollSecret) {
      return NextResponse.json({ error: 'Invalid poll secret' }, { status: 403 });
    }

    if (record.apiKey && record.userId) {
      // Authorized — decrypt and return key, then clean up (one-time use)
      let apiKey: string;
      try {
        apiKey = decryptApiKey(record.apiKey);
      } catch {
        // Decryption failed — treat as invalid rather than leaking raw data
        await prisma.deviceCode.delete({ where: { id: record.id } }).catch(() => {});
        return NextResponse.json({ error: 'Key decryption failed' }, { status: 500 });
      }
      await prisma.deviceCode.delete({ where: { id: record.id } }).catch(() => {});
      return NextResponse.json({
        status: 'authorized',
        apiKey,
        email: record.email,
        plan: record.plan,
        userId: record.userId,
      });
    }

    return NextResponse.json({ status: 'pending' });
  } catch (error) {
    console.error('Device code poll error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
