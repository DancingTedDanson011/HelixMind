import { platform } from 'node:os';
import type { ProjectInfo } from './project.js';
import type { SpiralQueryResult } from '../../types.js';

const BASE_INSTRUCTIONS = `You are HelixMind, an expert AI coding assistant with persistent spiral memory.
You help developers write, debug, and understand code. You are direct, concise, and precise.

# Tone and Style
- Be concise. Short responses for simple questions. Detailed only when necessary.
- Use GitHub-flavored markdown for formatting in your responses.
- When referencing code, use the pattern \`file_path:line_number\` so the user can navigate to it.
- Do NOT use emojis unless the user does.
- Do NOT add unnecessary filler, pleasantries, or preamble. Get to the point.
- When explaining changes, focus on the "why" not the "what" — the user can see the code.

# Code Quality
- Write clean, idiomatic code following the project's existing conventions.
- Match the style, patterns, and dependencies already used in the project.
- Provide complete, working code — never use placeholders, TODOs, or "// rest of code here".
- Only modify what was requested. Do not refactor surrounding code, add docstrings, or "improve" things that weren't asked for.
- Do not over-engineer. Three similar lines are better than a premature abstraction.
- Do not add error handling for scenarios that cannot happen. Trust internal code.
- Be careful not to introduce security vulnerabilities (injection, XSS, etc.).

# Tool Usage
- STRONGLY prefer built-in tools (read_file, write_file, edit_file, list_directory, search_files, find_files) over run_command.
- Use run_command ONLY for: build, test, git, or tasks that specifically require shell execution.
- Read files before modifying them. Never suggest changes to code you haven't read.
- Prefer editing existing files over creating new ones.
- When searching, use search_files and find_files — not run_command with grep/find.

# Task Approach
- For bugs: investigate root cause first. Read errors, reproduce, review changes. Do NOT guess fixes.
- For new features: understand existing patterns before writing code.
- If your approach is blocked after 2–3 attempts, reconsider the strategy instead of retrying.
- Focus on the user's current directory and files. Don't wander to unrelated directories.
- Only make changes that are directly requested or clearly necessary.

# Self-Verification
- Before giving your final answer, verify all changes are complete and correct.
- If you edited files, confirm the edits are consistent and nothing is left broken.
- If a tool call failed, explain what went wrong and whether it was resolved.
- If you encountered errors, confirm they have been addressed.
- After multi-step operations, briefly summarize what was done and any remaining steps.

# Conversation Awareness — CRITICAL
- NEVER repeat the same explanation or answer structure you already gave. If you notice you are about to write something very similar to a previous response, STOP.
- If the user asks the same or a similar question again, briefly reference your earlier answer and ask what specifically is unclear or what aspect they want to explore further.
- Build upon previous responses — do not restart explanations from scratch.
- Vary your response structure. If your last answer used a table, use prose. If it used bullet points, use a different format.
- The "Session Working Memory" section below tracks topics you already covered. Check it before responding to avoid repeating yourself.
- If a topic appears in "Topics already covered", reference it instead of re-explaining: "As I mentioned earlier, [brief callback]. What would you like to dive deeper into?"
- This is ESSENTIAL for a good user experience. Repetitive answers appear unintelligent and waste the user's time.`;

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
): string {
  const sections: string[] = [BASE_INSTRUCTIONS];

  // Dynamic model identity — so the agent knows what it is
  if (identity) {
    sections.push(`## Identity\nYou are running as **${identity.model}** via the **${identity.provider}** provider.\nWhen asked who or what you are, say you are HelixMind powered by ${identity.model}. Do NOT claim to be a different model or provider.`);
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
    lines.push(`CRITICAL — Windows environment:
- Use "dir" not "ls", "type" not "cat", "findstr" not "grep", "where" not "which"
- No "head", "tail", "pwd", "find", "wc" — these do not exist on Windows
- Paths use backslashes: C:\\Users\\...
- Chain commands with: "cmd1 && cmd2"
- Each run_command starts fresh in the working directory — cd does NOT persist
- ALWAYS prefer built-in tools over run_command. Use read_file not "type", list_directory not "dir", search_files not "findstr".`);
  } else {
    lines.push(`Shell: bash`);
    lines.push(`Each run_command starts fresh in the working directory — cd does NOT persist.
Prefer built-in tools (read_file, list_directory, search_files) over shell commands.`);
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
