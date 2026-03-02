/**
 * Health check loop — runs every 60s.
 * Checks: /api/health endpoint + database connectivity.
 * Writes results to UptimeCheck table.
 * Alerts on 3+ consecutive failures (logs to console).
 */
import { prisma } from '../prisma';

const ENDPOINTS = [
  { name: '/api/health', url: '/api/health' },
];

let consecutiveFailures = 0;
let checkInterval: NodeJS.Timeout | null = null;
let startupTimeout: NodeJS.Timeout | null = null;

async function checkEndpoint(endpoint: { name: string; url: string }, baseUrl: string) {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${endpoint.url}`, {
      signal: AbortSignal.timeout(10000),
    });
    const responseMs = Date.now() - start;
    const healthy = res.status >= 200 && res.status < 400;

    await prisma.uptimeCheck.create({
      data: {
        endpoint: endpoint.name,
        status: res.status,
        responseMs,
        healthy,
      },
    });

    if (healthy) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
    }

    return healthy;
  } catch (error) {
    const responseMs = Date.now() - start;
    consecutiveFailures++;

    await prisma.uptimeCheck.create({
      data: {
        endpoint: endpoint.name,
        status: 0,
        responseMs,
        healthy: false,
        errorMsg: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return false;
  }
}

async function checkDatabase() {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseMs = Date.now() - start;

    await prisma.uptimeCheck.create({
      data: {
        endpoint: 'database',
        status: 200,
        responseMs,
        healthy: true,
      },
    });
    return true;
  } catch (error) {
    const responseMs = Date.now() - start;

    await prisma.uptimeCheck.create({
      data: {
        endpoint: 'database',
        status: 0,
        responseMs,
        healthy: false,
        errorMsg: error instanceof Error ? error.message : 'DB unreachable',
      },
    });
    return false;
  }
}

async function runChecks() {
  const baseUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;

  for (const endpoint of ENDPOINTS) {
    await checkEndpoint(endpoint, baseUrl);
  }
  await checkDatabase();

  if (consecutiveFailures >= 3) {
    console.error(`[SLA] ALERT: ${consecutiveFailures} consecutive health check failures!`);
  }
}

export function startUptimeChecker(intervalMs = 60_000): void {
  if (checkInterval) return;

  // Initial delay of 30s to let the server start up
  startupTimeout = setTimeout(() => {
    runChecks().catch(console.error);
    checkInterval = setInterval(() => {
      runChecks().catch(console.error);
    }, intervalMs);
  }, 30_000);

  console.log(`[SLA] Uptime checker started (interval: ${intervalMs}ms)`);
}

export function stopUptimeChecker(): void {
  if (startupTimeout) {
    clearTimeout(startupTimeout);
    startupTimeout = null;
  }
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
