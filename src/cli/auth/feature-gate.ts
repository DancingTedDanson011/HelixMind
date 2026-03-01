/**
 * Feature gating based on subscription plan.
 * Checks whether a feature is available for the user's current plan.
 *
 * Plan hierarchy: FREE → FREE_PLUS → PRO → TEAM → ENTERPRISE
 *
 * FREE (no account):  Full CLI agent + spiral memory + 1 local brain per project.
 *                     No Jarvis, no validation, no monitor, no brain management.
 * FREE_PLUS (logged in): Jarvis (1 instance), validation basic, 1 global + 2 local brains.
 * PRO (19€/mo):      Jarvis (3), deep thinking, scheduling, triggers, full validation,
 *                     monitor, cloud sync, 5 global + 10 local brains.
 * TEAM (39€/user/mo): Unlimited Jarvis, parallel execution, shared brains, unlimited brains.
 * ENTERPRISE:         Full API, self-hosted, benchmark, SSO/SAML.
 */
import type { ConfigStore } from '../config/store.js';
import type { BrainLimits } from '../brain/instance-manager.js';

// ---------------------------------------------------------------------------
// Feature Type
// ---------------------------------------------------------------------------

export type Feature =
  // Jarvis AGI
  | 'jarvis'
  | 'jarvis_multi'
  | 'jarvis_unlimited'
  | 'jarvis_thinking_deep'
  | 'jarvis_scheduling'
  | 'jarvis_triggers'
  | 'jarvis_parallel'
  // Validation
  | 'validation_basic'
  | 'validation_full'
  // Security Monitor
  | 'monitor'
  // Cloud & Sync
  | 'cloud_sync'
  | 'brain_api'
  // Team
  | 'team_brain_sharing'
  | 'team_sessions'
  // Support
  | 'priority_support'
  // Enterprise
  | 'benchmark'
  | 'self_hosted'
  | 'sso_saml';

// Web enricher is FREE for all — it's the core intelligence of HelixMind.
// Agent loop, spiral memory, 22 tools, providers — all FREE (open source core).

// ---------------------------------------------------------------------------
// Plan Hierarchy
// ---------------------------------------------------------------------------

const PLAN_HIERARCHY: Record<string, number> = {
  FREE: 0,
  FREE_PLUS: 1,
  PRO: 2,
  TEAM: 3,
  ENTERPRISE: 4,
};

// ---------------------------------------------------------------------------
// Feature → Minimum Plan
// ---------------------------------------------------------------------------

const FEATURE_MIN_PLAN: Record<Feature, string> = {
  // Jarvis AGI
  jarvis: 'FREE_PLUS',
  jarvis_multi: 'PRO',
  jarvis_unlimited: 'TEAM',
  jarvis_thinking_deep: 'PRO',
  jarvis_scheduling: 'PRO',
  jarvis_triggers: 'PRO',
  jarvis_parallel: 'TEAM',
  // Validation
  validation_basic: 'FREE_PLUS',
  validation_full: 'PRO',
  // Security Monitor
  monitor: 'PRO',
  // Cloud & Sync
  cloud_sync: 'PRO',
  brain_api: 'ENTERPRISE',
  // Team
  team_brain_sharing: 'TEAM',
  team_sessions: 'TEAM',
  // Support
  priority_support: 'PRO',
  // Enterprise
  benchmark: 'ENTERPRISE',
  self_hosted: 'ENTERPRISE',
  sso_saml: 'ENTERPRISE',
};

// ---------------------------------------------------------------------------
// Brain Limits per Plan
// ---------------------------------------------------------------------------

const BRAIN_LIMITS: Record<string, BrainLimits | null> = {
  FREE: null, // No brain registry for FREE — just 1 local brain per project (default behavior)
  FREE_PLUS: { maxGlobal: 1, maxLocal: 2, maxActive: 3 },
  PRO: { maxGlobal: 5, maxLocal: 10, maxActive: 10 },
  TEAM: { maxGlobal: Infinity, maxLocal: Infinity, maxActive: Infinity },
  ENTERPRISE: { maxGlobal: Infinity, maxLocal: Infinity, maxActive: Infinity },
};

