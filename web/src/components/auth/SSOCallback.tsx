'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';

type SSOStatus = 'loading' | 'success' | 'error';

interface SSOCallbackProps {
  error?: string | null;
  onSuccess?: () => void;
  redirectUrl?: string;
}

const errorMessages: Record<string, string> = {
  saml_missing_params: 'Missing SAML parameters',
  saml_invalid_state: 'Invalid login state',
  saml_invalid_team: 'Team not found',
  saml_not_configured: 'SSO is not configured for this team',
  saml_validation_failed: 'SAML validation failed',
  saml_domain_not_allowed: 'Your email domain is not allowed',
  saml_config: 'Server configuration error',
  saml_error: 'SSO login failed',
};

export function SSOCallback({ error, onSuccess, redirectUrl }: SSOCallbackProps) {
  const t = useTranslations('auth');
  const [status, setStatus] = useState<SSOStatus>(error ? 'error' : 'loading');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (error) {
      setStatus('error');
      return;
    }

    // Simulate brief loading then redirect
    const timer = setTimeout(() => {
      setStatus('success');
      onSuccess?.();

      // Redirect after success
      if (redirectUrl) {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1000);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [error, onSuccess, redirectUrl]);

  // Countdown for redirect on error (back to login)
  useEffect(() => {
    if (status === 'error' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (status === 'error' && countdown === 0) {
      window.location.href = '/auth/login';
    }
  }, [status, countdown]);

  const getErrorMessage = (errorCode: string) => {
    return errorMessages[errorCode] || t('ssoFailed');
  };

  return (
    <GlassPanel intensity="strong" className="w-full max-w-md mx-auto">
      <div className="flex flex-col items-center text-center py-4">
        {status === 'loading' && (
          <>
            <div className="p-4 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 mb-4">
              <Loader2 className="w-8 h-8 text-[#00d4ff] animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('ssoProcessing')}</h2>
            <p className="text-sm text-gray-500">{t('ssoProcessingDesc')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="p-4 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('ssoSuccess')}</h2>
            <p className="text-sm text-gray-500">{t('ssoSuccessDesc')}</p>
          </>
        )}

        {status === 'error' && error && (
          <>
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('ssoFailed')}</h2>
            <p className="text-sm text-red-400 mb-4">{getErrorMessage(error)}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <RefreshCw className="w-3 h-3" />
              <span>{t('ssoRedirecting', { seconds: countdown })}</span>
            </div>
          </>
        )}
      </div>
    </GlassPanel>
  );
}
