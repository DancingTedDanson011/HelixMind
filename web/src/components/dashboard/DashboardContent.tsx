'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SubscriptionCard } from './SubscriptionCard';
import { ApiKeyManager } from './ApiKeyManager';
import { LayoutDashboard, CreditCard, Key, Settings } from 'lucide-react';

type Tab = 'overview' | 'subscription' | 'apiKeys' | 'settings';

interface DashboardContentProps {
  user: any;
}

const tabs: { key: Tab; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', icon: LayoutDashboard },
  { key: 'subscription', icon: CreditCard },
  { key: 'apiKeys', icon: Key },
  { key: 'settings', icon: Settings },
];

export function DashboardContent({ user }: DashboardContentProps) {
  const t = useTranslations('dashboard');
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-56 flex-shrink-0">
            <GlassPanel className="p-2 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    activeTab === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon size={16} />
                  {t(tab.key)}
                </button>
              ))}
            </GlassPanel>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'overview' && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <GlassPanel>
                  <p className="text-xs text-gray-500 mb-1">Plan</p>
                  <p className="text-xl font-bold text-white">{user.subscription?.plan || 'FREE'}</p>
                  <Badge variant={user.subscription?.plan === 'PRO' ? 'primary' : 'default'} className="mt-2">
                    {user.subscription?.status || 'ACTIVE'}
                  </Badge>
                </GlassPanel>
                <GlassPanel>
                  <p className="text-xs text-gray-500 mb-1">API Keys</p>
                  <p className="text-xl font-bold text-white">{user.apiKeys?.length || 0}</p>
                </GlassPanel>
                <GlassPanel>
                  <p className="text-xs text-gray-500 mb-1">Tickets</p>
                  <p className="text-xl font-bold text-white">{user._count?.tickets || 0}</p>
                </GlassPanel>
              </div>
            )}

            {activeTab === 'subscription' && (
              <SubscriptionCard subscription={user.subscription} />
            )}

            {activeTab === 'apiKeys' && (
              <ApiKeyManager apiKeys={user.apiKeys || []} />
            )}

            {activeTab === 'settings' && (
              <GlassPanel>
                <h2 className="text-lg font-semibold mb-4">{t('settings')}</h2>
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-gray-500">Name:</span>
                    <span className="ml-2 text-white">{user.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-2 text-white">{user.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Role:</span>
                    <Badge className="ml-2">{user.role}</Badge>
                  </div>
                </div>
              </GlassPanel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
