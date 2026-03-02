import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code')?.trim().toUpperCase();

    if (!code || code.length < 5) {
      return NextResponse.json({ status: 'expired' });
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

    if (record.apiKey && record.userId) {
      // Authorized — return key and clean up (one-time use)
      await prisma.deviceCode.delete({ where: { id: record.id } }).catch(() => {});
      return NextResponse.json({
        status: 'authorized',
        apiKey: record.apiKey,
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
