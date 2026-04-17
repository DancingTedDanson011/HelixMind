/**
 * Cross-process Jarvis instance lock.
 * Uses a shared JSON file (~/.helixmind/jarvis-instances.json) to coordinate
 * how many Jarvis daemons can run simultaneously across independent CLI processes.
 *
 * Dead PIDs are cleaned up automatically on every read.
 */
import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  renameSync, openSync, closeSync, unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JarvisSlot {
  pid: number;
  cwd: string;
  startedAt: number;
}

interface LockFileData {
  instances: JarvisSlot[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOCK_DIR = join(homedir(), '.helixmind');
const LOCK_PATH = join(LOCK_DIR, 'jarvis-instances.json');
// FIX: JARVIS-HIGH-6 — O_EXCL sentinel file that guards read-modify-write
// sequences across processes. Only one process at a time may hold this FD.
const LOCK_SENTINEL = LOCK_PATH + '.excl';
const LOCK_MAX_WAIT_MS = 2_000;
const LOCK_RETRY_DELAY_MS = 25;

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLock(): LockFileData {
  if (!existsSync(LOCK_PATH)) return { instances: [] };
  try {
    const raw = readFileSync(LOCK_PATH, 'utf-8');
    const data: LockFileData = JSON.parse(raw);
    return { instances: Array.isArray(data.instances) ? data.instances : [] };
  } catch {
    return { instances: [] };
  }
}

function writeLock(data: LockFileData): void {
  mkdirSync(LOCK_DIR, { recursive: true });
  // FIX: JARVIS-HIGH-6 — atomic write via temp + rename. Same-filesystem
  // rename is atomic on POSIX and NTFS, so readers never observe a
  // partially written JSON blob.
  const tmp = `${LOCK_PATH}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  try {
    renameSync(tmp, LOCK_PATH);
  } catch (err) {
    // Clean up temp file on rename failure before rethrowing.
    try { unlinkSync(tmp); } catch { /* temp may already be gone */ }
    throw err;
  }
}

/**
 * FIX: JARVIS-HIGH-6 — cross-process lock using O_EXCL create.
 * Two CLI processes racing to register simultaneously could previously
 * clobber each other's JSON. We now serialize the read-modify-write with
 * an exclusive sentinel file held for the duration of the update.
 *
 * Returns an FD that must be passed to releaseSentinel() when done.
 * Returns null if the lock could not be acquired within the timeout
 * (caller should proceed best-effort rather than hang the daemon).
 */
function acquireSentinel(): number | null {
  mkdirSync(LOCK_DIR, { recursive: true });
  const deadline = Date.now() + LOCK_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      // 'wx' = O_CREAT | O_EXCL | O_WRONLY — fails if file exists.
      const fd = openSync(LOCK_SENTINEL, 'wx');
      return fd;
    } catch {
      // Another process holds the lock. Check whether the holder is alive;
      // if the sentinel is stale (process died with fd open before release),
      // remove it and try again on the next iteration.
      try {
        const raw = readFileSync(LOCK_SENTINEL, 'utf-8');
        const holderPid = parseInt(raw, 10);
        if (Number.isFinite(holderPid) && !isPidAlive(holderPid)) {
          try { unlinkSync(LOCK_SENTINEL); } catch { /* race — someone else cleaned up */ }
        }
      } catch { /* unreadable — skip stale check */ }

      // Busy-wait briefly. Deliberately synchronous — these call-sites are
      // setup/teardown paths where blocking is acceptable and simpler.
      const until = Date.now() + LOCK_RETRY_DELAY_MS;
      while (Date.now() < until) { /* spin */ }
    }
  }
  return null;
}

function releaseSentinel(fd: number): void {
  try { closeSync(fd); } catch { /* already closed */ }
  try { unlinkSync(LOCK_SENTINEL); } catch { /* already gone */ }
}

/**
 * Run a read-modify-write transaction on the lock file while holding the
 * cross-process sentinel. Falls back to the non-locked path only if the
 * sentinel cannot be acquired within LOCK_MAX_WAIT_MS (extremely rare;
 * better than hanging the user's Jarvis start).
 */
function withLockTransaction<T>(fn: () => T): T {
  const fd = acquireSentinel();
  try {
    // Best-effort: write the holder PID so stale-sentinel cleanup works.
    if (fd !== null) {
      try { writeFileSync(LOCK_SENTINEL, String(process.pid), 'utf-8'); } catch { /* non-fatal */ }
    }
    return fn();
  } finally {
    if (fd !== null) releaseSentinel(fd);
  }
}

/** Remove slots whose PID is no longer alive. */
function cleanupDead(data: LockFileData): LockFileData {
  const alive = data.instances.filter(s => isPidAlive(s.pid));
  return { instances: alive };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Try to acquire a Jarvis slot for this process.
 * Returns true if the slot was acquired, false if the limit is reached.
 */
export function acquireJarvisSlot(maxInstances: number, cwd: string): boolean {
  // FIX: JARVIS-HIGH-6 — serialized read-modify-write. Two racing CLI
  // processes can no longer both observe "slot available" and both write.
  return withLockTransaction(() => {
    if (maxInstances === Infinity) {
      // Unlimited — still register for tracking but never deny
      const data = cleanupDead(readLock());
      // Don't double-register same PID
      if (!data.instances.some(s => s.pid === process.pid)) {
        data.instances.push({ pid: process.pid, cwd, startedAt: Date.now() });
      }
      writeLock(data);
      return true;
    }

    const data = cleanupDead(readLock());

    // Already registered? (e.g. re-start in same process)
    if (data.instances.some(s => s.pid === process.pid)) {
      writeLock(data); // persist cleanup
      return true;
    }

    if (data.instances.length >= maxInstances) {
      writeLock(data); // persist cleanup even on deny
      return false;
    }

    data.instances.push({ pid: process.pid, cwd, startedAt: Date.now() });
    writeLock(data);
    return true;
  });
}

/**
 * Release this process's Jarvis slot.
 * Safe to call multiple times.
 */
export function releaseJarvisSlot(): void {
  // FIX: JARVIS-HIGH-6 — serialized release.
  withLockTransaction(() => {
    const data = readLock();
    data.instances = data.instances.filter(s => s.pid !== process.pid);
    writeLock(data);
  });
}

/**
 * Get count of currently active (alive) Jarvis instances.
 */
export function getActiveJarvisCount(): number {
  // FIX: JARVIS-HIGH-6 — serialized cleanup + count.
  return withLockTransaction(() => {
    const data = cleanupDead(readLock());
    writeLock(data); // persist cleanup
    return data.instances.length;
  });
}
