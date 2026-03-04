import { handlers } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { checkRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

export const GET = handlers.GET;

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, 'auth/login', AUTH_RATE_LIMIT);
  if (limited) return limited;
  return handlers.POST(req);
}
