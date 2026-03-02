import { NextResponse } from 'next/server';
import { generateMetadata } from '@/lib/saml-provider';

export async function GET() {
  const xml = generateMetadata();
  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
}
