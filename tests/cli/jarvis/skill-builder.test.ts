import { describe, expect, it } from 'vitest';
import {
  buildSkillBuildSpecFromProposal,
  buildSkillBuildTask,
  detectSkillBuildFromFailure,
  getSkillNameFromTags,
} from '../../../src/cli/jarvis/skill-builder.js';

describe('skill-builder', () => {
  it('builds a deterministic skill task from a skill_creation proposal', () => {
    const spec = buildSkillBuildSpecFromProposal({
      id: 7,
      title: 'Create skill for: Jira issue triage workflow',
      description: 'No existing skill covers Jira triage automation.',
      rationale: 'Jira triage repeats every day.',
      category: 'skill_creation',
      source: 'thinking_medium',
      status: 'pending',
      impact: 'high',
      risk: 'low',
      affectedFiles: [],
      evidence: [],
      createdAt: 1,
      updatedAt: 1,
    });

    const task = buildSkillBuildTask(spec);
    expect(spec.skillName).toContain('jira-issue-triage-workflow');
    expect(task.title).toContain(spec.skillName);
    expect(task.description).toContain(`.helixmind/jarvis/skills/${spec.skillName}/`);
    expect(task.tags).toContain('skill_build');
    expect(getSkillNameFromTags(task.tags)).toBe(spec.skillName);
  });

  it('detects a missing tool gap from repeated integration failures', () => {
    const spec = detectSkillBuildFromFailure({
      taskTitle: 'Automate Jira ticket enrichment',
      taskDescription: 'Need a Jira integration to fetch issue metadata and comments.',
      failure: 'TASK_FAILED: missing capability - no tool exists for Jira API lookups in this workflow',
      existingScores: [{ skillName: 'git-helper', totalScore: 0.12 } as any],
      existingSkillNames: ['git-helper'],
    });

    expect(spec).not.toBeNull();
    expect(spec?.skillName).toContain('jira');
    expect(spec?.source).toBe('failure');
  });

  it('does not suggest a new skill when an existing one already matches well', () => {
    const spec = detectSkillBuildFromFailure({
      taskTitle: 'Automate Jira ticket enrichment',
      taskDescription: 'Need a Jira integration to fetch issue metadata and comments.',
      failure: 'TASK_FAILED: missing capability - no tool exists for Jira API lookups in this workflow',
      existingScores: [{ skillName: 'jira-helper', totalScore: 0.82 } as any],
      existingSkillNames: ['jira-helper'],
    });

    expect(spec).toBeNull();
  });
});
