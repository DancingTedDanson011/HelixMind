import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/AppShell';

export default async function AppPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');

  return <AppShell />;
}
