/**
 * Relay authentication helpers — shared between server.ts and API routes.
 * Validates CLI API keys and browser session cookies for the WebSocket relay.
 */
import { createHash } from 'crypto';
import { prisma } from './prisma';

/**
 * Validate a CLI API key (hm_xxx format).
 * Looks up the SHA256 hash in the database and checks scopes + expiry.
 */
export async function validateApiKey(
  key: string,
): Promise<{ userId: string } | null> {
  if (!key || !key.startsWith('hm_')) return null;

  try {
    const keyHash = createHash('sha256').update(key).digest('hex');
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        userId: true,
        scopes: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (!apiKey) return null;
    if (apiKey.revokedAt) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
    if (!apiKey.scopes.includes('relay') && !apiKey.scopes.includes('read')) return null;

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { keyHash },
      data: { lastUsed: new Date() },
    }).catch(() => {});

    return { userId: apiKey.userId };
  } catch {
    return null;
  }
}

/**
 * Validate a NextAuth session cookie.
 * Decodes the JWT token from the session cookie.
 */
export async function validateSessionCookie(
  cookieHeader: string | undefined,
): Promise<{ userId: string } | null> {
  if (!cookieHeader) return null;

  try {
    // Parse session token from cookies
    const cookies = parseCookies(cookieHeader);
    const sessionToken =
      cookies['__Secure-authjs.session-token'] ??
      cookies['authjs.session-token'] ??
      cookies['next-auth.session-token'];

    if (!sessionToken) return null;

    // Decode JWT using NextAuth's secret
    const { decode } = await import('next-auth/jwt');
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) return null;

    const token = await decode({ token: sessionToken, secret, salt: '' });
    if (!token?.sub) return null;

    return { userId: token.sub };
  } catch {
    return null;
  }
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name) cookies[name] = rest.join('=');
  }
  return cookies;
}
