import { NextResponse } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUID_RE = /^[a-z0-9]{20,30}$/;
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

/** Validate a UUID string */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Validate a CUID string (Prisma default) */
export function isCuid(value: string): boolean {
  return CUID_RE.test(value);
}

/** Validate a safe ID (alphanumeric, dash, underscore) */
export function isSafeId(value: string): boolean {
  return SAFE_ID_RE.test(value);
}

/**
 * Validate a route param as a valid ID (UUID or CUID).
 * Returns a 400 response if invalid, null if valid.
 */
export function validateId(id: string, label = 'id'): NextResponse | null {
  if (!id || (!isUuid(id) && !isCuid(id) && !isSafeId(id))) {
    return NextResponse.json({ error: `Invalid ${label}` }, { status: 400 });
  }
  return null;
}

/**
 * Validate a route param as a strict UUID.
 * Returns a 400 response if invalid, null if valid.
 */
export function validateUuid(id: string, label = 'id'): NextResponse | null {
  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: `Invalid ${label}` }, { status: 400 });
  }
  return null;
}
