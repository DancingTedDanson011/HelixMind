/**
 * Plan Check — Validates whether a user can start/use Jarvis features
 * based on their subscription plan.
 */
import { JARVIS_PLAN_LIMITS, type JarvisPlanLimits } from './types';

export interface PlanCheckResult {
  allowed: boolean;
  reason?: string;
  limits: JarvisPlanLimits;
}

/**
 * Check if a user can start a new Jarvis instance.
 * @param plan - The user's subscription plan
 * @param currentInstances - Number of currently running instances
 */
export function canStartJarvis(plan: string, currentInstances: number): PlanCheckResult {
  const limits = JARVIS_PLAN_LIMITS[plan] ?? JARVIS_PLAN_LIMITS.FREE;

  if (limits.maxInstances === 0) {
    return {
      allowed: false,
      reason: 'Jarvis AGI requires a HelixMind account. Run `helixmind login` to get started — it\'s free!',
      limits,
    };
  }

  if (currentInstances >= limits.maxInstances) {
    return {
      allowed: false,
      reason: `You have reached the maximum number of Jarvis instances (${limits.maxInstances}) for your ${plan} plan. Upgrade for more.`,
      limits,
    };
  }

  return { allowed: true, limits };
}

/**
 * Check if a user can use deep thinking.
 */
export function canUseDeepThinking(plan: string): boolean {
  const limits = JARVIS_PLAN_LIMITS[plan] ?? JARVIS_PLAN_LIMITS.FREE;
  return limits.deepThinking;
}

/**
 * Check if a user can use scheduling.
 */
export function canUseScheduling(plan: string): boolean {
  const limits = JARVIS_PLAN_LIMITS[plan] ?? JARVIS_PLAN_LIMITS.FREE;
  return limits.scheduling;
}

/**
 * Check if a user can use triggers.
 */
export function canUseTriggers(plan: string): boolean {
  const limits = JARVIS_PLAN_LIMITS[plan] ?? JARVIS_PLAN_LIMITS.FREE;
  return limits.triggers;
}

/**
 * Check if a user can use parallel execution.
 */
export function canUseParallel(plan: string): boolean {
  const limits = JARVIS_PLAN_LIMITS[plan] ?? JARVIS_PLAN_LIMITS.FREE;
  return limits.parallel;
}
