'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Github } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { GoogleIcon } from '@/components/ui/icons/GoogleIcon';

export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || `/${locale}/app`;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <GlassPanel intensity="strong" className="w-full max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">{t('login')}</h1>

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

      <p className="text-center text-sm text-gray-500 mt-6">
        {t('noAccount')}{' '}
        <Link href="/auth/register" className="text-primary hover:underline">
          {t('register')}
        </Link>
      </p>
    </GlassPanel>
  );
}
