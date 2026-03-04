'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SSOCallback } from '@/components/auth/SSOCallback';
import { Loader2 } from 'lucide-react';

export default function SSOCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const [checked, setChecked] = useState(false);

  const error = searchParams.get('error');

  useEffect(() => {
    // If authenticated and no error, redirect to app
    if (status === 'authenticated' && !error) {
      router.push('/app');
      return;
    }
    setChecked(true);
  }, [status, error, router]);

  // Show loading while checking session
  if (!checked && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00d4ff] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20">
      <SSOCallback error={error} redirectUrl="/app" />
    </div>
  );
}
