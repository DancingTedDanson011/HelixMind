/**
 * Feature gating based on subscription plan.
 * Checks whether a feature is available for the user's current plan.
 */
import type { ConfigStore } from '../config/store.js';

export type Feature =
  | 'web_enricher'
  | 'cloud_sync'
  | 'team_sessions'
  | 'advanced_spiral'
  | 'priority_support';

const PLAN_HIERARCHY: Record<string, number> = {
  FREE: 0,
  PRO: 1,
  TEAM: 2,
  ENTERPRISE: 3,
};

const FEATURE_MIN_PLAN: Record<Feature, string> = {
  web_enricher: 'PRO',
  cloud_sync: 'PRO',
  advanced_spiral: 'PRO',
  team_sessions: 'TEAM',
  priority_support: 'PRO',
};

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
      store.set('relay.plan', data.plan);
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
