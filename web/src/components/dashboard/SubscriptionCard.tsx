'use client';

import { useState } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface SubscriptionCardProps {
  subscription: any;
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  };

  const plan = subscription?.plan || 'FREE';
  const status = subscription?.status || 'ACTIVE';

  return (
    <GlassPanel>
      <h2 className="text-lg font-semibold mb-6">Subscription</h2>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Current Plan</span>
          <Badge variant={plan === 'PRO' ? 'primary' : plan === 'TEAM' ? 'spiral' : 'default'}>
            {plan}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Status</span>
          <Badge variant={status === 'ACTIVE' ? 'success' : 'warning'}>
            {status}
          </Badge>
        </div>

        {subscription?.billingPeriod && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Billing</span>
            <span className="text-white text-sm">{subscription.billingPeriod}</span>
          </div>
        )}

        {subscription?.currentPeriodEnd && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Next billing</span>
            <span className="text-white text-sm">
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </span>
          </div>
        )}

        {subscription?.cancelAtPeriodEnd && (
          <Badge variant="warning">Cancels at period end</Badge>
        )}

        <div className="pt-4 border-t border-white/5">
          {plan !== 'FREE' ? (
            <Button variant="outline" onClick={openPortal} loading={loading}>
              Manage Subscription
            </Button>
          ) : (
            <Button onClick={() => window.location.href = '/pricing'}>
              Upgrade to Pro
            </Button>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}
