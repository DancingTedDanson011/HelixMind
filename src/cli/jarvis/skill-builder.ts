import type { ProposalEntry, JarvisTaskPriority, SkillScore } from './types.js';

export interface SkillBuildSpec {
  skillName: string;
  toolPrefix: string;
  focus: string;
  rationale: string;
  source: 'proposal' | 'failure';
  priority: JarvisTaskPriority;
}

export interface SkillGapDetectionInput {
  taskTitle: string;
  taskDescription: string;
  failure: string;
  existingScores?: SkillScore[];
  existingSkillNames?: string[];
}

const TOOL_GAP_HINT = /\b(unknown tool|missing capability|not supported|no tool|needs? (?:a |an )?(?:tool|integration)|manual workflow|repetitive workflow|missing integration|cannot automate|can't automate|unable to automate)\b/i;
const DOMAIN_HINT = /\b(api|integration|webhook|service|sdk|provider|jira|notion|slack|linear|supabase|shopify|stripe|twilio|docker|kubernetes|github|gitlab|s3|postgres|postgresql|mysql|sqlite|redis)\b/i;
const LEADING_NOISE = /\b(create|build|add|implement|make|jarvis|skill|tool|for|the|a|an|missing|needed|need)\b/gi;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48);
}

function toSnakeCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, 48);
}

function cleanFocus(value: string): string {
  const collapsed = value
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s:/.-]+/g, ' ')
    .trim();
  return collapsed.replace(LEADING_NOISE, '').replace(/\s+/g, ' ').trim() || collapsed;
}

function extractFocus(text: string): string {
  const explicit = text.match(/create skill for:\s*(.+)$/i)?.[1]
    ?? text.match(/missing (?:tool|capability|integration)\s*:?\s*(.+)$/i)?.[1]
    ?? text.match(/needs? (?:a |an )?(?:tool|integration)\s+(?:for|to)\s+(.+)$/i)?.[1];

  if (explicit) return cleanFocus(explicit);

  const domain = text.match(DOMAIN_HINT)?.[0];
  if (domain) {
    const start = Math.max(0, text.toLowerCase().indexOf(domain.toLowerCase()) - 24);
    return cleanFocus(text.slice(start, start + 80));
  }

  return cleanFocus(text).split(/\s+/).slice(0, 8).join(' ');
}

function inferSkillName(focus: string, existingSkillNames: string[] = []): string {
  const base = slugify(focus) || 'jarvis-helper';
  const root = base.endsWith('-skill') ? base : `${base}-skill`;
  if (!existingSkillNames.includes(root)) return root;
  let idx = 2;
  while (existingSkillNames.includes(`${root}-${idx}`)) idx++;
  return `${root}-${idx}`;
}

function inferToolPrefix(skillName: string): string {
  const base = skillName.replace(/-skill(?:-\d+)?$/, '');
  return toSnakeCase(base) || 'skill_tool';
}

export function buildSkillBuildSpecFromProposal(proposal: ProposalEntry): SkillBuildSpec {
  const focus = extractFocus(`${proposal.title}\n${proposal.description}`) || proposal.title;
  const skillName = inferSkillName(focus);
  return {
    skillName,
    toolPrefix: inferToolPrefix(skillName),
    focus,
    rationale: proposal.rationale || proposal.description,
    source: 'proposal',
    priority: proposal.impact === 'high' ? 'high' : 'medium',
  };
}

export function detectSkillBuildFromFailure(input: SkillGapDetectionInput): SkillBuildSpec | null {
  const bestScore = input.existingScores?.length
    ? Math.max(...input.existingScores.map((score) => score.totalScore))
    : 0;
  if (bestScore >= 0.5) return null;

  const combined = `${input.taskTitle}\n${input.taskDescription}\n${input.failure}`;
  if (!TOOL_GAP_HINT.test(combined) && !DOMAIN_HINT.test(combined)) return null;

  const focus = extractFocus(combined);
  if (!focus || focus.length < 4) return null;

  const skillName = inferSkillName(focus, input.existingSkillNames);
  return {
    skillName,
    toolPrefix: inferToolPrefix(skillName),
    focus,
    rationale: input.failure.trim() || input.taskDescription.trim() || input.taskTitle,
    source: 'failure',
    priority: 'medium',
  };
}

export function buildSkillBuildTask(spec: SkillBuildSpec): {
  title: string;
  description: string;
  priority: JarvisTaskPriority;
  tags: string[];
} {
  const title = `Build skill ${spec.skillName}`;
  const description = [
    `Build a new Jarvis skill named "${spec.skillName}" to close this capability gap: ${spec.focus}.`,
    '',
    `Target directory: .helixmind/jarvis/skills/${spec.skillName}/`,
    'Required files:',
    '- skill.json',
    '- index.js',
    '',
    'Implementation requirements:',
    `- Create a focused skill for: ${spec.focus}`,
    `- Prefer 1-2 tools max; use concise snake_case names starting near "${spec.toolPrefix}"`,
    '- Keep dependency footprint minimal; only add dependencies when strictly needed',
    '- Set manifest.origin to "jarvis_created" and manifest.main to "index.js"',
    '- Export a default skill object with tool handler methods matching manifest.tools names',
    '- Do not modify Helix core files unless absolutely required for activation compatibility',
    '- Validate the generated files by reading them back and checking the manifest structure',
    '- End with a single DONE line naming the skill and the tools you created',
    '',
    `Why this skill is needed: ${spec.rationale}`,
    '',
    'After this task succeeds, Helix will sync and activate the skill automatically.',
  ].join('\n');

  return {
    title,
    description,
    priority: spec.priority,
    tags: [
      'skill_build',
      `skill:${spec.skillName}`,
      `skill_source:${spec.source}`,
    ],
  };
}

export function getSkillNameFromTags(tags?: string[]): string | null {
  const tag = tags?.find((value) => value.startsWith('skill:'));
  return tag ? tag.slice('skill:'.length) : null;
}
