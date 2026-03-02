import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Incident {
  startTime: string;
  endTime: string | null;
  durationMs: number;
  affectedEndpoints: string[];
  errors: string[];
}

export async function GET() {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const checks = await prisma.uptimeCheck.findMany({
      where: { checkedAt: { gte: ninetyDaysAgo } },
      orderBy: { checkedAt: 'asc' },
    });

    const incidents: Incident[] = [];
    let currentIncident: {
      startTime: Date;
      endTime: Date | null;
      endpoints: Set<string>;
      errors: Set<string>;
    } | null = null;

    for (const check of checks) {
      if (!check.healthy) {
        if (!currentIncident) {
          currentIncident = {
            startTime: check.checkedAt,
            endTime: null,
            endpoints: new Set([check.endpoint]),
            errors: new Set(check.errorMsg ? [check.errorMsg] : []),
          };
        } else {
          currentIncident.endTime = check.checkedAt;
          currentIncident.endpoints.add(check.endpoint);
          if (check.errorMsg) currentIncident.errors.add(check.errorMsg);
        }
      } else if (currentIncident) {
        // Incident ended
        const endTime = currentIncident.endTime || currentIncident.startTime;
        incidents.push({
          startTime: currentIncident.startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMs: endTime.getTime() - currentIncident.startTime.getTime(),
          affectedEndpoints: [...currentIncident.endpoints],
          errors: [...currentIncident.errors],
        });
        currentIncident = null;
      }
    }

    // If still in an incident at end of data
    if (currentIncident) {
      const endTime = currentIncident.endTime || currentIncident.startTime;
      incidents.push({
        startTime: currentIncident.startTime.toISOString(),
        endTime: null, // ongoing
        durationMs: Date.now() - currentIncident.startTime.getTime(),
        affectedEndpoints: [...currentIncident.endpoints],
        errors: [...currentIncident.errors],
      });
    }

    // Most recent first
    incidents.reverse();

    return NextResponse.json({ incidents });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch incidents', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
