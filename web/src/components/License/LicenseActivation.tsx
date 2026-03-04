'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { KeyRound, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ActivationResult {
  valid: boolean;
  plan?: string;
  seats?: number;
  features?: string[];
  expiresAt?: string;
  error?: string;
}

interface LicenseActivationProps {
  onSuccess?: (result: ActivationResult) => void;
  onCancel?: () => void;
}

export function LicenseActivation({ onSuccess, onCancel }: LicenseActivationProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActivationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setError('Please enter a license key');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/license/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });

      const data = await res.json();
      setResult(data);

      if (data.valid) {
        onSuccess?.(data);
      } else {
        setError(data.error || 'Invalid license key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate license');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setLicenseKey('');
    setResult(null);
    setError(null);
  };

  return (
    <GlassPanel className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <KeyRound size={18} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Activate License</h3>
          <p className="text-sm text-gray-500">Enter your license key to activate</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="License Key"
          placeholder="HELIK-XXXX-XXXX-XXXX"
          value={licenseKey}
          onChange={(e) => {
            setLicenseKey(e.target.value.toUpperCase());
            setError(null);
          }}
          error={error || undefined}
          disabled={loading || result?.valid === true}
        />

        <AnimatePresence mode="wait">
          {/* Success State */}
          {result?.valid && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20"
            >
              <CheckCircle size={20} className="text-success" />
              <div className="flex-1">
                <p className="text-sm font-medium text-success">License Activated!</p>
                <p className="text-xs text-gray-400">
                  Plan: {result.plan} • {result.seats} seats • Expires: {result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {error && !result?.valid && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 p-4 rounded-lg bg-error/10 border border-error/20"
            >
              <AlertCircle size={20} className="text-error" />
              <div className="flex-1">
                <p className="text-sm font-medium text-error">Activation Failed</p>
                <p className="text-xs text-gray-400">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {result?.valid ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={handleReset}
                className="flex-1"
              >
                Activate Another
              </Button>
            </>
          ) : (
            <>
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancel}
                  disabled={loading}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={loading || !licenseKey.trim()}
                loading={loading}
                className="flex-1"
              >
                {loading ? 'Activating...' : 'Activate License'}
              </Button>
            </>
          )}
        </div>
      </form>

      {/* Help text */}
      <p className="text-xs text-gray-500 text-center">
        Lost your license key? Contact{' '}
        <a href="mailto:support@helixmind.ai" className="text-primary hover:underline">
          support@helixmind.ai
        </a>
      </p>
    </GlassPanel>
  );
}
