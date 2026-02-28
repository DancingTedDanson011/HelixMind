import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CliAuthorizePage } from '@/components/auth/CliAuthorizePage';

interface PageProps {
  searchParams: Promise<{
    callback_port?: string;
    state?: string;
    device_name?: string;
    device_os?: string;
  }>;
}

export default async function CliAuthPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await auth();

  // Build the callback URL to redirect back after login
  const currentParams = new URLSearchParams();
  if (params.callback_port) currentParams.set('callback_port', params.callback_port);
  if (params.state) currentParams.set('state', params.state);
  if (params.device_name) currentParams.set('device_name', params.device_name);
  if (params.device_os) currentParams.set('device_os', params.device_os);

  if (!session?.user) {
    const callbackUrl = `/auth/cli?${currentParams.toString()}`;
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20">
      <CliAuthorizePage
        callbackPort={params.callback_port ?? ''}
        state={params.state ?? ''}
        deviceName={params.device_name ?? 'Unknown Device'}
        deviceOs={params.device_os ?? 'Unknown OS'}
        userEmail={session.user.email ?? ''}
      />
    </div>
  );
}
