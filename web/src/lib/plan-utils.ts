export type BadgeVariant = 'default' | 'primary' | 'spiral' | 'warning';

export const PLAN_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  FREE: 'default',
  FREE_PLUS: 'default',
  PRO: 'primary',
  TEAM: 'spiral',
  ENTERPRISE: 'warning',
} as const;

export function getPlanBadgeVariant(plan: string): BadgeVariant {
  return PLAN_BADGE_VARIANTS[plan] || 'default';
}
