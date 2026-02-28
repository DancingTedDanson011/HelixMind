import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Checkpoint, FileSnapshot } from './store.js';
import type { CheckpointStore } from './store.js';
import type { ToolMessage } from '../providers/types.js';

export interface RevertResult {
  type: 'chat' | 'code' | 'both';
  filesReverted: number;
  messagesRemoved: number;
  checkpointsRemoved: number;
}

/**
 * Revert chat history to a checkpoint. Code changes remain.
 */
export function revertChatOnly(
  checkpointId: number,
  store: CheckpointStore,
  agentHistory: ToolMessage[],
  simpleMessages: Array<{ role: string; content: string }>,
): RevertResult {
  const checkpoint = store.get(checkpointId);
  if (!checkpoint) {
    return { type: 'chat', filesReverted: 0, messagesRemoved: 0, checkpointsRemoved: 0 };
  }

  const messageIdx = checkpoint.messageIndex;

  // Truncate chat histories
  const removedMessages = agentHistory.length - messageIdx;
  agentHistory.length = Math.min(agentHistory.length, messageIdx);
  simpleMessages.length = Math.min(simpleMessages.length, Math.ceil(messageIdx / 2));

  // Remove checkpoints after this one
  const removedCheckpoints = store.truncateAfter(checkpointId);

  return {
    type: 'chat',
    filesReverted: 0,
    messagesRemoved: Math.max(0, removedMessages),
    checkpointsRemoved: removedCheckpoints.length,
  };
}

/**
 * Revert code changes from a checkpoint onwards. Chat history remains.
 */
export function revertCodeOnly(
  checkpointId: number,
  store: CheckpointStore,
): RevertResult {
  const checkpointsAfter = store.getFrom(checkpointId);
  let filesReverted = 0;

  // Collect all file changes from this checkpoint onwards, in reverse order
  const revertActions: Array<{ path: string; content: string | null }> = [];
  const seen = new Set<string>();

  // Walk backwards so the earliest "before" state wins for each file
  for (let i = checkpointsAfter.length - 1; i >= 0; i--) {
    const cp = checkpointsAfter[i];
    if (!cp.fileSnapshots) continue;

    for (const snap of cp.fileSnapshots) {
      if (!seen.has(snap.path)) {
        seen.add(snap.path);
        revertActions.push({ path: snap.path, content: snap.contentBefore });
      }
    }
  }

  // Apply reverts
  for (const action of revertActions) {
    try {
      if (action.content === null) {
        // File didn't exist before — for safety, we don't delete, just note it
        // Don't count as reverted since we didn't actually restore anything
      } else {
        writeFileSync(action.path, action.content, 'utf-8');
        filesReverted++;
      }
    } catch {
      // Best effort
    }
  }

  // Remove checkpoints after this one (keep the target checkpoint)
  const removed = store.truncateAfter(checkpointId);

  return {
    type: 'code',
    filesReverted,
    messagesRemoved: 0,
    checkpointsRemoved: removed.length,
  };
}

/**
 * Revert both chat and code to a checkpoint.
 */
export function revertBoth(
  checkpointId: number,
  store: CheckpointStore,
  agentHistory: ToolMessage[],
  simpleMessages: Array<{ role: string; content: string }>,
): RevertResult {
  // Revert code first
  const codeResult = revertCodeOnly(checkpointId, store);

  // Then revert chat (checkpoints already truncated by codeResult)
  const checkpoint = store.get(checkpointId);
  if (checkpoint) {
    const messageIdx = checkpoint.messageIndex;
    const removedMessages = agentHistory.length - messageIdx;
    agentHistory.length = Math.min(agentHistory.length, messageIdx);
    simpleMessages.length = Math.min(simpleMessages.length, Math.ceil(messageIdx / 2));

    return {
      type: 'both',
      filesReverted: codeResult.filesReverted,
      messagesRemoved: Math.max(0, removedMessages),
      checkpointsRemoved: codeResult.checkpointsRemoved,
    };
  }

  return {
    type: 'both',
    filesReverted: codeResult.filesReverted,
    messagesRemoved: 0,
    checkpointsRemoved: codeResult.checkpointsRemoved,
  };
}

/**
 * Capture file snapshots before a tool executes.
 * Returns snapshots for tools that modify files.
 */
export function captureFileSnapshots(
  toolName: string,
  input: Record<string, unknown>,
  projectRoot: string,
): FileSnapshot[] | undefined {
  // Only capture for file-modifying tools
  if (toolName !== 'write_file' && toolName !== 'edit_file') {
    return undefined;
  }

  const relPath = String(input.path ?? '');
  if (!relPath) return undefined;

  const absPath = resolve(projectRoot, relPath);
  let contentBefore: string | null = null;

  try {
    if (existsSync(absPath)) {
      contentBefore = readFileSync(absPath, 'utf-8');
    }
  } catch {
    // Can't read, that's ok
  }

  // contentAfter will be filled after the tool runs
  return [{
    path: absPath,
    contentBefore,
    contentAfter: '', // placeholder — filled after execution
  }];
}

/**
 * Fill in the "after" content for snapshots after tool execution.
 */
export function fillSnapshotAfter(snapshots: FileSnapshot[] | undefined): void {
  if (!snapshots) return;

  for (const snap of snapshots) {
    try {
      if (existsSync(snap.path)) {
        snap.contentAfter = readFileSync(snap.path, 'utf-8');
      }
    } catch {
      // Best effort
    }
  }
}
