/**
 * Jarvis Skill Manager — Discover, install, activate, and create modular skills.
 *
 * Skills live in .helixmind/jarvis/skills/<name>/ with a skill.json manifest.
 * They register tools into the agent loop at runtime.
 * Jarvis can create new skills autonomously (through the Proposal system).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import type {
  SkillManifest, SkillEntry, SkillRegistryData, SkillContext,
  SkillToolDef, SkillToolHandler, SkillStatus, SkillOrigin,
  AutonomyLevel,
} from './types.js';

const EMPTY_REGISTRY: SkillRegistryData = { version: 1, skills: [] };

export class SkillManager {
  private registry: SkillRegistryData;
  private registryPath: string;
  private skillsDir: string;
  private activeHandlers: Map<string, { deactivate?: () => void | Promise<void> }> = new Map();
  private toolRegistry: Map<string, { def: SkillToolDef; handler: SkillToolHandler; skillName: string }> = new Map();
  private onChange?: (event: string, skill: SkillEntry) => void;

  constructor(projectRoot: string, onChange?: (event: string, skill: SkillEntry) => void) {
    this.skillsDir = join(projectRoot, '.helixmind', 'jarvis', 'skills');
    this.registryPath = join(projectRoot, '.helixmind', 'jarvis', 'skill-registry.json');
    this.onChange = onChange;
    this.registry = this.load();
  }

  // ─── Persistence ─────────────────────────────────────────────────────

  private load(): SkillRegistryData {
    try {
      if (existsSync(this.registryPath)) {
        const raw = readFileSync(this.registryPath, 'utf-8');
        const parsed = JSON.parse(raw) as SkillRegistryData;
        if (parsed.version === 1 && Array.isArray(parsed.skills)) return parsed;
      }
    } catch { /* corrupted — start fresh */ }
    return { ...EMPTY_REGISTRY, skills: [] };
  }

  private save(): void {
    const dir = dirname(this.registryPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 2), 'utf-8');
  }

  // ─── Discovery ───────────────────────────────────────────────────────

  /**
   * Scan the skills directory for skill.json manifests.
   * Returns manifests of discovered (but not necessarily installed) skills.
   */
  discoverSkills(): SkillManifest[] {
    if (!existsSync(this.skillsDir)) return [];

    const manifests: SkillManifest[] = [];

    try {
      const dirs = readdirSync(this.skillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const dir of dirs) {
        const manifestPath = join(this.skillsDir, dir.name, 'skill.json');
        if (existsSync(manifestPath)) {
          try {
            const raw = readFileSync(manifestPath, 'utf-8');
            const manifest = JSON.parse(raw) as SkillManifest;
            if (manifest.name && manifest.main) {
              manifests.push(manifest);
            }
          } catch { /* skip malformed manifests */ }
        }
      }
    } catch { /* skills dir unreadable */ }

    return manifests;
  }

  /**
   * Sync discovered skills with registry.
   * Adds new skills as 'available', keeps existing status.
   */
  syncRegistry(): void {
    const discovered = this.discoverSkills();

    for (const manifest of discovered) {
      const existing = this.registry.skills.find(s => s.manifest.name === manifest.name);
      if (!existing) {
        this.registry.skills.push({
          manifest,
          status: 'available',
          installedAt: Date.now(),
          usageCount: 0,
          errors: [],
          path: join(this.skillsDir, manifest.name),
        });
      } else {
        // Update manifest if version changed
        if (existing.manifest.version !== manifest.version) {
          existing.manifest = manifest;
        }
      }
    }

    this.save();
  }

  // ─── Install / Activate ──────────────────────────────────────────────

  /**
   * Install a skill's npm dependencies (if any).
   */
  async installSkill(name: string): Promise<{ success: boolean; error?: string }> {
    const entry = this.getSkill(name);
    if (!entry) return { success: false, error: `Skill "${name}" not found` };

    const deps = entry.manifest.dependencies;
    if (!deps || Object.keys(deps).length === 0) {
      entry.status = 'installed';
      this.save();
      return { success: true };
    }

    const skillDir = join(this.skillsDir, name);
    const pkgJsonPath = join(skillDir, 'package.json');

    // Create package.json if it doesn't exist
    if (!existsSync(pkgJsonPath)) {
      writeFileSync(pkgJsonPath, JSON.stringify({
        name: `helixmind-skill-${name}`,
        version: entry.manifest.version,
        private: true,
        type: 'module',
        dependencies: deps,
      }, null, 2), 'utf-8');
    }

    try {
      execSync('npm install --production', {
        cwd: skillDir,
        stdio: 'pipe',
        timeout: 120_000,
      });
      entry.status = 'installed';
      this.save();
      this.onChange?.('skill_installed', entry);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      entry.status = 'error';
      entry.errors.push(`Install failed: ${msg.slice(0, 200)}`);
      this.save();
      return { success: false, error: msg };
    }
  }

  /**
   * Activate a skill — load its code and register tools.
   */
  async activateSkill(name: string, ctx: SkillContext): Promise<{ success: boolean; error?: string }> {
    const entry = this.getSkill(name);
    if (!entry) return { success: false, error: `Skill "${name}" not found` };

    // Install first if needed
    if (entry.status === 'available') {
      const installResult = await this.installSkill(name);
      if (!installResult.success) return installResult;
    }

    const entryPoint = join(this.skillsDir, name, entry.manifest.main);
    if (!existsSync(entryPoint)) {
      return { success: false, error: `Entry point not found: ${entry.manifest.main}` };
    }

    try {
      // Dynamic import of the skill module
      const mod = await import(`file://${entryPoint.replace(/\\/g, '/')}`);
      const skill = mod.default || mod;

      if (typeof skill.activate === 'function') {
        await skill.activate(ctx);
      }

      // Register declared tools
      if (entry.manifest.tools) {
        for (const toolDef of entry.manifest.tools) {
          if (typeof skill[toolDef.name] === 'function') {
            this.toolRegistry.set(toolDef.name, {
              def: toolDef,
              handler: skill[toolDef.name].bind(skill),
              skillName: name,
            });
          }
        }
      }

      this.activeHandlers.set(name, {
        deactivate: typeof skill.deactivate === 'function' ? skill.deactivate.bind(skill) : undefined,
      });

      entry.status = 'active';
      this.save();
      this.onChange?.('skill_activated', entry);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      entry.status = 'error';
      entry.errors.push(`Activation failed: ${msg.slice(0, 200)}`);
      this.save();
      return { success: false, error: msg };
    }
  }

  /**
   * Deactivate a skill — unregister tools and call deactivate().
   */
  async deactivateSkill(name: string): Promise<void> {
    const handler = this.activeHandlers.get(name);
    if (handler?.deactivate) {
      try { await handler.deactivate(); } catch { /* non-critical */ }
    }
    this.activeHandlers.delete(name);

    // Unregister tools from this skill
    for (const [toolName, reg] of this.toolRegistry) {
      if (reg.skillName === name) {
        this.toolRegistry.delete(toolName);
      }
    }

    const entry = this.getSkill(name);
    if (entry) {
      entry.status = 'disabled';
      this.save();
      this.onChange?.('skill_deactivated', entry);
    }
  }

  // ─── Create (Jarvis Self-Building) ───────────────────────────────────

  /**
   * Create a new skill from manifest + code.
   * Used when Jarvis builds a new skill after proposal approval.
   */
  async createSkill(
    manifest: SkillManifest,
    code: string,
    origin: SkillOrigin = 'jarvis_created',
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    const skillDir = join(this.skillsDir, manifest.name);

    if (existsSync(skillDir)) {
      return { success: false, error: `Skill "${manifest.name}" already exists` };
    }

    try {
      mkdirSync(skillDir, { recursive: true });

      // Write manifest
      const fullManifest: SkillManifest = { ...manifest, origin };
      writeFileSync(
        join(skillDir, 'skill.json'),
        JSON.stringify(fullManifest, null, 2),
        'utf-8',
      );

      // Write code
      writeFileSync(join(skillDir, manifest.main), code, 'utf-8');

      // Register in registry
      const entry: SkillEntry = {
        manifest: fullManifest,
        status: 'available',
        installedAt: Date.now(),
        usageCount: 0,
        errors: [],
        path: skillDir,
      };
      this.registry.skills.push(entry);
      this.save();

      this.onChange?.('skill_created', entry);
      return { success: true, path: skillDir };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  // ─── Query ───────────────────────────────────────────────────────────

  getSkill(name: string): SkillEntry | undefined {
    return this.registry.skills.find(s => s.manifest.name === name);
  }

  listSkills(): SkillEntry[] {
    return [...this.registry.skills];
  }

  getActiveSkills(): SkillEntry[] {
    return this.registry.skills.filter(s => s.status === 'active');
  }

  getSkillTool(toolName: string): { def: SkillToolDef; handler: SkillToolHandler; skillName: string } | undefined {
    return this.toolRegistry.get(toolName);
  }

  getAllSkillTools(): Map<string, { def: SkillToolDef; handler: SkillToolHandler; skillName: string }> {
    return new Map(this.toolRegistry);
  }

  /**
   * Record a tool usage for a skill.
   */
  recordUsage(skillName: string): void {
    const entry = this.getSkill(skillName);
    if (entry) {
      entry.usageCount++;
      entry.lastUsedAt = Date.now();
      this.save();
    }
  }

  /**
   * Remove a skill completely.
   */
  removeSkill(name: string): boolean {
    const idx = this.registry.skills.findIndex(s => s.manifest.name === name);
    if (idx === -1) return false;

    // Deactivate if active
    if (this.activeHandlers.has(name)) {
      this.deactivateSkill(name).catch(() => {});
    }

    this.registry.skills.splice(idx, 1);
    this.save();
    return true;
  }

  // ─── Prompt Injection ────────────────────────────────────────────────

  /**
   * Build a skill summary for the system prompt.
   */
  getSkillsPrompt(): string | null {
    const active = this.getActiveSkills();
    const available = this.registry.skills.filter(s => s.status === 'available' || s.status === 'installed');

    if (active.length === 0 && available.length === 0) return null;

    const lines: string[] = ['## Installed Skills'];

    if (active.length > 0) {
      lines.push('\nActive:');
      for (const s of active) {
        const tools = s.manifest.tools?.map(t => t.name).join(', ') || 'none';
        lines.push(`- ${s.manifest.name} v${s.manifest.version}: ${s.manifest.description} [tools: ${tools}]`);
      }
    }

    if (available.length > 0) {
      lines.push(`\nAvailable (${available.length} not activated):`);
      for (const s of available.slice(0, 5)) {
        lines.push(`- ${s.manifest.name}: ${s.manifest.description}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get short status line.
   */
  getStatusLine(): string {
    const active = this.getActiveSkills().length;
    const total = this.registry.skills.length;
    if (total === 0) return '';
    return `${active}/${total} skills active`;
  }

  /**
   * Set onChange callback.
   */
  setOnChange(handler: (event: string, skill: SkillEntry) => void): void {
    this.onChange = handler;
  }
}
