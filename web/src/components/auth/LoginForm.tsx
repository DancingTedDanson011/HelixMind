'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Github, Shield, AlertCircle } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { GoogleIcon } from '@/components/ui/icons/GoogleIcon';

const samlErrorMessages: Record<string, string> = {
  saml_missing_params: 'ssoErrorMissingParams',
  saml_invalid_state: 'ssoErrorInvalidState',
  saml_invalid_team: 'ssoErrorInvalidTeam',
  saml_not_configured: 'ssoErrorNotConfigured',
  saml_validation_failed: 'ssoErrorValidationFailed',
  saml_domain_not_allowed: 'ssoErrorDomainNotAllowed',
  saml_config: 'ssoErrorConfig',
  saml_error: 'ssoErrorGeneric',
};

export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || `/${locale}/app`;
  const samlError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSSOInput, setShowSSOInput] = useState(false);
  const [ssoTeamId, setSsoTeamId] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(t('invalidCredentials'));
      setLoading(false);
    } else {
      router.push(callbackUrl as any);
    }
  };

  const handleSSOLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssoTeamId.trim()) return;

    setSsoLoading(true);
    try {
      const res = await fetch(`/api/teams/${ssoTeamId}/saml/test`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'SSO not available for this team');
        setSsoLoading(false);
        return;
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError('Failed to generate SSO login URL');
        setSsoLoading(false);
      }
    } catch {
      setError('Failed to initiate SSO login');
      setSsoLoading(false);
    }
  };

  const getSSOErrorMessage = (errorCode: string) => {
    const key = samlErrorMessages[errorCode];
    return key ? t(key) : t('ssoErrorGeneric');
  };

  return (
    <GlassPanel intensity="strong" className="w-full max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">{t('login')}</h1>

      {/* SSO Error Display */}
      {samlError && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-400 font-medium">{t('ssoFailed')}</p>
            <p className="text-xs text-red-400/80 mt-1">{getSSOErrorMessage(samlError)}</p>
          </div>
        </div>
      )}

      {/* OAuth Buttons */}
      <div className="space-y-3 mb-6">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => signIn('google', { callbackUrl })}
        >
          <GoogleIcon />
          {t('google')}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => signIn('github', { callbackUrl })}
        >
          <Github size={16} />
          {t('github')}
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 border-t border-white/10" />
        <span className="text-xs text-gray-500">{t('orContinueWith')}</span>
        <div className="flex-1 border-t border-white/10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="email"
          type="email"
          label={t('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <Input
          id="password"
          type="password"
          label={t('password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          error={error}
        />

        <Button type="submit" className="w-full" loading={loading}>
          {t('login')}
        </Button>
      </form>

      {/* SSO Section */}
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 border-t border-white/10" />
          <span className="text-xs text-gray-500">{t('ssoOrTeam')}</span>
          <div className="flex-1 border-t border-white/10" />
        </div>

        {!showSSOInput ? (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setShowSSOInput(true)}
          >
            <Shield className="w-4 h-4" />
            {t('ssoLogin')}
          </Button>
        ) : (
          <form onSubmit={handleSSOLogin} className="space-y-3">
            <Input
              id="ssoTeamId"
              type="text"
              label={t('teamId')}
              value={ssoTeamId}
              onChange={(e) => setSsoTeamId(e.target.value)}
              placeholder={t('teamIdPlaceholder')}
              required
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" loading={ssoLoading}>
                {t('ssoContinue')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowSSOInput(false)}
              >
                {t('cancel')}
              </Button>
            </div>
          </form>
        )}
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t('noAccount')}{' '}
        <Link href="/auth/register" className="text-primary hover:underline">
          {t('register')}
        </Link>
      </p>
    </GlassPanel>
  );
}
