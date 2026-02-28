import NextAuth from 'next-auth';
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

const providers = [
  Credentials({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;

      // Dev-mode fallback: hardcoded users when DB is not available
      const devUsers = [
        { id: 'dev-admin', email: 'admin@helixmind.dev', password: 'HelixAdmin2024!', name: 'Admin', role: 'ADMIN' },
        { id: 'dev-support', email: 'support@helixmind.dev', password: 'HelixSupport2024!', name: 'Support', role: 'SUPPORT' },
        { id: 'dev-user', email: 'user@helixmind.dev', password: 'HelixUser2024!', name: 'Test User', role: 'USER' },
      ];

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

      // Dev fallback (only in development)
      if (process.env.NODE_ENV !== 'production') {
        const devUser = devUsers.find(
          (u) => u.email === parsed.data.email && u.password === parsed.data.password,
        );
        if (devUser) {
          return { id: devUser.id, email: devUser.email, name: devUser.name, image: null };
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
  }) as any);
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }) as any);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: hasDatabase ? PrismaAdapter(prisma) : undefined,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/login',
    newUser: '/dashboard',
    error: '/auth/login',
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;

        // Hardcoded admin promotions (takes effect immediately on login)
        const adminEmails = ['xinicetm@gmail.com'];

        // Dev-mode role mapping
        const devRoles: Record<string, string> = {
          'dev-admin': 'ADMIN',
          'dev-support': 'SUPPORT',
          'dev-user': 'USER',
        };

        if (adminEmails.includes(user.email!)) {
          token.role = 'ADMIN';
          token.locale = 'en';
          // Also update DB role if possible
          try {
            await prisma.user.update({ where: { id: user.id! }, data: { role: 'ADMIN' } });
          } catch { /* DB might not be available */ }
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
