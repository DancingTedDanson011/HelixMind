import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { validateAssertion } from '@/lib/saml-provider';
import { checkRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, 'saml-callback', AUTH_RATE_LIMIT);
  if (limited) return limited;

  try {
    const formData = await req.formData();
    const samlResponse = formData.get('SAMLResponse') as string | null;
    const relayState = formData.get('RelayState') as string | null;

    if (!samlResponse || !relayState) {
      return NextResponse.redirect(new URL('/auth/login?error=saml_missing_params', req.url));
    }

    // H6: Validate RelayState is a valid UUID (teamId) to prevent injection/tampering
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(relayState)) {
      return NextResponse.redirect(new URL('/auth/login?error=saml_invalid_state', req.url));
    }

    const teamId = relayState;

    // Verify team exists before processing SAML assertion
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) {
      return NextResponse.redirect(new URL('/auth/login?error=saml_invalid_team', req.url));
    }

    // SECURITY: Check SAML configuration before processing assertion
    const samlConfig = await prisma.samlConfig.findUnique({ where: { teamId } });
    if (!samlConfig) {
      return NextResponse.redirect(new URL('/auth/login?error=saml_not_configured', req.url));
    }

    // Validate the SAML assertion
    const profile = await validateAssertion(teamId, samlResponse);
    if (!profile) {
      return NextResponse.redirect(new URL('/auth/login?error=saml_validation_failed', req.url));
    }

    // SECURITY: Enforce email domain restriction if configured
    if (samlConfig.allowedDomains && (samlConfig.allowedDomains as string[]).length > 0) {
      const emailDomain = profile.email.split('@')[1]?.toLowerCase();
      if (!emailDomain || !(samlConfig.allowedDomains as string[]).includes(emailDomain)) {
        return NextResponse.redirect(new URL('/auth/login?error=saml_domain_not_allowed', req.url));
      }
    }

    // JIT provisioning: find or create user by email
    let user = await prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true, email: true, name: true, role: true, locale: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name || profile.email.split('@')[0],
          emailVerified: new Date(),
        },
        select: { id: true, email: true, name: true, role: true, locale: true },
      });
    }

    // Find or create TeamMember entry
    const existingMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });

    if (!existingMember) {
      // SECURITY: JIT-provisioned users always start as MEMBER.
      // IdP-controlled role attributes are not trusted for privilege assignment.
      // Team admins must manually promote users via the team management UI.
      await prisma.teamMember.create({
        data: { teamId, userId: user.id, role: 'MEMBER' },
      });
    }

    // Create JWT session token
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('FATAL: AUTH_SECRET or NEXTAUTH_SECRET must be set for SAML JWT signing');
      return NextResponse.redirect(new URL('/auth/login?error=saml_config', req.url));
    }

    // Use the correct salt matching the cookie name (NextAuth convention)
    const isSecure = req.url.startsWith('https');
    const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';

    const token = await encode({
      token: {
        id: user.id,
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        locale: user.locale,
      },
      secret,
      salt: cookieName,
    });

    // Set session cookie and redirect to app

    const response = NextResponse.redirect(new URL('/app', req.url));
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err) {
    console.error('[SAML Callback] Error:', err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(new URL('/auth/login?error=saml_error', req.url));
  }
}
