import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const rateLimited = checkRateLimit(req, 'api/health', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
    });
  } catch (error) {
    // SECURITY (WIDE-WEB-004): never leak raw DB/connection errors to callers.
    // Log server-side and return a minimal status payload.
    console.error('Health check error:', error);
    return NextResponse.json(
      { status: 'error' },
      { status: 503 },
    );
  }
}
