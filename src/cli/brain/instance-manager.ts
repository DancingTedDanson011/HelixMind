/**
 * Brain Instance Manager — tracks and limits brain instances (spiral databases).
 * Manages the brain registry at ~/.helixmind/brain-registry.json.
 * Only active when user is logged in (FREE+ and above).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrainInstance {
  id: string;
  name: string;
  type: 'global' | 'local';
  path: string;
  projectPath?: string;
  createdAt: number;
  lastAccessedAt: number;
  nodeCount: number;
  active: boolean;
}

export interface BrainLimits {
  maxGlobal: number;
  maxLocal: number;
  maxActive: number;
}

interface RegistryData {
  brains: BrainInstance[];
  limits: BrainLimits;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class BrainInstanceManager {
  private registryPath: string;
  private brains: BrainInstance[] = [];
  private limits: BrainLimits = {
    maxGlobal: Infinity,
    maxLocal: Infinity,
    maxActive: Infinity,
  };

  constructor(baseDir: string) {
    mkdirSync(baseDir, { recursive: true });
    this.registryPath = join(baseDir, 'brain-registry.json');
    this.load();
  }

  // ---- CRUD ----

  register(opts: {
    name: string;
    type: 'global' | 'local';
    path: string;
    projectPath?: string;
  }): BrainInstance {
    // Deduplicate by path
    const existing = this.brains.find(b => b.path === opts.path);
    if (existing) return existing;

    const brain: BrainInstance = {
      id: `brain_${randomUUID().slice(0, 12)}`,
      name: opts.name,
      type: opts.type,
      path: opts.path,
      projectPath: opts.projectPath,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      nodeCount: 0,
      active: false,
    };

    this.brains.push(brain);
    this.save();
    return brain;
  }

  rename(id: string, newName: string): void {
    const brain = this.brains.find(b => b.id === id);
    if (!brain) throw new Error(`Brain not found: ${id}`);
    brain.name = newName;
    this.save();
  }

  remove(id: string): void {
    this.brains = this.brains.filter(b => b.id !== id);
    this.save();
  }

  // ---- Activation ----

  activate(id: string): boolean {
    const brain = this.brains.find(b => b.id === id);
    if (!brain || brain.active) return brain?.active ?? false;

    // Check limits
    const activeGlobal = this.brains.filter(b => b.active && b.type === 'global').length;
    const activeLocal = this.brains.filter(b => b.active && b.type === 'local').length;
    const totalActive = this.brains.filter(b => b.active).length;

    if (totalActive >= this.limits.maxActive) return false;
    if (brain.type === 'global' && activeGlobal >= this.limits.maxGlobal) return false;
    if (brain.type === 'local' && activeLocal >= this.limits.maxLocal) return false;

    brain.active = true;
    brain.lastAccessedAt = Date.now();
    this.save();
    return true;
  }

  deactivate(id: string): void {
    const brain = this.brains.find(b => b.id === id);
    if (brain) {
      brain.active = false;
      this.save();
    }
  }

  // ---- Queries ----

  getAll(): BrainInstance[] {
    return [...this.brains];
  }

  getById(id: string): BrainInstance | null {
    return this.brains.find(b => b.id === id) ?? null;
  }

  getByPath(path: string): BrainInstance | null {
    return this.brains.find(b => b.path === path) ?? null;
  }

  // ---- Updates ----

  updateNodeCount(id: string, count: number): void {
    const brain = this.brains.find(b => b.id === id);
    if (brain) {
      brain.nodeCount = count;
      brain.lastAccessedAt = Date.now();
      this.save();
    }
  }

  // ---- Limits ----

  getLimits(): BrainLimits {
    return { ...this.limits };
  }

  setLimits(limits: BrainLimits): void {
    this.limits = { ...limits };
    this.save();
  }

  isWithinLimits(): boolean {
    const activeGlobal = this.brains.filter(b => b.active && b.type === 'global').length;
    const activeLocal = this.brains.filter(b => b.active && b.type === 'local').length;
    const totalActive = this.brains.filter(b => b.active).length;

    return (
      activeGlobal <= this.limits.maxGlobal &&
      activeLocal <= this.limits.maxLocal &&
      totalActive <= this.limits.maxActive
    );
  }

  // ---- Persistence ----

  private load(): void {
    if (!existsSync(this.registryPath)) return;
    try {
      const raw = readFileSync(this.registryPath, 'utf-8');
      const data: RegistryData = JSON.parse(raw);
      this.brains = data.brains ?? [];
      if (data.limits) {
        this.limits = {
          maxGlobal: data.limits.maxGlobal ?? Infinity,
          maxLocal: data.limits.maxLocal ?? Infinity,
          maxActive: data.limits.maxActive ?? Infinity,
        };
      }
    } catch {
      // Corrupted file — start fresh
      this.brains = [];
    }
  }

  private save(): void {
    const data: RegistryData = {
      brains: this.brains,
      limits: {
        maxGlobal: this.limits.maxGlobal,
        maxLocal: this.limits.maxLocal,
        maxActive: this.limits.maxActive,
      },
    };
    writeFileSync(this.registryPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
