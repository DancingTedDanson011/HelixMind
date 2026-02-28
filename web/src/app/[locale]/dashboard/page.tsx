import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DashboardHome } from '@/components/dashboard/DashboardHome';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscription: true,
      apiKeys: {
        where: { revokedAt: null },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { tickets: true, usageLogs: true } },
    },
  });

  if (!user) redirect('/auth/login');

  return (
    <DashboardLayout
      user={{
        name: user.name,
        email: user.email,
        plan: user.subscription?.plan || 'FREE',
      }}
    >
      <DashboardHome
        user={{
          name: user.name,
          email: user.email,
          plan: user.subscription?.plan || 'FREE',
          status: user.subscription?.status || 'ACTIVE',
          currentPeriodEnd: user.subscription?.currentPeriodEnd?.toISOString() || null,
          apiKeyCount: user.apiKeys?.length || 0,
          ticketCount: user._count?.tickets || 0,
          usageCount: user._count?.usageLogs || 0,
        }}
      />
    </DashboardLayout>
  );
}
