import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ConfigStore } from '../../../src/cli/config/store.js';
import {
  isFeatureAvailable,
  requireFeature,
  isLoggedIn,
  getBrainLimitsForPlan,
  getJarvisLimitsForPlan,
  FeatureGateError,
  type Feature,
} from '../../../src/cli/auth/feature-gate.js';

describe('FeatureGate', () => {
  let tmpDir: string;
  let store: ConfigStore;

  beforeEach(() => {
    tmpDir = join(process.env.TEMP || '/tmp', `fg-test-${randomUUID()}`);
    mkdirSync(tmpDir, { recursive: true });
    store = new ConfigStore(tmpDir);
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* Windows EBUSY */ }
  });

  describe('plan hierarchy', () => {
    it('should treat missing plan as FREE', () => {
      expect(isFeatureAvailable(store, 'jarvis')).toBe(false);
    });

    it('should grant FREE features to all plans', () => {
      // Agent loop, spiral memory, etc. are always available (not gated)
      // cloud_sync requires PRO
      expect(isFeatureAvailable(store, 'cloud_sync')).toBe(false);
    });

    it('should grant FREE_PLUS features when logged in', () => {
      store.set('relay.plan', 'FREE_PLUS');
      expect(isFeatureAvailable(store, 'jarvis')).toBe(true);
      expect(isFeatureAvailable(store, 'validation_basic')).toBe(true);
    });

    it('should deny PRO features to FREE_PLUS', () => {
      store.set('relay.plan', 'FREE_PLUS');
      expect(isFeatureAvailable(store, 'jarvis_multi')).toBe(false);
      expect(isFeatureAvailable(store, 'monitor')).toBe(false);
      expect(isFeatureAvailable(store, 'cloud_sync')).toBe(false);
    });

    it('should grant PRO features to PRO plan', () => {
      store.set('relay.plan', 'PRO');
      expect(isFeatureAvailable(store, 'jarvis')).toBe(true);
      expect(isFeatureAvailable(store, 'jarvis_multi')).toBe(true);
      expect(isFeatureAvailable(store, 'jarvis_thinking_deep')).toBe(true);
      expect(isFeatureAvailable(store, 'jarvis_scheduling')).toBe(true);
      expect(isFeatureAvailable(store, 'jarvis_triggers')).toBe(true);
      expect(isFeatureAvailable(store, 'validation_full')).toBe(true);
      expect(isFeatureAvailable(store, 'monitor')).toBe(true);
      expect(isFeatureAvailable(store, 'cloud_sync')).toBe(true);
    });

    it('should deny TEAM features to PRO', () => {
      store.set('relay.plan', 'PRO');
      expect(isFeatureAvailable(store, 'jarvis_unlimited')).toBe(false);
      expect(isFeatureAvailable(store, 'jarvis_parallel')).toBe(false);
      expect(isFeatureAvailable(store, 'team_brain_sharing')).toBe(false);
    });

    it('should grant TEAM features to TEAM plan', () => {
      store.set('relay.plan', 'TEAM');
      expect(isFeatureAvailable(store, 'jarvis_unlimited')).toBe(true);
      expect(isFeatureAvailable(store, 'jarvis_parallel')).toBe(true);
      expect(isFeatureAvailable(store, 'team_brain_sharing')).toBe(true);
      expect(isFeatureAvailable(store, 'team_sessions')).toBe(true);
    });

    it('should grant ENTERPRISE features to ENTERPRISE plan', () => {
      store.set('relay.plan', 'ENTERPRISE');
      expect(isFeatureAvailable(store, 'brain_api')).toBe(true);
      expect(isFeatureAvailable(store, 'benchmark')).toBe(true);
      expect(isFeatureAvailable(store, 'self_hosted')).toBe(true);
      expect(isFeatureAvailable(store, 'sso_saml')).toBe(true);
    });

    it('should grant all lower-tier features to higher tiers', () => {
      store.set('relay.plan', 'ENTERPRISE');
      // Should have everything
      expect(isFeatureAvailable(store, 'jarvis')).toBe(true);
      expect(isFeatureAvailable(store, 'jarvis_multi')).toBe(true);
      expect(isFeatureAvailable(store, 'jarvis_unlimited')).toBe(true);
      expect(isFeatureAvailable(store, 'cloud_sync')).toBe(true);
      expect(isFeatureAvailable(store, 'team_sessions')).toBe(true);
    });
  });

  describe('requireFeature', () => {
    it('should throw FeatureGateError for unavailable features', () => {
      expect(() => requireFeature(store, 'jarvis')).toThrow(FeatureGateError);
    });

    it('should not throw for available features', () => {
      store.set('relay.plan', 'FREE_PLUS');
      expect(() => requireFeature(store, 'jarvis')).not.toThrow();
    });

    it('should include plan name in error message', () => {
      try {
        requireFeature(store, 'jarvis');
      } catch (e) {
        expect(e).toBeInstanceOf(FeatureGateError);
        expect((e as FeatureGateError).requiredPlan).toBe('FREE_PLUS');
      }
    });
  });

  describe('isLoggedIn', () => {
    it('should return false when no plan set', () => {
      expect(isLoggedIn(store)).toBe(false);
    });

    it('should return false for FREE plan', () => {
      store.set('relay.plan', 'FREE');
      expect(isLoggedIn(store)).toBe(false);
    });

    it('should return true for FREE_PLUS', () => {
      store.set('relay.plan', 'FREE_PLUS');
      expect(isLoggedIn(store)).toBe(true);
    });

    it('should return true for PRO', () => {
      store.set('relay.plan', 'PRO');
      expect(isLoggedIn(store)).toBe(true);
    });
  });

  describe('getBrainLimitsForPlan', () => {
    it('should return unlimited for FREE (no account, no registry)', () => {
      const limits = getBrainLimitsForPlan('FREE');
      expect(limits).toBeNull(); // No limits for FREE — no registry
    });

    it('should return 1/2/3 for FREE_PLUS', () => {
      const limits = getBrainLimitsForPlan('FREE_PLUS');
      expect(limits).not.toBeNull();
      expect(limits!.maxGlobal).toBe(1);
      expect(limits!.maxLocal).toBe(2);
      expect(limits!.maxActive).toBe(3);
    });

    it('should return 5/10/10 for PRO', () => {
      const limits = getBrainLimitsForPlan('PRO');
      expect(limits!.maxGlobal).toBe(5);
      expect(limits!.maxLocal).toBe(10);
      expect(limits!.maxActive).toBe(10);
    });

    it('should return unlimited for TEAM', () => {
      const limits = getBrainLimitsForPlan('TEAM');
      expect(limits!.maxGlobal).toBe(Infinity);
      expect(limits!.maxLocal).toBe(Infinity);
      expect(limits!.maxActive).toBe(Infinity);
    });

    it('should return unlimited for ENTERPRISE', () => {
      const limits = getBrainLimitsForPlan('ENTERPRISE');
      expect(limits!.maxGlobal).toBe(Infinity);
      expect(limits!.maxLocal).toBe(Infinity);
      expect(limits!.maxActive).toBe(Infinity);
    });
  });

  describe('getJarvisLimitsForPlan', () => {
    it('should return 0 for FREE', () => {
      expect(getJarvisLimitsForPlan('FREE')).toBe(0);
    });

    it('should return 1 for FREE_PLUS', () => {
      expect(getJarvisLimitsForPlan('FREE_PLUS')).toBe(1);
    });

    it('should return 3 for PRO', () => {
      expect(getJarvisLimitsForPlan('PRO')).toBe(3);
    });

    it('should return Infinity for TEAM', () => {
      expect(getJarvisLimitsForPlan('TEAM')).toBe(Infinity);
    });

    it('should return Infinity for ENTERPRISE', () => {
      expect(getJarvisLimitsForPlan('ENTERPRISE')).toBe(Infinity);
    });
  });
});
