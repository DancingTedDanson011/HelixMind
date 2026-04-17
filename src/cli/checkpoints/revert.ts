import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Checkpoint, FileSnapshot } from './store.js';
import type { CheckpointStore } from './store.js';
import type { ToolMessage } from '../providers/types.js';

export interface RevertResult {
  type: 'chat' | 'code' | 'both';
  filesReverted: number;
  filesNotReverted: number;
  failures: Array<{ path: string; error: string }>;
  messagesRemoved: number;
  checkpointsRemoved: number;
}

// FIX: CHECKPOINT-003 — detect binary content via null-byte scan in first 8 KB.
// Previously every file was read/written as UTF-8, which permanently corrupted
// any non-text file (images, archives, wasm, compiled artifacts) on revert.
function isBinaryBuffer(buf: Buffer): boolean {
  const end = Math.min(buf.length, 8192);
  for (let i = 0; i < end; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
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
    return {
      type: 'chat',
      filesReverted: 0,
      filesNotReverted: 0,
      failures: [],
      messagesRemoved: 0,
      checkpointsRemoved: 0,
    };
  }

  const messageIdx = checkpoint.messageIndex;

  // Truncate chat histories
  const removedMessages = agentHistory.length - messageIdx;
  agentHistory.length = Math.min(agentHistory.length, messageIdx);
  // FIX: CHECKPOINT-002 — prefer the checkpoint's own simpleMessageIndex when
  // present. Fall back to Math.ceil(messageIdx/2) for legacy checkpoints so
  // existing persisted data keeps its prior behavior. New checkpoints that
  // populate simpleMessageIndex get the exact truncation they asked for.
  const sIdx = (checkpoint as any).simpleMessageIndex;
  if (typeof sIdx === 'number' && Number.isInteger(sIdx) && sIdx >= 0) {
    simpleMessages.length = Math.min(simpleMessages.length, sIdx);
  } else {
    simpleMessages.length = Math.min(simpleMessages.length, Math.ceil(messageIdx / 2));
  }

  // Remove checkpoints after this one
  const removedCheckpoints = store.truncateAfter(checkpointId);

  return {
    type: 'chat',
    filesReverted: 0,
    filesNotReverted: 0,
    failures: [],
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
  let filesNotReverted = 0;
  const failures: Array<{ path: string; error: string }> = [];

  // Collect all file changes from this checkpoint onwards, in reverse order
  const revertActions: Array<{ path: string; content: string | Buffer | null; binary: boolean }> = [];
  const seen = new Set<string>();

  // Walk backwards so the earliest "before" state wins for each file
  for (let i = checkpointsAfter.length - 1; i >= 0; i--) {
    const cp = checkpointsAfter[i];
    if (!cp.fileSnapshots) continue;

    for (const snap of cp.fileSnapshots) {
      if (!seen.has(snap.path)) {
        seen.add(snap.path);
        // FIX: CHECKPOINT-003 — honor explicit binary snapshots.
        const binary = Boolean((snap as any).binary);
        const content = binary && typeof (snap as any).contentBeforeBase64 === 'string'
          ? Buffer.from((snap as any).contentBeforeBase64, 'base64')
          : snap.contentBefore;
        revertActions.push({ path: snap.path, content, binary });
      }
    }
  }

  // Apply reverts
  for (const action of revertActions) {
    try {
      if (action.content === null) {
        // FIX: CHECKPOINT-004 — newly-created files ARE removed on revert so
        // the user's disk state matches their mental model. Previously these
        // files silently survived and the user believed everything rolled back.
        if (existsSync(action.path)) {
          try {
            unlinkSync(action.path);
            filesReverted++;
          } catch (err) {
            filesNotReverted++;
            failures.push({ path: action.path, error: err instanceof Error ? err.message : String(err) });
          }
        } else {
          // File already gone — treat as success (idempotent).
        }
      } else if (Buffer.isBuffer(action.content)) {
        writeFileSync(action.path, action.content);
        filesReverted++;
      } else {
        writeFileSync(action.path, action.content, 'utf-8');
        filesReverted++;
      }
    } catch (err) {
      filesNotReverted++;
      failures.push({ path: action.path, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Remove checkpoints after this one (keep the target checkpoint)
  const removed = store.truncateAfter(checkpointId);

  return {
    type: 'code',
    filesReverted,
    filesNotReverted,
    failures,
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
    // FIX: CHECKPOINT-002 — same logic as revertChatOnly.
    const sIdx = (checkpoint as any).simpleMessageIndex;
    if (typeof sIdx === 'number' && Number.isInteger(sIdx) && sIdx >= 0) {
      simpleMessages.length = Math.min(simpleMessages.length, sIdx);
    } else {
      simpleMessages.length = Math.min(simpleMessages.length, messageIdx);
    }

    return {
      type: 'both',
      filesReverted: codeResult.filesReverted,
      filesNotReverted: codeResult.filesNotReverted,
      failures: codeResult.failures,
      messagesRemoved: Math.max(0, removedMessages),
      checkpointsRemoved: codeResult.checkpointsRemoved,
    };
  }

  return {
    type: 'both',
    filesReverted: codeResult.filesReverted,
    filesNotReverted: codeResult.filesNotReverted,
    failures: codeResult.failures,
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
  let contentBeforeBase64: string | undefined;
  let binary = false;

  try {
    if (existsSync(absPath)) {
      // FIX: CHECKPOINT-003 — read as Buffer so binary files survive the round-trip.
      const buf = readFileSync(absPath);
      if (isBinaryBuffer(buf)) {
        binary = true;
        contentBeforeBase64 = buf.toString('base64');
        contentBefore = ''; // placeholder — real data is in contentBeforeBase64
      } else {
        contentBefore = buf.toString('utf-8');
      }
    }
  } catch {
    // Can't read, that's ok
  }

  // contentAfter will be filled after the tool runs
  return [{
    path: absPath,
    contentBefore,
    contentAfter: '', // placeholder — filled after execution
    ...(binary ? { binary: true, contentBeforeBase64 } : {}),
  } as FileSnapshot];
}

/**
 * Fill in the "after" content for snapshots after tool execution.
 */
export function fillSnapshotAfter(snapshots: FileSnapshot[] | undefined): void {
  if (!snapshots) return;

  for (const snap of snapshots) {
    try {
      if (existsSync(snap.path)) {
        const buf = readFileSync(snap.path);
        if (isBinaryBuffer(buf)) {
          (snap as any).binary = true;
          (snap as any).contentAfterBase64 = buf.toString('base64');
          snap.contentAfter = '';
        } else {
          snap.contentAfter = buf.toString('utf-8');
        }
      }
    } catch {
      // Best effort
    }
  }
}
