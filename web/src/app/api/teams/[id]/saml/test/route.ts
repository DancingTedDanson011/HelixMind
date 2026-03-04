import { NextRequest, NextResponse } from 'next/server';
import { requireTeamRole, requireEnterprisePlan } from '@/lib/team-auth';
import { buildAuthnRequestUrl, getSamlInstance } from '@/lib/saml-provider';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

// POST — test SAML config by verifying it exists and building an auth request URL
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/saml/test', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;
  const { id: teamId } = await params;

  const teamAuth = await requireTeamRole(teamId, 'OWNER', 'ADMIN');
  if (!teamAuth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isEnterprise = await requireEnterprisePlan(teamAuth.member.userId);
  if (!isEnterprise) {
    return NextResponse.json({ error: 'Enterprise plan required' }, { status: 403 });
  }

  // Check config exists
  const instance = await getSamlInstance(teamId);
  if (!instance) {
    return NextResponse.json({
      success: false,
      error: 'No SAML configuration found for this team',
    });
  }

  // Try to build authn request URL
  try {
    const authUrl = await buildAuthnRequestUrl(teamId);
    if (!authUrl) {
      return NextResponse.json({
        success: false,
        error: 'Failed to generate authentication URL',
      });
    }

    return NextResponse.json({ success: true, authUrl });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error building auth URL',
    });
  }
}
