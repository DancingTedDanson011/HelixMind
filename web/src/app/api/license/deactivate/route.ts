import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireApiKeyWithPlan } from '@/lib/team-auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/license/deactivate', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    const authResult = await requireApiKeyWithPlan(req);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { licenseKey } = body;

    if (!licenseKey || typeof licenseKey !== 'string') {
      return NextResponse.json({ error: 'License key is required' }, { status: 400 });
    }

    const keyHash = createHash('sha256').update(licenseKey).digest('hex');

    const license = await prisma.license.findUnique({
      where: { keyHash },
    });

    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    // SECURITY: Verify the license belongs to the authenticated user's team
    // Reject teamless licenses — only team-bound licenses can be deactivated via API
    if (!license.teamId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const teamMember = await prisma.teamMember.findFirst({
      where: { userId: authResult.userId, teamId: license.teamId },
    });
    if (!teamMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (license.activations <= 0) {
      return NextResponse.json({ error: 'No active activations to deactivate' }, { status: 400 });
    }

    await prisma.license.update({
      where: { id: license.id },
      data: { activations: { decrement: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('License deactivation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
