'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Monitor, CheckCircle, Terminal } from 'lucide-react';

interface Props {
  userEmail: string;
}

export function DeviceCodePage({ userEmail }: Props) {
  const t = useTranslations('cliAuth');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<{ deviceName: string; deviceOs: string } | null>(null);

  function handleCodeChange(value: string) {
    // Uppercase, strip non-alphanumeric except dash
    let clean = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    // Auto-insert dash after 4 chars
    if (clean.length === 4 && !clean.includes('-')) {
      clean = clean + '-';
    }
    // Limit to 9 chars (XXXX-XXXX)
    setCode(clean.slice(0, 9));
    setError('');
  }

  async function handleConfirm() {
    if (code.length < 9) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/device/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || data.error || t('deviceInvalid'));
        setLoading(false);
        return;
      }

      const data = await res.json();
      setDeviceInfo({ deviceName: data.deviceName, deviceOs: data.deviceOs });
      setSuccess(true);
    } catch {
      setError(t('deviceInvalid'));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <GlassPanel intensity="strong" className="w-full max-w-md mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('deviceSuccess')}</h1>
        {deviceInfo && (
          <div className="rounded-lg bg-white/5 border border-white/10 p-4 mt-4 space-y-2">
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{t('deviceName')}</p>
                <p className="text-white text-sm font-medium">{deviceInfo.deviceName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{t('deviceOs')}</p>
                <p className="text-white text-sm font-medium">{deviceInfo.deviceOs}</p>
              </div>
            </div>
          </div>
        )}
        <p className="text-gray-500 text-sm mt-4">
          You can close this tab.
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel intensity="strong" className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
          <Terminal className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('deviceTitle')}</h1>
        <p className="text-gray-400 text-sm">{t('deviceDescription')}</p>
      </div>

      {/* Code Input */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">{t('deviceCodeLabel')}</label>
        <input
          type="text"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder={t('deviceCodePlaceholder')}
          className="w-full text-center text-3xl font-mono font-bold tracking-[0.3em] bg-white/5 border border-white/10 rounded-lg px-4 py-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          maxLength={9}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
        />
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

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleConfirm}
        loading={loading}
        disabled={code.length < 9}
      >
        {t('deviceAuthorize')}
      </Button>
    </GlassPanel>
  );
}
