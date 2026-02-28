import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminPanel } from '@/components/admin/AdminPanel';

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || !['ADMIN', 'SUPPORT'].includes(session.user.role)) {
    redirect('/auth/staff');
  }

  return <AdminPanel userRole={session.user.role} />;
}
