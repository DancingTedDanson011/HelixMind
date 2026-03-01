/**
 * Cross-process Jarvis instance lock.
 * Uses a shared JSON file (~/.helixmind/jarvis-instances.json) to coordinate
 * how many Jarvis daemons can run simultaneously across independent CLI processes.
 *
 * Dead PIDs are cleaned up automatically on every read.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
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
  writeFileSync(LOCK_PATH, JSON.stringify(data, null, 2), 'utf-8');
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
}

/**
 * Release this process's Jarvis slot.
 * Safe to call multiple times.
 */
export function releaseJarvisSlot(): void {
  const data = readLock();
  data.instances = data.instances.filter(s => s.pid !== process.pid);
  writeLock(data);
}

/**
 * Get count of currently active (alive) Jarvis instances.
 */
export function getActiveJarvisCount(): number {
  const data = cleanupDead(readLock());
  writeLock(data); // persist cleanup
  return data.instances.length;
}
