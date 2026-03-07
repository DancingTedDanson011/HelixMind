'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = searchParams.get('token');

  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [teamRole, setTeamRole] = useState('');

  const acceptInvite = useCallback(async () => {
    if (!token || state === 'loading' || state === 'success') return;
    setState('loading');
    try {
      const res = await fetch('/api/teams/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to accept invite');
        setState('error');
        return;
      }
      setTeamRole(data.member?.role || 'MEMBER');
      setState('success');
    } catch {
      setError('Network error. Please try again.');
      setState('error');
    }
  }, [token, state]);

  useEffect(() => {
    if (status === 'authenticated' && token && state === 'idle') {
      acceptInvite();
    }
  }, [status, token, state, acceptInvite]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Invalid Invite Link</h1>
          <p className="text-gray-400">This invite link is missing a token. Please check the link from your email.</p>
          <button onClick={() => router.push('/auth/login')} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Accept Team Invite</h1>
          <p className="text-gray-400">Please log in to accept this team invitation.</p>
          <button
            onClick={() => router.push(`/auth/login?callbackUrl=${encodeURIComponent(`/invite/accept?token=${token}`)}`)}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
          >
            Log In to Accept
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        {state === 'loading' && (
          <>
            <h1 className="text-2xl font-bold text-white">Accepting Invite...</h1>
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">You&apos;re In!</h1>
            <p className="text-gray-400">You joined the team as <span className="text-cyan-400 font-medium">{teamRole}</span>.</p>
            <button onClick={() => router.push('/dashboard/team')} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors">
              Go to Team Dashboard
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Invite Failed</h1>
            <p className="text-gray-400">{error}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setState('idle'); setError(''); }} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                Try Again
              </button>
              <button onClick={() => router.push('/dashboard/team')} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors">
                Go to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
