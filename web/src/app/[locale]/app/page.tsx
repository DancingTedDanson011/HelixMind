import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/AppShell';

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; session?: string }>;
}) {
  const authSession = await auth();
  if (!authSession?.user) redirect('/auth/login');

  const params = await searchParams;

  return <AppShell initialTab={params.tab} initialSession={params.session} />;
}
