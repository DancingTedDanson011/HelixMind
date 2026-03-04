import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { validateAssertion } from '@/lib/saml-provider';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const samlResponse = formData.get('SAMLResponse') as string | null;
    const relayState = formData.get('RelayState') as string | null;

    if (!samlResponse || !relayState) {
      return NextResponse.redirect(new URL('/auth/login?error=saml_missing_params', req.url));
    }

    const teamId = relayState;

    // Validate the SAML assertion
    const profile = await validateAssertion(teamId, samlResponse);
    if (!profile) {
      return NextResponse.redirect(new URL('/auth/login?error=saml_validation_failed', req.url));
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
      // Map SAML role to TeamRole (default to MEMBER)
      let teamRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER';
      if (profile.role) {
        const roleLower = profile.role.toLowerCase();
        if (roleLower === 'admin') teamRole = 'ADMIN';
        else if (roleLower === 'viewer' || roleLower === 'readonly') teamRole = 'VIEWER';
      }

      await prisma.teamMember.create({
        data: { teamId, userId: user.id, role: teamRole },
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
  } catch {
    return NextResponse.redirect(new URL('/auth/login?error=saml_error', req.url));
  }
}
