import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import { z } from 'zod';

const spawnSchema = z.object({
  directory: z.string().min(1).max(500),
});

// Track spawned instances to enforce limit
const spawnedPids = new Set<number>();

// Clean up dead processes periodically
function cleanupDeadPids() {
  for (const pid of spawnedPids) {
    try {
      // Signal 0 checks if process exists without killing it
      process.kill(pid, 0);
    } catch {
      spawnedPids.delete(pid);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Localhost check — only allow from local requests
    const forwarded = req.headers.get('x-forwarded-for');
    const host = req.headers.get('host') || '';
    const isLocal = !forwarded && (
      host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')
    );
    if (!isLocal) {
      return NextResponse.json({ error: 'Spawn only available from localhost' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = spawnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid directory' }, { status: 400 });
    }

    const { directory } = parsed.data;

    // Verify directory exists
    if (!existsSync(directory)) {
      return NextResponse.json({ error: 'Directory does not exist' }, { status: 400 });
    }
    const stat = statSync(directory);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
    }

    // Enforce max instances
    cleanupDeadPids();
    if (spawnedPids.size >= 5) {
      return NextResponse.json({ error: 'Maximum 5 concurrent instances' }, { status: 429 });
    }

    // Spawn helixmind CLI as detached process with brain server enabled
    const child = spawn('npx', ['helixmind', 'chat', '--brain'], {
      cwd: directory,
      detached: true,
      stdio: 'ignore',
      shell: true,
      env: { ...process.env },
    });

    if (!child.pid) {
      return NextResponse.json({ error: 'Failed to spawn process' }, { status: 500 });
    }

    // Unref so parent doesn't wait for child
    child.unref();
    spawnedPids.add(child.pid);

    // The CLI will pick a free port starting from 9420
    // Discovery scan will find it automatically
    return NextResponse.json({
      pid: child.pid,
      directory,
      message: 'Agent spawned — will appear in instance list shortly',
    });
  } catch (err) {
    console.error('[spawn] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
