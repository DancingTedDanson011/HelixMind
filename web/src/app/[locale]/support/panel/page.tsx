import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SupportPanel } from '@/components/support/SupportPanel';

export default async function SupportPanelPage() {
  const session = await auth();
  if (!session?.user || !['ADMIN', 'SUPPORT'].includes(session.user.role)) {
    redirect('/auth/staff');
  }

  return <SupportPanel />;
}
