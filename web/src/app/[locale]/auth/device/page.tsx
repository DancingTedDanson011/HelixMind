import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DeviceCodePage } from '@/components/auth/DeviceCodePage';

export default async function DeviceAuthPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=/auth/device');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20">
      <DeviceCodePage userEmail={session.user.email ?? ''} />
    </div>
  );
}
