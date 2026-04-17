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

/**
 * FIX: JARVIS-HIGH-1 — Static code review for LLM-generated skills.
 * These patterns are hard-blocks before a skill can ever be approved.
 * Even "approved" skills should not contain these — if the user approves
 * anyway, they must deliberately edit the file.
 *
 * This is explicitly NOT a general sandboxing solution — once the code
 * is imported, Node can do anything. The guard exists to stop the most
 * obvious prompt-injection-to-RCE paths (spawn a shell, eval() a string,
 * scribble outside the skills directory).
 */
const DANGEROUS_CODE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /require\(\s*['"]child_process['"]\s*\)/, reason: 'imports child_process (spawn/exec)' },
  { pattern: /from\s+['"]child_process['"]/, reason: 'imports child_process (spawn/exec)' },
  { pattern: /require\(\s*['"]node:child_process['"]\s*\)/, reason: 'imports node:child_process' },
  { pattern: /from\s+['"]node:child_process['"]/, reason: 'imports node:child_process' },
  { pattern: /\beval\s*\(/, reason: 'uses eval()' },
  { pattern: /\bnew\s+Function\s*\(/, reason: 'uses new Function()' },
  { pattern: /require\(\s*['"]vm['"]\s*\)/, reason: 'imports vm module' },
  { pattern: /from\s+['"]vm['"]/, reason: 'imports vm module' },
  { pattern: /require\(\s*['"]node:vm['"]\s*\)/, reason: 'imports node:vm' },
  { pattern: /from\s+['"]node:vm['"]/, reason: 'imports node:vm' },
  // Arbitrary dlopen / native bindings
  { pattern: /process\.dlopen\s*\(/, reason: 'calls process.dlopen' },
];

export interface SkillStaticCheckResult {
  safe: boolean;
  reasons: string[];
}

/**
 * FIX: JARVIS-HIGH-1 — scans the generated JS entry point for dangerous
 * patterns and for writes outside the skill directory.
 */
export function staticallyValidateSkillCode(
  code: string,
  skillDir: string,
): SkillStaticCheckResult {
  const reasons: string[] = [];
  for (const { pattern, reason } of DANGEROUS_CODE_PATTERNS) {
    if (pattern.test(code)) reasons.push(reason);
  }

  // Additionally block any require('fs')/fs-extra write path that targets
  // a location outside .helixmind/jarvis/skills/. We can't fully parse
  // arbitrary JS, but writeFileSync/appendFileSync with literal strings
  // is the common vector — check those.
  const writeCallPattern = /\b(writeFileSync|appendFileSync|writeFile|appendFile|createWriteStream|mkdirSync)\s*\(\s*(['"`])([^'"`]+)\2/g;
  const skillDirNorm = skillDir.replace(/\\/g, '/').toLowerCase();
  let m: RegExpExecArray | null;
  while ((m = writeCallPattern.exec(code)) !== null) {
    const target = m[3].replace(/\\/g, '/').toLowerCase();
    // Allow relative paths — they resolve against process.cwd() at
    // runtime which is project-root. The sandbox will catch those.
    // Only flag absolute-looking paths that don't land in the skills dir.
    const looksAbsolute = /^[a-z]:\//.test(target) || target.startsWith('/');
    if (looksAbsolute && !target.includes('.helixmind/jarvis/skills/') && !target.startsWith(skillDirNorm)) {
      reasons.push(`writes outside skills dir: ${m[3]}`);
    }
  }

  return { safe: reasons.length === 0, reasons };
}

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
   *
   * FIX: JARVIS-HIGH-1 — LLM-generated skills (origin='jarvis_created')
   * cannot be dynamically imported until the user has approved them.
   * Until approved, activateSkill() returns { success: false } and emits
   * a 'skill_pending_review' event via onChange so the UI can prompt the
   * user. Built-in skills (origin='builtin') skip the gate.
   */
  async activateSkill(name: string, ctx: SkillContext): Promise<{ success: boolean; error?: string }> {
    const entry = this.getSkill(name);
    if (!entry) return { success: false, error: `Skill "${name}" not found` };

    // FIX: JARVIS-HIGH-1 — approval gate for jarvis-created skills.
    const origin = entry.manifest.origin;
    const requiresApproval = origin === 'jarvis_created' || origin === 'user';
    if (requiresApproval && !entry.approved) {
      const reason = `Skill "${name}" requires user approval before activation (origin: ${origin}).`;
      entry.errors.push(reason);
      this.save();
      this.onChange?.('skill_pending_review', entry);
      return { success: false, error: reason };
    }

    // Install first if needed
    if (entry.status === 'available') {
      const installResult = await this.installSkill(name);
      if (!installResult.success) return installResult;
    }

    const entryPoint = join(this.skillsDir, name, entry.manifest.main);
    if (!existsSync(entryPoint)) {
      return { success: false, error: `Entry point not found: ${entry.manifest.main}` };
    }

    // FIX: JARVIS-HIGH-1 — defense-in-depth: even an approved skill is
    // re-scanned at load time. If the on-disk code has been swapped to
    // something dangerous between approval and activation, we refuse.
    if (requiresApproval) {
      try {
        const code = readFileSync(entryPoint, 'utf-8');
        const skillDir = join(this.skillsDir, name);
        const check = staticallyValidateSkillCode(code, skillDir);
        if (!check.safe) {
          const reason = `Skill "${name}" rejected by static check: ${check.reasons.join(', ')}`;
          entry.status = 'error';
          entry.errors.push(reason);
          entry.approved = false;           // revoke stale approval
          entry.approvedAt = undefined;
          this.save();
          this.onChange?.('skill_rejected', entry);
          return { success: false, error: reason };
        }
      } catch (err) {
        return { success: false, error: `Could not read skill code: ${err instanceof Error ? err.message : String(err)}` };
      }
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

  // ─── Approval (FIX: JARVIS-HIGH-1) ───────────────────────────────────

  /**
   * Run the static safety check against a skill's current on-disk code.
   * Used by the UI "approve" flow to show what the user is about to trust.
   */
  reviewSkill(name: string): { ok: boolean; reasons: string[]; codePath?: string } {
    const entry = this.getSkill(name);
    if (!entry) return { ok: false, reasons: [`Skill "${name}" not found`] };
    const codePath = join(this.skillsDir, name, entry.manifest.main);
    if (!existsSync(codePath)) return { ok: false, reasons: [`Entry point missing: ${entry.manifest.main}`] };
    try {
      const code = readFileSync(codePath, 'utf-8');
      const check = staticallyValidateSkillCode(code, join(this.skillsDir, name));
      return { ok: check.safe, reasons: check.reasons, codePath };
    } catch (err) {
      return { ok: false, reasons: [err instanceof Error ? err.message : String(err)], codePath };
    }
  }

  /**
   * Mark a skill as user-approved. Runs the static check first and refuses
   * if the code contains any dangerous patterns — user cannot approve code
   * that imports child_process, uses eval(), etc.
   */
  approveSkill(name: string): { success: boolean; error?: string } {
    const review = this.reviewSkill(name);
    if (!review.ok) {
      return { success: false, error: `Cannot approve: ${review.reasons.join(', ')}` };
    }
    const entry = this.getSkill(name);
    if (!entry) return { success: false, error: `Skill "${name}" not found` };
    entry.approved = true;
    entry.approvedAt = Date.now();
    this.save();
    this.onChange?.('skill_approved', entry);
    return { success: true };
  }

  /** Revoke approval — user-facing undo. */
  revokeSkillApproval(name: string): boolean {
    const entry = this.getSkill(name);
    if (!entry) return false;
    entry.approved = false;
    entry.approvedAt = undefined;
    this.save();
    this.onChange?.('skill_approval_revoked', entry);
    return true;
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
   * Record outcome (success/failure) for a skill, updating effectiveness data.
   */
  recordOutcome(name: string, success: boolean, qualityDelta: number = 0): void {
    const entry = this.getSkill(name);
    if (!entry) return;
    if (!entry.effectiveness) {
      entry.effectiveness = {
        skillName: name,
        timesUsed: 0,
        timesSuccessful: 0,
        avgQualityDelta: 0,
        lastUsedAt: Date.now(),
      };
    }
    entry.effectiveness.timesUsed++;
    if (success) entry.effectiveness.timesSuccessful++;
    const prev = entry.effectiveness.avgQualityDelta;
    entry.effectiveness.avgQualityDelta =
      (prev * (entry.effectiveness.timesUsed - 1) + qualityDelta) / entry.effectiveness.timesUsed;
    entry.effectiveness.lastUsedAt = Date.now();
    this.save();
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
