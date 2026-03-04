import NextAuth from 'next-auth';
import type { Provider } from '@auth/core/providers';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Only use PrismaAdapter when DATABASE_URL is configured
const hasDatabase = !!process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('placeholder');

const providers: Provider[] = [
  Credentials({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;

      // Dev-mode fallback: test users when DB is not available (passwords from env vars only)
      // SECURITY: Requires BOTH NODE_ENV=development AND explicit opt-in via ALLOW_DEV_USERS=true
      const devUsersEnabled = process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_USERS === 'true';
      const devUsers = devUsersEnabled ? [
        { id: 'dev-admin', email: process.env.DEV_ADMIN_EMAIL || 'admin@helixmind.dev', passwordHash: process.env.DEV_ADMIN_PASSWORD_HASH || '', name: 'Admin', role: 'ADMIN' },
        { id: 'dev-support', email: process.env.DEV_SUPPORT_EMAIL || 'support@helixmind.dev', passwordHash: process.env.DEV_SUPPORT_PASSWORD_HASH || '', name: 'Support', role: 'SUPPORT' },
        { id: 'dev-user', email: process.env.DEV_USER_EMAIL || 'user@helixmind.dev', passwordHash: process.env.DEV_USER_PASSWORD_HASH || '', name: 'Test User', role: 'USER' },
      ].filter(u => u.passwordHash.length >= 10) : [];

      // Try database first
      try {
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (user?.passwordHash) {
          const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
          if (isValid) {
            return { id: user.id, email: user.email, name: user.name, image: user.image };
          }
        }
      } catch {
        // DB not available — fall through to dev users
      }

      // Dev fallback (only in development + explicit opt-in, using bcrypt not plaintext)
      if (devUsersEnabled) {
        for (const devUser of devUsers) {
          if (devUser.email === parsed.data.email) {
            const isValid = await bcrypt.compare(parsed.data.password, devUser.passwordHash);
            if (isValid) {
              return { id: devUser.id, email: devUser.email, name: devUser.name, image: null };
            }
          }
        }
      }

      return null;
    },
  }),
];

// Only add OAuth providers when credentials are configured
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(GitHub({
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }));
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: hasDatabase ? PrismaAdapter(prisma) : undefined,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/login',
    newUser: '/app',
    error: '/auth/login',
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;

        // Admin auto-promotion from env var (takes effect immediately on login)
        const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

        // Dev-mode role mapping
        const devRoles: Record<string, string> = {
          'dev-admin': 'ADMIN',
          'dev-support': 'SUPPORT',
          'dev-user': 'USER',
        };

        if (adminEmails.includes(user.email!)) {
          token.role = 'ADMIN';
          token.locale = 'en';
          // SECURITY: Do NOT persist admin role to DB — env-based admin status must remain
          // revocable by removing the email from ADMIN_EMAILS. Persisting to DB would
          // grant permanent admin even after the env var is updated.
        } else if (devRoles[user.id!]) {
          token.role = devRoles[user.id!];
          token.locale = 'en';
        } else {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id! },
              select: { role: true, locale: true },
            });
            if (dbUser) {
              token.role = dbUser.role;
              token.locale = dbUser.locale;
            }
          } catch {
            token.role = 'USER';
            token.locale = 'en';
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || 'USER';
        session.user.locale = (token.locale as string) || 'en';
      }
      return session;
    },
  },
});

/**
 * Helper: require auth + specific role(s).
 * Returns session or null (caller should return 401/403).
 */
export async function requireRole(...roles: string[]) {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (roles.length > 0 && !roles.includes(session.user.role)) return null;
  return session;
}
