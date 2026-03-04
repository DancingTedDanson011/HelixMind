import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/license/validate', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const { licenseKey } = body;

    if (!licenseKey || typeof licenseKey !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'License key is required' },
        { status: 400 },
      );
    }

    const keyHash = createHash('sha256').update(licenseKey).digest('hex');

    const license = await prisma.license.findUnique({
      where: { keyHash },
      include: { team: { select: { id: true, name: true } } },
    });

    if (!license) {
      return NextResponse.json(
        { valid: false, error: 'Invalid license key' },
        { status: 404 },
      );
    }

    if (license.expiresAt < new Date()) {
      return NextResponse.json(
        { valid: false, error: 'License has expired' },
        { status: 403 },
      );
    }

    if (license.activations >= license.maxActivations) {
      return NextResponse.json(
        { valid: false, error: 'Maximum activations reached' },
        { status: 403 },
      );
    }

    // Increment activations, set activatedAt on first use
    await prisma.license.update({
      where: { id: license.id },
      data: {
        activations: { increment: 1 },
        ...(license.activatedAt ? {} : { activatedAt: new Date() }),
      },
    });

    return NextResponse.json({
      valid: true,
      plan: license.plan,
      seats: license.seats,
      features: license.features,
      expiresAt: license.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('License validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
