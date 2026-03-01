import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BrainInstanceManager } from '../../../src/cli/brain/instance-manager.js';

describe('BrainInstanceManager', () => {
  let tmpDir: string;
  let manager: BrainInstanceManager;

  beforeEach(() => {
    tmpDir = join(process.env.TEMP || '/tmp', `brain-mgr-${randomUUID()}`);
    mkdirSync(tmpDir, { recursive: true });
    manager = new BrainInstanceManager(tmpDir);
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* EBUSY on Windows */ }
  });

  describe('register', () => {
    it('should register a new local brain', () => {
      const brain = manager.register({
        name: 'TestProject',
        type: 'local',
        path: '/home/user/project/.helixmind/spiral.db',
        projectPath: '/home/user/project',
      });

      expect(brain.id).toMatch(/^brain_/);
      expect(brain.name).toBe('TestProject');
      expect(brain.type).toBe('local');
      expect(brain.active).toBe(false);
      expect(brain.nodeCount).toBe(0);
    });

    it('should register a new global brain', () => {
      const brain = manager.register({
        name: 'Global Knowledge',
        type: 'global',
        path: '/home/user/.helixmind/spiral.db',
      });

      expect(brain.type).toBe('global');
      expect(brain.projectPath).toBeUndefined();
    });

    it('should persist to disk', () => {
      manager.register({
        name: 'Persisted',
        type: 'local',
        path: '/tmp/test/spiral.db',
      });

      // Create new manager from same dir — should load persisted data
      const manager2 = new BrainInstanceManager(tmpDir);
      const all = manager2.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('Persisted');
    });

    it('should generate unique IDs', () => {
      const b1 = manager.register({ name: 'A', type: 'local', path: '/a' });
      const b2 = manager.register({ name: 'B', type: 'local', path: '/b' });
      expect(b1.id).not.toBe(b2.id);
    });

    it('should not register duplicate paths', () => {
      manager.register({ name: 'A', type: 'local', path: '/same/path' });
      const b2 = manager.register({ name: 'B', type: 'local', path: '/same/path' });
      // Should return existing brain instead of creating duplicate
      expect(manager.getAll()).toHaveLength(1);
      expect(b2.name).toBe('A');
    });
  });

  describe('rename', () => {
    it('should rename a brain', () => {
      const brain = manager.register({ name: 'Old Name', type: 'local', path: '/test' });
      manager.rename(brain.id, 'New Name');

      const updated = manager.getAll().find(b => b.id === brain.id);
      expect(updated?.name).toBe('New Name');
    });

    it('should persist rename', () => {
      const brain = manager.register({ name: 'Old', type: 'local', path: '/test' });
      manager.rename(brain.id, 'New');

      const manager2 = new BrainInstanceManager(tmpDir);
      expect(manager2.getAll()[0].name).toBe('New');
    });

    it('should throw for unknown brain ID', () => {
      expect(() => manager.rename('brain_nonexistent', 'Name')).toThrow();
    });
  });

  describe('activate / deactivate', () => {
    it('should activate a brain', () => {
      const brain = manager.register({ name: 'Test', type: 'local', path: '/test' });
      expect(brain.active).toBe(false);

      const ok = manager.activate(brain.id);
      expect(ok).toBe(true);

      const updated = manager.getAll().find(b => b.id === brain.id);
      expect(updated?.active).toBe(true);
    });

    it('should deactivate a brain', () => {
      const brain = manager.register({ name: 'Test', type: 'local', path: '/test' });
      manager.activate(brain.id);
      manager.deactivate(brain.id);

      const updated = manager.getAll().find(b => b.id === brain.id);
      expect(updated?.active).toBe(false);
    });

    it('should respect maxActive limit', () => {
      manager.setLimits({ maxGlobal: 5, maxLocal: 5, maxActive: 2 });

      const b1 = manager.register({ name: 'A', type: 'local', path: '/a' });
      const b2 = manager.register({ name: 'B', type: 'local', path: '/b' });
      const b3 = manager.register({ name: 'C', type: 'local', path: '/c' });

      expect(manager.activate(b1.id)).toBe(true);
      expect(manager.activate(b2.id)).toBe(true);
      expect(manager.activate(b3.id)).toBe(false); // Limit reached
    });

    it('should respect maxGlobal limit', () => {
      manager.setLimits({ maxGlobal: 1, maxLocal: 5, maxActive: 10 });

      const g1 = manager.register({ name: 'G1', type: 'global', path: '/g1' });
      const g2 = manager.register({ name: 'G2', type: 'global', path: '/g2' });

      expect(manager.activate(g1.id)).toBe(true);
      expect(manager.activate(g2.id)).toBe(false); // Only 1 global allowed
    });

    it('should respect maxLocal limit', () => {
      manager.setLimits({ maxGlobal: 5, maxLocal: 2, maxActive: 10 });

      const l1 = manager.register({ name: 'L1', type: 'local', path: '/l1' });
      const l2 = manager.register({ name: 'L2', type: 'local', path: '/l2' });
      const l3 = manager.register({ name: 'L3', type: 'local', path: '/l3' });

      expect(manager.activate(l1.id)).toBe(true);
      expect(manager.activate(l2.id)).toBe(true);
      expect(manager.activate(l3.id)).toBe(false); // Only 2 local allowed
    });

    it('should allow activation after deactivating another', () => {
      manager.setLimits({ maxGlobal: 5, maxLocal: 2, maxActive: 2 });

      const b1 = manager.register({ name: 'A', type: 'local', path: '/a' });
      const b2 = manager.register({ name: 'B', type: 'local', path: '/b' });
      const b3 = manager.register({ name: 'C', type: 'local', path: '/c' });

      manager.activate(b1.id);
      manager.activate(b2.id);
      manager.deactivate(b1.id);
      expect(manager.activate(b3.id)).toBe(true);
    });
  });

  describe('limits', () => {
    it('should have default limits (unlimited)', () => {
      const limits = manager.getLimits();
      expect(limits.maxGlobal).toBe(Infinity);
      expect(limits.maxLocal).toBe(Infinity);
      expect(limits.maxActive).toBe(Infinity);
    });

    it('should set and get limits', () => {
      manager.setLimits({ maxGlobal: 1, maxLocal: 2, maxActive: 3 });
      const limits = manager.getLimits();
      expect(limits.maxGlobal).toBe(1);
      expect(limits.maxLocal).toBe(2);
      expect(limits.maxActive).toBe(3);
    });

    it('should persist limits', () => {
      manager.setLimits({ maxGlobal: 1, maxLocal: 2, maxActive: 3 });
      const manager2 = new BrainInstanceManager(tmpDir);
      const limits = manager2.getLimits();
      expect(limits.maxGlobal).toBe(1);
      expect(limits.maxLocal).toBe(2);
      expect(limits.maxActive).toBe(3);
    });

    it('should report isWithinLimits correctly', () => {
      manager.setLimits({ maxGlobal: 1, maxLocal: 1, maxActive: 2 });

      expect(manager.isWithinLimits()).toBe(true);

      const g1 = manager.register({ name: 'G', type: 'global', path: '/g' });
      manager.activate(g1.id);
      expect(manager.isWithinLimits()).toBe(true);

      const l1 = manager.register({ name: 'L', type: 'local', path: '/l' });
      manager.activate(l1.id);
      expect(manager.isWithinLimits()).toBe(true);

      // Register more than limit allows (but don't activate)
      manager.register({ name: 'G2', type: 'global', path: '/g2' });
      expect(manager.isWithinLimits()).toBe(true); // Not active, so fine
    });
  });

  describe('getAll', () => {
    it('should return empty array initially', () => {
      expect(manager.getAll()).toEqual([]);
    });

    it('should return all registered brains', () => {
      manager.register({ name: 'A', type: 'local', path: '/a' });
      manager.register({ name: 'B', type: 'global', path: '/b' });
      expect(manager.getAll()).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('should return a brain by ID', () => {
      const brain = manager.register({ name: 'Test', type: 'local', path: '/test' });
      const found = manager.getById(brain.id);
      expect(found?.name).toBe('Test');
    });

    it('should return null for unknown ID', () => {
      expect(manager.getById('brain_unknown')).toBeNull();
    });
  });

  describe('getByPath', () => {
    it('should find brain by path', () => {
      manager.register({ name: 'Test', type: 'local', path: '/home/user/.helixmind/spiral.db' });
      const found = manager.getByPath('/home/user/.helixmind/spiral.db');
      expect(found?.name).toBe('Test');
    });

    it('should return null for unknown path', () => {
      expect(manager.getByPath('/nonexistent')).toBeNull();
    });
  });

  describe('updateNodeCount', () => {
    it('should update the node count', () => {
      const brain = manager.register({ name: 'Test', type: 'local', path: '/test' });
      manager.updateNodeCount(brain.id, 1500);

      const updated = manager.getById(brain.id);
      expect(updated?.nodeCount).toBe(1500);
    });

    it('should update lastAccessedAt', () => {
      const brain = manager.register({ name: 'Test', type: 'local', path: '/test' });
      const before = brain.lastAccessedAt;

      // Small delay to ensure different timestamp
      manager.updateNodeCount(brain.id, 100);
      const updated = manager.getById(brain.id);
      expect(updated!.lastAccessedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('remove', () => {
    it('should remove a brain', () => {
      const brain = manager.register({ name: 'Test', type: 'local', path: '/test' });
      manager.remove(brain.id);
      expect(manager.getAll()).toHaveLength(0);
    });

    it('should persist removal', () => {
      const brain = manager.register({ name: 'Test', type: 'local', path: '/test' });
      manager.remove(brain.id);

      const manager2 = new BrainInstanceManager(tmpDir);
      expect(manager2.getAll()).toHaveLength(0);
    });
  });
});
