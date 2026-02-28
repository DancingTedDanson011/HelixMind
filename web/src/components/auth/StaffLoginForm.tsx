'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Shield, HeadphonesIcon } from 'lucide-react';

export function StaffLoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
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
      setError(t('staffLoginError'));
      setLoading(false);
      return;
    }

    // Check role after login — fetch session
    const sessionRes = await fetch('/api/auth/session');
    const session = await sessionRes.json();
    const role = session?.user?.role;

    if (role === 'ADMIN') {
      router.push('/admin');
    } else if (role === 'SUPPORT') {
      router.push('/support/panel');
    } else {
      // Not a staff member — sign out and show error
      await signIn('credentials', { redirect: false }); // noop to clear
      setError(t('staffNoAccess'));
      setLoading(false);
    }
  };

  return (
    <GlassPanel intensity="strong" className="w-full max-w-md mx-auto">
      {/* Staff Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/20">
          <Shield size={20} className="text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{t('staffLogin')}</h1>
          <p className="text-xs text-gray-500">{t('staffLoginDesc')}</p>
        </div>
      </div>

      {/* Role badges */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 rounded-lg border border-error/20 bg-error/5 p-3 text-center">
          <Shield size={16} className="text-error mx-auto mb-1" />
          <p className="text-xs font-medium text-error">Admin</p>
        </div>
        <div className="flex-1 rounded-lg border border-warning/20 bg-warning/5 p-3 text-center">
          <HeadphonesIcon size={16} className="text-warning mx-auto mb-1" />
          <p className="text-xs font-medium text-warning">Support</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="staff-email"
          type="email"
          label={t('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@helixmind.dev"
          required
        />
        <Input
          id="staff-password"
          type="password"
          label={t('password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          error={error}
        />

        <Button type="submit" className="w-full" loading={loading}>
          <Shield size={16} />
          {t('staffLogin')}
        </Button>
      </form>

      <p className="text-center text-xs text-gray-600 mt-6">
        {t('staffOnlyNotice')}
      </p>
    </GlassPanel>
  );
}
