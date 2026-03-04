import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { LicensePageClient } from './LicensePageClient';

export default async function LicensePage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscription: true,
      teamMembers: {
        include: {
          team: {
            include: {
              licenses: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!user) redirect('/auth/login');

  const team = user.teamMembers[0]?.team;
  const license = team?.licenses[0];

  return (
    <DashboardLayout
      user={{
        name: user.name,
        email: user.email,
        plan: user.subscription?.plan || license?.plan || 'FREE',
      }}
    >
      <LicensePageClient />
    </DashboardLayout>
  );
}
