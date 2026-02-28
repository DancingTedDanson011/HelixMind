import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { BillingPanel } from '@/components/dashboard/BillingPanel';

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
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
      <BillingPanel
        user={{
          plan: user.subscription?.plan || 'FREE',
          status: user.subscription?.status || 'ACTIVE',
          billingPeriod: user.subscription?.billingPeriod || null,
          currentPeriodEnd: user.subscription?.currentPeriodEnd?.toISOString() || null,
          cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd || false,
        }}
      />
    </DashboardLayout>
  );
}
