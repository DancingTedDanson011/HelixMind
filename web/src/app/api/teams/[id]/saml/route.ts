import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTeamRole, requireEnterprisePlan } from '@/lib/team-auth';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import { z } from 'zod';

const samlConfigSchema = z.object({
  entityId: z.string().min(1),
  ssoUrl: z.string().url(),
  certificate: z.string().min(1),
  signatureAlgorithm: z.enum(['sha256', 'sha512']).optional().default('sha256'),
  emailAttribute: z.string().optional().default('email'),
  nameAttribute: z.string().optional().default('displayName'),
  roleAttribute: z.string().optional().nullable(),
  allowIdpInitiated: z.boolean().optional().default(false),
  enforceForTeam: z.boolean().optional().default(false),
});

// GET — return SAML config for team (ADMIN+ only, Enterprise plan)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/saml', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;
  const { id: teamId } = await params;

  const teamAuth = await requireTeamRole(teamId, 'OWNER', 'ADMIN');
  if (!teamAuth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isEnterprise = await requireEnterprisePlan(teamAuth.member.userId);
  if (!isEnterprise) {
    return NextResponse.json({ error: 'Enterprise plan required' }, { status: 403 });
  }

  const config = await prisma.samlConfig.findUnique({
    where: { teamId },
    select: {
      id: true,
      entityId: true,
      ssoUrl: true,
      certificate: true,
      signatureAlgorithm: true,
      emailAttribute: true,
      nameAttribute: true,
      roleAttribute: true,
      allowIdpInitiated: true,
      enforceForTeam: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ config });
}

// PUT — create or update SAML config (ADMIN+ only, Enterprise plan)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/saml', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;
  const { id: teamId } = await params;

  const teamAuth = await requireTeamRole(teamId, 'OWNER', 'ADMIN');
  if (!teamAuth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isEnterprise = await requireEnterprisePlan(teamAuth.member.userId);
  if (!isEnterprise) {
    return NextResponse.json({ error: 'Enterprise plan required' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = samlConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const data = {
    entityId: parsed.data.entityId,
    ssoUrl: parsed.data.ssoUrl,
    certificate: parsed.data.certificate,
    signatureAlgorithm: parsed.data.signatureAlgorithm,
    emailAttribute: parsed.data.emailAttribute,
    nameAttribute: parsed.data.nameAttribute,
    roleAttribute: parsed.data.roleAttribute ?? null,
    allowIdpInitiated: parsed.data.allowIdpInitiated,
    enforceForTeam: parsed.data.enforceForTeam,
  };

  const config = await prisma.samlConfig.upsert({
    where: { teamId },
    create: { teamId, ...data },
    update: data,
  });

  return NextResponse.json({ config });
}

// DELETE — remove SAML config (OWNER only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(req, 'api/teams/saml', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;
  const { id: teamId } = await params;

  const teamAuth = await requireTeamRole(teamId, 'OWNER');
  if (!teamAuth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.samlConfig.delete({ where: { teamId } }).catch(() => {});

  return NextResponse.json({ success: true });
}
