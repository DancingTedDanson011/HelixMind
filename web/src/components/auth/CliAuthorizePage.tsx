'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Monitor, Shield, X } from 'lucide-react';

interface Props {
  callbackPort: string;
  state: string;
  deviceName: string;
  deviceOs: string;
  userEmail: string;
}

export function CliAuthorizePage({
  callbackPort,
  state,
  deviceName,
  deviceOs,
  userEmail,
}: Props) {
  const t = useTranslations('cliAuth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const port = parseInt(callbackPort, 10);
  const isValid = port >= 1024 && port <= 65535 && state.length > 0;

  async function handleAuthorize() {
    if (!isValid) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/cli/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          deviceName,
          deviceOs,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || data.error || t('error'));
        setLoading(false);
        return;
      }

      const data = await res.json();

      // Redirect to CLI callback server
      const params = new URLSearchParams({
        key: data.key,
        state: data.state,
        userId: data.userId || '',
        email: data.email || '',
        plan: data.plan || 'FREE',
      });

      window.location.href = `http://127.0.0.1:${port}/callback?${params.toString()}`;
    } catch {
      setError(t('error'));
      setLoading(false);
    }
  }

  function handleCancel() {
    if (isValid) {
      window.location.href = `http://127.0.0.1:${port}/cancel?state=${state}`;
    }
  }

  if (!isValid) {
    return (
      <GlassPanel intensity="strong" className="w-full max-w-md mx-auto text-center">
        <div className="text-red-400 mb-4">
          <X className="w-12 h-12 mx-auto" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{t('invalidRequest')}</h1>
        <p className="text-gray-400 text-sm">
          {t('invalidRequestDesc')}
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel intensity="strong" className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('title')}</h1>
        <p className="text-gray-400 text-sm">{t('description')}</p>
      </div>

      {/* Device Info */}
      <div className="rounded-lg bg-white/5 border border-white/10 p-4 mb-6 space-y-3">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-gray-400 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{t('deviceName')}</p>
            <p className="text-white text-sm font-medium">{decodeURIComponent(deviceName)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-gray-400 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{t('deviceOs')}</p>
            <p className="text-white text-sm font-medium">{decodeURIComponent(deviceOs)}</p>
          </div>
        </div>
      </div>

      {/* Logged in as */}
      <p className="text-center text-sm text-gray-400 mb-6">
        {t('loggedInAs')} <span className="text-primary font-medium">{userEmail}</span>
      </p>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-4">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={handleCancel}
          disabled={loading}
        >
          {t('cancel')}
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={handleAuthorize}
          loading={loading}
        >
          {t('authorize')}
        </Button>
      </div>
    </GlassPanel>
  );
}
