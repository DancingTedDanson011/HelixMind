import { NextResponse } from 'next/server';

interface TelemetryPayload {
  installId: string;
  privacyLevel: number;
  helixmindVersion: string;
  nodeVersion: string;
  os: string;
  timestamp: number;
  toolUsage?: Record<string, number>;
  errorPatterns?: Record<string, number>;
  learnings?: unknown[];
  skillEffectiveness?: unknown[];
  completionRates?: Record<string, number>;
  agentOrchestrationPatterns?: unknown[];
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as TelemetryPayload;

    if (!payload.installId || typeof payload.privacyLevel !== 'number' || !payload.timestamp) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // TODO: persist to database — for now just log
    console.log(`[telemetry] Received payload from ${payload.installId} (level=${payload.privacyLevel}, v=${payload.helixmindVersion})`);

    return NextResponse.json({ ok: true, receivedAt: Date.now() });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

export async function GET() {
  // Community learnings endpoint
  const mockLearnings = [
    {
      category: 'tool_error',
      errorPattern: 'ENOENT: <path> not found',
      solution: 'Always check file existence with list_directory before write operations',
      context: 'write_file .ts',
      confidence: 0.95,
      tags: ['filesystem', 'write'],
    },
    {
      category: 'framework_gotcha',
      errorPattern: 'Cannot find module <path>',
      solution: 'Use .js extension in ESM imports even for TypeScript files',
      context: 'edit_file .ts',
      confidence: 0.92,
      tags: ['esm', 'typescript', 'imports'],
    },
    {
      category: 'project_pattern',
      errorPattern: 'SQLITE_BUSY: database is locked',
      solution: 'Use randomUUID() for test directory names to avoid SQLite locking conflicts',
      context: 'run_command .ts',
      confidence: 0.88,
      tags: ['sqlite', 'testing', 'windows'],
    },
  ];

  return NextResponse.json({ learnings: mockLearnings });
}
