'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getPlanBadgeVariant } from '@/lib/plan-utils';
import { KeyRound, Calendar, Users, Zap, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface LicenseStatusData {
  active: boolean;
  plan: string;
  seats: number;
  features: string[];
  expiresAt: string | null;
  activations: number;
  maxActivations: number;
}

interface LicenseStatusProps {
  onActivateClick?: () => void;
}

export function LicenseStatus({ onActivateClick }: LicenseStatusProps) {
  const [status, setStatus] = useState<LicenseStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/license/status');
      if (!res.ok) {
        throw new Error('Failed to fetch license status');
      }
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  if (loading) {
    return (
      <GlassPanel className="p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </GlassPanel>
    );
  }

  if (error) {
    return (
      <GlassPanel className="p-6 border-error/30 bg-error/5">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-error" />
          <div>
            <p className="text-sm text-error font-medium">Failed to load license status</p>
            <p className="text-xs text-gray-500">{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="ml-auto">
            Retry
          </Button>
        </div>
      </GlassPanel>
    );
  }

  const isActive = status?.active && status.plan !== 'FREE';
  const daysUntilExpiry = status?.expiresAt
    ? Math.ceil((new Date(status.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <GlassPanel className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-success/10 border border-success/20' : 'bg-gray-500/10 border border-gray-500/20'}`}>
            {isActive ? (
              <CheckCircle size={18} className="text-success" />
            ) : (
              <KeyRound size={18} className="text-gray-400" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">License Status</h3>
            <p className="text-sm text-gray-500">
              {isActive ? 'Your license is active' : 'No active license'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          loading={refreshing}
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Status Grid */}
      {status && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {/* Plan */}
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-gray-500 mb-1">Plan</p>
            <Badge variant={getPlanBadgeVariant(status.plan)}>
              {status.plan}
            </Badge>
          </div>

          {/* Seats */}
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-gray-500 mb-1">Seats</p>
            <div className="flex items-center gap-1.5 text-white">
              <Users size={14} className="text-gray-400" />
              <span className="font-medium">{status.seats}</span>
            </div>
          </div>

          {/* Activations */}
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-gray-500 mb-1">Activations</p>
            <div className="text-white">
              <span className="font-medium">{status.activations}</span>
              <span className="text-gray-500"> / {status.maxActivations}</span>
            </div>
          </div>

          {/* Expires */}
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-gray-500 mb-1">Expires</p>
            {status.expiresAt ? (
              <div className="flex items-center gap-1.5 text-white">
                <Calendar size={14} className="text-gray-400" />
                <span className="font-medium">
                  {new Date(status.expiresAt).toLocaleDateString()}
                </span>
              </div>
            ) : (
              <span className="text-gray-500">--</span>
            )}
          </div>
        </motion.div>
      )}

      {/* Expiry Warning */}
      {isActive && daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertCircle size={16} className="text-warning" />
          <p className="text-sm text-warning">
            License expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Features */}
      {status?.features && status.features.length > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-2 flex items-center gap-2">
            <Zap size={14} />
            Included Features
          </p>
          <div className="flex flex-wrap gap-2">
            {status.features.map((feature) => (
              <span
                key={feature}
                className="px-2 py-1 rounded text-xs bg-primary/10 border border-primary/20 text-primary"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activate CTA */}
      {!isActive && onActivateClick && (
        <Button onClick={onActivateClick} className="w-full">
          <KeyRound size={16} />
          Activate License
        </Button>
      )}
    </GlassPanel>
  );
}
