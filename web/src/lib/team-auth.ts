/**
 * Team RBAC helper — validates team membership and role requirements.
 */
import { auth } from './auth';
import { prisma } from './prisma';
import type { TeamRole } from '@prisma/client';

export interface TeamAuthResult {
  session: { user: { id: string; email?: string | null; name?: string | null; role: string; locale: string } };
  member: {
    id: string;
    teamId: string;
    userId: string;
    role: TeamRole;
  };
}

/**
 * Require authenticated user with specific team role(s).
 * Returns null if not authenticated or insufficient permissions.
 */
export async function requireTeamRole(
  teamId: string,
  ...roles: TeamRole[]
): Promise<TeamAuthResult | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } },
    select: { id: true, teamId: true, userId: true, role: true },
  });

  if (!member) return null;
  if (roles.length > 0 && !roles.includes(member.role)) return null;

  return { session, member };
}

/**
 * Check if user has a plan that allows team features.
 */
export async function requireTeamPlan(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });
  if (!sub || sub.status !== 'ACTIVE') return false;
  return sub.plan === 'TEAM' || sub.plan === 'ENTERPRISE';
}

/**
 * Check if user has Enterprise plan.
 */
export async function requireEnterprisePlan(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });
  if (!sub || sub.status !== 'ACTIVE') return false;
  return sub.plan === 'ENTERPRISE';
}

/**
 * Validate API key and check enterprise plan.
 */
export async function requireApiKeyWithPlan(
  req: Request,
  ...allowedPlans: string[]
): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('authorization');
  const apiKey = authHeader?.replace(/^Bearer\s+/i, '');
  if (!apiKey) return null;

  const { validateApiKey } = await import('./relay-auth');
  const result = await validateApiKey(apiKey);
  if (!result) return null;

  if (allowedPlans.length > 0) {
    const sub = await prisma.subscription.findUnique({
      where: { userId: result.userId },
      select: { plan: true, status: true },
    });
    if (!sub || sub.status !== 'ACTIVE') return null;
    if (!allowedPlans.includes(sub.plan)) return null;
  }

  return result;
}
