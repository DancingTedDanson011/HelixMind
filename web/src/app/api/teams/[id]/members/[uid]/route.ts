import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTeamRole } from '@/lib/team-auth';
import { z } from 'zod';

const patchSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; uid: string }> },
) {
  try {
    const { id, uid } = await params;
    const authResult = await requireTeamRole(id, 'OWNER', 'ADMIN');
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: id, userId: uid } },
    });
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    if (target.role === 'OWNER') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 403 });
    }

    const updated = await prisma.teamMember.update({
      where: { teamId_userId: { teamId: id, userId: uid } },
      data: { role: parsed.data.role },
    });

    return NextResponse.json({ member: { id: updated.id, role: updated.role } });
  } catch (error) {
    console.error('Member PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; uid: string }> },
) {
  try {
    const { id, uid } = await params;
    const authResult = await requireTeamRole(id, 'OWNER', 'ADMIN');
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: id, userId: uid } },
    });
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    if (target.role === 'OWNER') {
      return NextResponse.json({ error: 'Cannot remove team owner' }, { status: 403 });
    }

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId: id, userId: uid } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Member DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
