/**
 * Jarvis Skill Scorer — Evaluates skills against tasks and tracks effectiveness.
 *
 * Scoring formula:
 *   totalScore = (taskMatch × 0.4 + repetitionLikelihood × 0.2 + outputImprovement × 0.3) / buildCost
 *
 * Effectiveness data persists in .helixmind/jarvis/skill-effectiveness.json.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { SkillScore, SkillEffectiveness, SkillEntry, SkillStatus } from './types.js';
import type { LearningJournal } from './learning.js';

interface EffectivenessData {
  version: 1;
  entries: Record<string, SkillEffectiveness>;
}

const EMPTY_DATA: EffectivenessData = { version: 1, entries: {} };

const WEIGHT_TASK_MATCH = 0.4;
const WEIGHT_REPETITION = 0.2;
const WEIGHT_OUTPUT = 0.3;

const BUILD_COST_ACTIVE = 0.1;
const BUILD_COST_INSTALLED = 0.3;
const BUILD_COST_AVAILABLE = 0.3;
const BUILD_COST_NEW = 0.8;

const MIN_SELECT_SCORE = 0.5;
const MIN_BUILD_SCORE = 0.6;
const MIN_PATTERN_COUNT = 3;

export class SkillScorer {
  private data: EffectivenessData;
  private filePath: string;

  constructor(projectRoot: string) {
    this.filePath = join(projectRoot, '.helixmind', 'jarvis', 'skill-effectiveness.json');
    this.data = this.load();
  }

  // ─── Persistence ─────────────────────────────────────────────────────

  private load(): EffectivenessData {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as EffectivenessData;
        if (parsed.version === 1 && parsed.entries && typeof parsed.entries === 'object') {
          return parsed;
        }
      }
    } catch { /* corrupted — start fresh */ }
    return { ...EMPTY_DATA, entries: {} };
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  // ─── Scoring ──────────────────────────────────────────────────────────

  /**
   * Score all available skills against a task description.
   */
  scoreSkills(
    taskDesc: string,
    taskCategory: string,
    skills: SkillEntry[],
  ): SkillScore[] {
    return skills.map(skill => this.scoreOne(taskDesc, taskCategory, skill));
  }

  /**
   * Select the best skill for a task, or null if no good match (score < 0.5).
   */
  selectBestSkill(
    taskDesc: string,
    taskCategory: string,
    skills: SkillEntry[],
  ): SkillScore | null {
    const scores = this.scoreSkills(taskDesc, taskCategory, skills);
    if (scores.length === 0) return null;

    scores.sort((a, b) => b.totalScore - a.totalScore);
    const best = scores[0];
    return best.totalScore >= MIN_SELECT_SCORE ? best : null;
  }

  /**
   * Decide if a new skill should be built.
   * Conditions: hypothetical score > 0.6, pattern 3+ times in LearningJournal, no existing > 0.5.
   */
  shouldBuildSkill(
    taskDesc: string,
    taskCategory: string,
    existingScores: SkillScore[],
    learningJournal: LearningJournal,
  ): { should: boolean; reason: string } {
    // If an existing skill already scores well, don't build
    const bestExisting = existingScores.length > 0
      ? Math.max(...existingScores.map(s => s.totalScore))
      : 0;

    if (bestExisting >= MIN_SELECT_SCORE) {
      return { should: false, reason: `Existing skill scores ${bestExisting.toFixed(2)}, no need to build` };
    }

    // Check pattern frequency in learning journal
    const relatedLearnings = this.countRelatedLearnings(taskDesc, taskCategory, learningJournal);
    if (relatedLearnings < MIN_PATTERN_COUNT) {
      return { should: false, reason: `Only ${relatedLearnings} related learnings (need ${MIN_PATTERN_COUNT}+)` };
    }

    // Compute hypothetical score for a new skill
    const hypotheticalMatch = this.computeHypotheticalMatch(taskDesc, relatedLearnings);
    if (hypotheticalMatch < MIN_BUILD_SCORE) {
      return { should: false, reason: `Hypothetical score ${hypotheticalMatch.toFixed(2)} below ${MIN_BUILD_SCORE} threshold` };
    }

    return {
      should: true,
      reason: `${relatedLearnings} related patterns found, hypothetical score ${hypotheticalMatch.toFixed(2)}`,
    };
  }

  // ─── Effectiveness Tracking ──────────────────────────────────────────

  /**
   * Track outcome after skill use.
   */
  recordOutcome(skillName: string, success: boolean, qualityDelta: number = 0): void {
    let eff = this.data.entries[skillName];
    if (!eff) {
      eff = {
        skillName,
        timesUsed: 0,
        timesSuccessful: 0,
        avgQualityDelta: 0,
        lastUsedAt: Date.now(),
      };
      this.data.entries[skillName] = eff;
    }

    eff.timesUsed++;
    if (success) eff.timesSuccessful++;

    const prev = eff.avgQualityDelta;
    eff.avgQualityDelta = (prev * (eff.timesUsed - 1) + qualityDelta) / eff.timesUsed;
    eff.lastUsedAt = Date.now();

    this.save();
  }

  /**
   * Get effectiveness data for a skill.
   */
  getEffectiveness(skillName: string): SkillEffectiveness | undefined {
    return this.data.entries[skillName];
  }

  // ─── Internal Scoring Helpers ────────────────────────────────────────

  private scoreOne(taskDesc: string, taskCategory: string, skill: SkillEntry): SkillScore {
    const taskMatch = this.computeTaskMatch(taskDesc, taskCategory, skill);
    const repetitionLikelihood = this.computeRepetitionLikelihood(skill);
    const outputImprovement = this.computeOutputImprovement(skill.manifest.name);
    const buildCost = this.computeBuildCost(skill.status);

    const raw = taskMatch * WEIGHT_TASK_MATCH
      + repetitionLikelihood * WEIGHT_REPETITION
      + outputImprovement * WEIGHT_OUTPUT;

    const totalScore = raw / buildCost;

    return {
      skillName: skill.manifest.name,
      taskMatch,
      repetitionLikelihood,
      outputImprovement,
      buildCost,
      totalScore,
    };
  }

  /**
   * Keyword overlap between task and skill description/tools.
   */
  private computeTaskMatch(taskDesc: string, taskCategory: string, skill: SkillEntry): number {
    const taskWords = this.tokenize(`${taskDesc} ${taskCategory}`);
    if (taskWords.length === 0) return 0;

    const skillText = [
      skill.manifest.name,
      skill.manifest.description,
      ...(skill.manifest.tools?.map(t => `${t.name} ${t.description || ''}`) ?? []),
      ...(skill.manifest.triggers ?? []),
    ].join(' ');
    const skillWords = new Set(this.tokenize(skillText));

    const matches = taskWords.filter(w => skillWords.has(w)).length;
    return Math.min(1.0, matches / taskWords.length);
  }

  /**
   * Based on usage count of the skill — higher usage = higher repetition likelihood.
   */
  private computeRepetitionLikelihood(skill: SkillEntry): number {
    const usage = skill.usageCount || 0;
    // Sigmoid-ish: 0 usage = 0, 5+ usage approaches 1
    return Math.min(1.0, usage / 5);
  }

  /**
   * From effectiveness history: success rate weighted by quality delta.
   */
  private computeOutputImprovement(skillName: string): number {
    const eff = this.data.entries[skillName];
    if (!eff || eff.timesUsed === 0) return 0;

    const successRate = eff.timesSuccessful / eff.timesUsed;
    const qualityBonus = Math.max(0, Math.min(1.0, eff.avgQualityDelta));
    return successRate * 0.7 + qualityBonus * 0.3;
  }

  /**
   * Build cost based on skill status.
   */
  private computeBuildCost(status: SkillStatus): number {
    switch (status) {
      case 'active': return BUILD_COST_ACTIVE;
      case 'installed': return BUILD_COST_INSTALLED;
      case 'available': return BUILD_COST_AVAILABLE;
      default: return BUILD_COST_NEW;
    }
  }

  /**
   * Count learnings related to a task description and category.
   */
  private countRelatedLearnings(
    taskDesc: string,
    taskCategory: string,
    journal: LearningJournal,
  ): number {
    const taskWords = new Set(this.tokenize(`${taskDesc} ${taskCategory}`));
    const all = journal.getAll();

    return all.filter(entry => {
      const entryWords = this.tokenize(`${entry.errorPattern} ${entry.solution} ${entry.context}`);
      const overlap = entryWords.filter(w => taskWords.has(w)).length;
      return overlap >= 2;
    }).length;
  }

  /**
   * Hypothetical match score for a skill that would be purpose-built.
   */
  private computeHypotheticalMatch(taskDesc: string, relatedLearnings: number): number {
    // A purpose-built skill would have perfect task match (0.9),
    // repetition based on learnings, no output history yet
    const taskMatch = 0.9;
    const repetition = Math.min(1.0, relatedLearnings / 5);
    const outputImprovement = 0; // no history

    const raw = taskMatch * WEIGHT_TASK_MATCH
      + repetition * WEIGHT_REPETITION
      + outputImprovement * WEIGHT_OUTPUT;

    return raw / BUILD_COST_NEW;
  }

  /**
   * Tokenize text into lowercase words for matching.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s,.;:{}()\[\]"'_\-/\\]+/)
      .filter(w => w.length > 2);
  }
}
