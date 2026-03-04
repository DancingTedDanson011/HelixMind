'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Github } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { GoogleIcon } from '@/components/ui/icons/GoogleIcon';

export function RegisterForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t('registrationFailed'));
      setLoading(false);
      return;
    }

    // Auto-login after registration
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(t('accountCreatedLoginFailed'));
      setLoading(false);
    } else {
      router.push('/app');
    }
  };

  return (
    <GlassPanel intensity="strong" className="w-full max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">{t('register')}</h1>

      {/* OAuth Buttons */}
      <div className="space-y-3 mb-6">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => signIn('google', { callbackUrl: `/${locale}/app` })}
        >
          <GoogleIcon />
          {t('google')}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => signIn('github', { callbackUrl: `/${locale}/app` })}
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
          id="name"
          label={t('name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          required
        />
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
          {t('register')}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t('hasAccount')}{' '}
        <Link href="/auth/login" className="text-primary hover:underline">
          {t('login')}
        </Link>
      </p>
    </GlassPanel>
  );
}
