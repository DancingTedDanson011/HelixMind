import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildAuthnRequestUrl } from '@/lib/saml-provider';
import { checkRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

/**
 * POST /api/auth/sso/initiate — Public SSO login entry point.
 * Accepts a teamId, looks up the SAML config, and returns the IdP auth URL.
 * No authentication required (this IS the login flow).
 */
export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, 'sso-initiate', AUTH_RATE_LIMIT);
  if (limited) return limited;

  let body: { teamId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const teamId = body.teamId?.trim();
  if (!teamId) {
    return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
  }

  // Validate teamId format (cuid or uuid)
  if (teamId.length > 40 || /[^a-zA-Z0-9_-]/.test(teamId)) {
    return NextResponse.json({ error: 'Invalid team ID format' }, { status: 400 });
  }

  // Check team exists and has SAML configured
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true },
  });

  if (!team) {
    // Don't leak whether team exists — generic error
    return NextResponse.json({ error: 'SSO is not available for this team' }, { status: 404 });
  }

  const samlConfig = await prisma.samlConfig.findUnique({
    where: { teamId },
    select: { id: true },
  });

  if (!samlConfig) {
    return NextResponse.json({ error: 'SSO is not configured for this team' }, { status: 404 });
  }

  // Build the SAML AuthnRequest URL
  const authUrl = await buildAuthnRequestUrl(teamId);
  if (!authUrl) {
    return NextResponse.json({ error: 'Failed to generate SSO login URL' }, { status: 500 });
  }

  return NextResponse.json({ authUrl });
}
