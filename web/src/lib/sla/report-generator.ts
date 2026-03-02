/**
 * SLA report generator — aggregates UptimeChecks into SlaReport records.
 * Run daily (or on-demand).
 */
import { prisma } from '../prisma';

export async function generateReport(periodDays = 30): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const checks = await prisma.uptimeCheck.findMany({
    where: { checkedAt: { gte: periodStart } },
    orderBy: { checkedAt: 'asc' },
  });

  if (checks.length === 0) return;

  const totalChecks = checks.length;
  const failedChecks = checks.filter(c => !c.healthy).length;
  const uptimePercent = ((totalChecks - failedChecks) / totalChecks) * 100;

  const responseTimes = checks.map(c => c.responseMs).sort((a, b) => a - b);
  const avgResponseMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const p95ResponseMs = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
  const p99ResponseMs = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;

  // Count incidents (consecutive failure runs)
  let incidentCount = 0;
  let inIncident = false;
  for (const check of checks) {
    if (!check.healthy && !inIncident) {
      incidentCount++;
      inIncident = true;
    } else if (check.healthy) {
      inIncident = false;
    }
  }

  await prisma.slaReport.upsert({
    where: { period },
    create: {
      period,
      uptimePercent,
      avgResponseMs,
      p95ResponseMs,
      p99ResponseMs,
      totalChecks,
      failedChecks,
      incidentCount,
    },
    update: {
      uptimePercent,
      avgResponseMs,
      p95ResponseMs,
      p99ResponseMs,
      totalChecks,
      failedChecks,
      incidentCount,
    },
  });
}

let reportInterval: NodeJS.Timeout | null = null;
let startupTimeout: NodeJS.Timeout | null = null;

export function startReportGenerator(intervalMs = 24 * 60 * 60 * 1000): void {
  if (reportInterval) return;

  // Generate initial report after 5 minutes
  startupTimeout = setTimeout(() => {
    generateReport().catch(console.error);
    reportInterval = setInterval(() => {
      generateReport().catch(console.error);
    }, intervalMs);
  }, 5 * 60 * 1000);

  console.log('[SLA] Report generator started');
}

export function stopReportGenerator(): void {
  if (startupTimeout) {
    clearTimeout(startupTimeout);
    startupTimeout = null;
  }
  if (reportInterval) {
    clearInterval(reportInterval);
    reportInterval = null;
  }
}
