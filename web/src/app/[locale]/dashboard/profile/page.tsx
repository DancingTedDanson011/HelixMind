import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ProfileEditor } from '@/components/dashboard/ProfileEditor';

export default async function ProfilePage() {
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
      <ProfileEditor
        user={{
          name: user.name,
          email: user.email,
          locale: user.locale,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        }}
      />
    </DashboardLayout>
  );
}
