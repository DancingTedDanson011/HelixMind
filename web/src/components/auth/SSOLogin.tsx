'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Shield, ArrowRight, AlertCircle } from 'lucide-react';

interface SSOLoginProps {
  teamId?: string;
  teamName?: string;
  onInitiate?: (teamId: string) => void;
}

export function SSOLogin({ teamId: initialTeamId, teamName, onInitiate }: SSOLoginProps) {
  const t = useTranslations('auth');
  const [teamId, setTeamId] = useState(initialTeamId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSSOLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId.trim()) {
      setError('Team ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch SAML auth URL for the team (public endpoint, no auth required)
      const res = await fetch('/api/auth/sso/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'SSO not available for this team');
        setLoading(false);
        return;
      }

      if (data.authUrl) {
        // Redirect to IdP
        onInitiate?.(teamId);
        window.location.href = data.authUrl;
      } else {
        setError('Failed to generate SSO login URL');
        setLoading(false);
      }
    } catch {
      setError('Failed to initiate SSO login');
      setLoading(false);
    }
  };

  return (
    <GlassPanel intensity="strong" className="w-full max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/20">
          <Shield className="w-5 h-5 text-[#00d4ff]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{t('ssoLogin')}</h1>
          <p className="text-xs text-gray-500">{t('ssoLoginDesc')}</p>
        </div>
      </div>

      {teamName && (
        <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-sm text-gray-400">{t('ssoLoggingInto')}</p>
          <p className="text-white font-medium">{teamName}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSSOLogin} className="space-y-4">
        {!initialTeamId && (
          <Input
            id="teamId"
            type="text"
            label={t('teamId')}
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            placeholder="Enter your team ID"
            required
          />
        )}

        <Button type="submit" className="w-full" loading={loading}>
          {t('ssoContinue')}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>

      <p className="text-center text-xs text-gray-500 mt-4">
        {t('ssoRedirectNote')}
      </p>
    </GlassPanel>
  );
}