// ---------------------------------------------------------------------------
// Jarvis Instance Limits per Plan
// ---------------------------------------------------------------------------

const JARVIS_LIMITS: Record<string, number> = {
  FREE: 0,
  FREE_PLUS: 1,
  PRO: 3,
  TEAM: Infinity,
  ENTERPRISE: Infinity,
};

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

export function isFeatureAvailable(store: ConfigStore, feature: Feature): boolean {
  const plan = (store.get('relay.plan') as string | undefined) ?? 'FREE';
  const minPlan = FEATURE_MIN_PLAN[feature];
  return (PLAN_HIERARCHY[plan] ?? 0) >= (PLAN_HIERARCHY[minPlan] ?? 0);
}

export function requireFeature(store: ConfigStore, feature: Feature): void {
  if (!isFeatureAvailable(store, feature)) {
    const minPlan = FEATURE_MIN_PLAN[feature];
    throw new FeatureGateError(feature, minPlan);
  }
}

/**
 * Check if the user is logged in (FREE_PLUS or above).
 * Used for brain management, Jarvis access, etc.
 */
export function isLoggedIn(store: ConfigStore): boolean {
  const plan = (store.get('relay.plan') as string | undefined) ?? 'FREE';
  return (PLAN_HIERARCHY[plan] ?? 0) >= PLAN_HIERARCHY.FREE_PLUS;
}

/**
 * Get brain limits for a given plan.
 * Returns null for FREE (no brain registry active).
 */
export function getBrainLimitsForPlan(plan: string): BrainLimits | null {
  return BRAIN_LIMITS[plan] ?? null;
}

/**
 * Get Jarvis instance limit for a given plan.
 * Returns 0 for FREE (no Jarvis access).
 */
export function getJarvisLimitsForPlan(plan: string): number {
  return JARVIS_LIMITS[plan] ?? 0;
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class FeatureGateError extends Error {
  constructor(
    public readonly feature: Feature,
    public readonly requiredPlan: string,
  ) {
    super(
      `Feature "${feature}" requires ${requiredPlan} plan or higher. ` +
      'Run `helixmind login` to authenticate or upgrade at your dashboard.',
    );
    this.name = 'FeatureGateError';
  }
}

// ---------------------------------------------------------------------------
// Login CTAs
// ---------------------------------------------------------------------------

/** Get a login CTA message for the given context */
export function getLoginCTA(context: 'brain' | 'jarvis' | 'nudge' | 'banner'): string {
  switch (context) {
    case 'brain':
      return 'Brain Management requires login. Run `helixmind login` to unlock 3D visualization, Jarvis AGI, and more.';
    case 'jarvis':
      return 'Jarvis AGI requires login. Run `helixmind login` — it\'s free!';
    case 'nudge':
      return 'Unlock Jarvis AGI + Brain Management → `helixmind login` (free)';
    case 'banner':
      return 'Login for Jarvis AGI + Brain Management → helixmind login';
  }
}

// ---------------------------------------------------------------------------
// Plan Refresh
// ---------------------------------------------------------------------------

/**
 * Refresh plan info from the web platform.
 * Updates cached plan in config. Returns the plan string or null on failure.
 */
export async function refreshPlanInfo(store: ConfigStore): Promise<string | null> {
  const auth = store.getAuthInfo();
  if (!auth?.apiKey || !auth.url) return null;

  try {
    const url = auth.url.replace(/\/+$/, '');
    const res = await fetch(`${url}/api/auth/cli/verify`, {
      headers: { Authorization: `Bearer ${auth.apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Key might be revoked/expired
      if (res.status === 401) {
        store.set('relay.plan', 'FREE');
      }
      return null;
    }

    const data = (await res.json()) as {
      valid?: boolean;
      plan?: string;
      email?: string;
      userId?: string;
    };

    if (data.plan) {
      // Logged-in users are at least FREE_PLUS even if server returns FREE
      const plan = data.plan === 'FREE' ? 'FREE_PLUS' : data.plan;
      store.set('relay.plan', plan);
    }
    if (data.email) {
      store.set('relay.userEmail', data.email);
    }
    if (data.userId) {
      store.set('relay.userId', data.userId);
    }

    return data.plan ?? null;
  } catch {
    return null;
  }
}
