import type { SWETask } from './types.js';
import type { SpiralQueryResult } from '../../types.js';

/**
 * Build a system prompt optimized for SWE-bench task resolution.
 * Focused on minimal, targeted bug fixes.
 */
export function buildBenchSystemPrompt(task: SWETask, projectRoot: string): string {
  const sections: string[] = [];

  sections.push(`You are an expert software engineer. Your task is to fix a GitHub issue in a real codebase.

## Repository
- Repo: ${task.repo}
- Working directory: ${projectRoot}
- The repository has been checked out at the exact commit where the issue exists.

## Issue to Fix
${task.problem_statement}`);

  if (task.hints_text && task.hints_text.trim()) {
    sections.push(`## Hints
${task.hints_text}`);
  }

  sections.push(`## Instructions
1. Read the issue carefully and understand what is expected.
2. Explore the codebase to find the relevant files using search_files and find_files.
3. Read and understand the existing code before making changes.
4. Make the MINIMAL changes needed to fix the issue. Do not refactor, do not add features.
5. Do NOT modify any test files. Only fix the source code.
6. After making changes, verify your fix by reading the modified files.
7. Do NOT run the test suite — that happens automatically after your fix.

## Rules
- Change as few files as possible.
- Change as few lines as possible.
- Do not add type annotations, docstrings, or comments unless they are part of the fix.
- Do not rename variables or move code unless required by the fix.
- Do not use git commit — just edit the files directly.
- If the issue mentions a specific file, start there.
- If unsure, search for error messages or class/function names from the issue.`);

  sections.push(`## Available Tools
You have: read_file, write_file, edit_file, list_directory, search_files, find_files, run_command, git_status, git_diff, git_log.

Use edit_file for targeted changes. Use search_files to find relevant code. Use run_command for exploring (e.g., grep, python -c).`);

  return sections.join('\n\n');
}

/**
 * Build a system prompt with Spiral Memory context for enhanced SWE-bench solving.
 * Combines standard bench instructions with spiral context sections.
 */
export function buildBenchSystemPromptWithSpiral(
  task: SWETask,
  projectRoot: string,
  spiralContext: SpiralQueryResult,
): string {
  const sections: string[] = [];

  sections.push(`You are an expert software engineer with access to a spiral memory system that provides contextual knowledge from similar codebases and past bug fixes.

## Repository
- Repo: ${task.repo}
- Working directory: ${projectRoot}
- The repository has been checked out at the exact commit where the issue exists.

## Issue to Fix
${task.problem_statement}`);

  if (task.hints_text && task.hints_text.trim()) {
    sections.push(`## Hints
${task.hints_text}`);
  }

  // Inject spiral context if available
  if (spiralContext.node_count > 0) {
    const spiralSections: string[] = ['## Spiral Memory Context\nRelevant knowledge from the spiral memory system:'];

    const levelMap: Array<{ label: string; nodes: typeof spiralContext.level_1 }> = [
      { label: 'Focus (highly relevant)', nodes: spiralContext.level_1 },
      { label: 'Active (recent patterns)', nodes: spiralContext.level_2 },
      { label: 'Reference (background)', nodes: spiralContext.level_3 },
    ];

    for (const { label, nodes } of levelMap) {
      if (nodes.length > 0) {
        spiralSections.push(`### ${label}:`);
        for (const node of nodes) {
          spiralSections.push(`- [${node.type}] ${node.content}`);
        }
      }
    }

    sections.push(spiralSections.join('\n'));
  }

  sections.push(`## Instructions
1. Read the issue carefully and understand what is expected.
2. Review the Spiral Memory Context above for relevant patterns and prior fixes.
3. Explore the codebase to find the relevant files using search_files and find_files.
4. Read and understand the existing code before making changes.
5. Make the MINIMAL changes needed to fix the issue. Do not refactor, do not add features.
6. Do NOT modify any test files. Only fix the source code.
7. After making changes, verify your fix by reading the modified files.
8. Do NOT run the test suite — that happens automatically after your fix.
9. Use spiral_query to search for similar patterns or fixes if stuck.
10. Use spiral_store to save important patterns you discover for future tasks.

## Rules
- Change as few files as possible.
- Change as few lines as possible.
- Do not add type annotations, docstrings, or comments unless they are part of the fix.
- Do not rename variables or move code unless required by the fix.
- Do not use git commit — just edit the files directly.
- If the issue mentions a specific file, start there.
- If unsure, search for error messages or class/function names from the issue.`);

  sections.push(`## Available Tools
You have: read_file, write_file, edit_file, list_directory, search_files, find_files, run_command, git_status, git_diff, git_log, spiral_query, spiral_store.

Use edit_file for targeted changes. Use search_files to find relevant code. Use spiral_query to leverage memory from similar fixes. Use spiral_store to save fix patterns for future reference.`);

  return sections.join('\n\n');
}
