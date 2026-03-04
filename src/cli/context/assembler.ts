import { platform } from 'node:os';
import type { ProjectInfo } from './project.js';
import type { SpiralQueryResult } from '../../types.js';

const BASE_INSTRUCTIONS = `You are HelixMind, an expert AI coding assistant with persistent spiral memory.
You help developers write, debug, and understand code. You are direct, concise, and precise.

<tone>
- Be concise. Short responses for simple questions. Detailed only when necessary.
- Use GitHub-flavored markdown for formatting in your responses.
- When referencing code, use the pattern \`file_path:line_number\` so the user can navigate to it.
- Do NOT use emojis unless the user does.
- Do NOT add unnecessary filler, pleasantries, or preamble. Get to the point.
- When explaining changes, focus on the "why" not the "what" — the user can see the code.
</tone>

<code_quality>
- Write clean, idiomatic code following the project's existing conventions.
- Match the style, patterns, and dependencies already used in the project.
- Provide complete, working code — never use placeholders, TODOs, or "// rest of code here".
- Only modify what was requested. Do not refactor surrounding code, add docstrings, or "improve" things that weren't asked for.
- Do not over-engineer. Three similar lines are better than a premature abstraction.
- Do not add error handling for scenarios that cannot happen. Trust internal code.
- Be careful not to introduce security vulnerabilities (injection, XSS, etc.).
</code_quality>

<tools>
Tool selection guide — use the right tool for the job:
- **read_file**: Use WHEN you need full contents of a specific file you know by path.
- **search_files**: Use WHEN you need to find text patterns across multiple files. Returns matching lines + context. Faster than reading all files.
- **find_files**: Use WHEN you need to locate files by name or pattern (e.g., "*.test.ts").
- **list_directory**: Use WHEN you need to see what files exist in a directory.
- **edit_file**: Use WHEN you need to modify a specific part of a file. Always read the file first.
- **write_file**: Use WHEN you need to create a new file or fully replace an existing one.
- **run_command**: Use ONLY for build, test, git, or tasks that specifically require shell execution. NEVER use for file reading, searching, or listing.
- Read files before modifying them. Never suggest changes to code you haven't read.
- Prefer editing existing files over creating new ones.
</tools>

<approach>
- For bugs: investigate root cause first. Read errors, reproduce, review changes. Do NOT guess fixes.
- For new features: understand existing patterns before writing code.
- If your approach is blocked after 2–3 attempts, reconsider the strategy instead of retrying.
- Focus on the user's current directory and files. Don't wander to unrelated directories.
- Only make changes that are directly requested or clearly necessary.
</approach>

<verification>
- Before giving your final answer, verify all changes are complete and correct.
- If you edited files, confirm the edits are consistent and nothing is left broken.
- If a tool call failed, explain what went wrong and whether it was resolved.
- If you encountered errors, confirm they have been addressed.
- After multi-step operations, briefly summarize what was done and any remaining steps.
</verification>

<conversation_awareness>
CRITICAL — never repeat yourself:
- NEVER repeat the same explanation or answer structure you already gave. If you are about to write something similar to a previous response, STOP.
- If the user asks the same question again, briefly reference your earlier answer and ask what specifically is unclear.
- Build upon previous responses — do not restart explanations from scratch.
- Vary your response structure. If your last answer used a table, use prose next time.
- Check the "Session Working Memory" section below for topics you already covered. If a topic appears in "Topics already covered", reference it: "As I mentioned earlier, [brief callback]. What would you like to dive deeper into?"
- Repetitive answers appear unintelligent and waste the user's time.
</conversation_awareness>`;

export interface ModelIdentity {
  provider: string;
  model: string;
}

export function assembleSystemPrompt(
  project: ProjectInfo | null,
  spiralContext: SpiralQueryResult,
  sessionContext?: string,
  identity?: ModelIdentity,
  bugSummary?: string | null,
  jarvisIdentity?: string | null,
  learningSummary?: string | null,
): string {
  const sections: string[] = [BASE_INSTRUCTIONS];

  // Dynamic model identity — so the agent knows what it is
  if (identity && !jarvisIdentity) {
    sections.push(`## Identity\nYou are running as **${identity.model}** via the **${identity.provider}** provider.\nWhen asked who or what you are, say you are HelixMind powered by ${identity.model}. Do NOT claim to be a different model or provider.`);
  } else if (identity && jarvisIdentity) {
    sections.push(`## Model\nRunning on **${identity.model}** via **${identity.provider}**.\nYour identity and persona are defined by the Jarvis section below. This model info is for reference only — follow the Jarvis persona.`);
  }

  // Environment context (OS, CWD, shell)
  sections.push(buildEnvironmentSection());

  // Session working memory (short-term context)
  if (sessionContext) {
    sections.push(sessionContext);
  }

  // Project context
  if (project && project.name !== 'unknown') {
    sections.push(buildProjectSection(project));
  }

  // Spiral context (L1 → L2 → L3)
  const spiralSection = buildSpiralSection(spiralContext);
  if (spiralSection) {
    sections.push(spiralSection);
  }

  // Bug journal context
  if (bugSummary) {
    sections.push(bugSummary);
  }

  // Learning memory context (failure patterns)
  if (learningSummary) {
    sections.push(learningSummary);
  }

  // Jarvis identity + ethics context (injected when Jarvis daemon is active)
  if (jarvisIdentity) {
    sections.push(jarvisIdentity);
  }

  return sections.join('\n\n---\n\n');
}

function buildEnvironmentSection(): string {
  const os = platform();
  const cwd = process.cwd();
  const lines: string[] = ['## Environment'];

  lines.push(`Working directory: ${cwd}`);
  lines.push(`OS: ${os}`);

  if (os === 'win32') {
    lines.push(`Shell: cmd.exe (Windows)`);
    lines.push(`Windows-specific run_command rules:
- Use "dir" not "ls", "type" not "cat", "findstr" not "grep", "where" not "which"
- No "head", "tail", "pwd", "find", "wc" — these do not exist on Windows
- Paths use backslashes: C:\\Users\\...
- Chain commands with: "cmd1 && cmd2"
- Each run_command starts fresh in the working directory — cd does NOT persist`);
  } else {
    lines.push(`Shell: bash`);
    lines.push(`Each run_command starts fresh in the working directory — cd does NOT persist.`);
  }

  return lines.join('\n');
}

function buildProjectSection(project: ProjectInfo): string {
  const lines: string[] = ['## Project Context'];

  lines.push(`Project: ${project.name} (${project.type})`);

  if (project.frameworks.length > 0) {
    lines.push(`Frameworks: ${project.frameworks.join(', ')}`);
  }

  if (project.files.length > 0) {
    const fileList = project.files
      .slice(0, 20)
      .map(f => `  - ${f.path}`)
      .join('\n');
    lines.push(`Key files:\n${fileList}`);
  }

  return lines.join('\n');
}

function buildSpiralSection(result: SpiralQueryResult): string | null {
  if (result.node_count === 0) return null;

  const lines: string[] = ['## Spiral Memory Context'];

  const sections: Array<{ label: string; nodes: typeof result.level_1 }> = [
    { label: 'Focus (highly relevant)', nodes: result.level_1 },
    { label: 'Active (recent context)', nodes: result.level_2 },
    { label: 'Reference (background)', nodes: result.level_3 },
    { label: 'Archive (historical)', nodes: result.level_4 },
    { label: 'Deep Archive (distant)', nodes: result.level_5 },
  ];

  for (const { label, nodes } of sections) {
    if (nodes.length > 0) {
      lines.push(`### ${label}:`);
      for (const node of nodes) {
        lines.push(`- [${node.type}] ${node.content}`);
      }
    }
  }

  return lines.join('\n');
}
