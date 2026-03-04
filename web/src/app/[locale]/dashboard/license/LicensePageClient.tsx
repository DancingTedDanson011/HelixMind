'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { LicenseStatus } from '@/components/License/LicenseStatus';
import { LicenseActivation } from '@/components/License/LicenseActivation';
import { KeyRound, Shield, HelpCircle } from 'lucide-react';

export function LicensePageClient() {
  const [showActivation, setShowActivation] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleActivationSuccess = () => {
    setRefreshKey((k) => k + 1);
    setTimeout(() => setShowActivation(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <KeyRound size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">License Management</h1>
            <p className="text-sm text-gray-500">View and activate your HelixMind licenses</p>
          </div>
        </div>
        <Button onClick={() => setShowActivation(!showActivation)}>
          {showActivation ? 'View Status' : 'Activate License'}
        </Button>
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {showActivation ? (
          <motion.div
            key="activation"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <LicenseActivation
              onSuccess={handleActivationSuccess}
              onCancel={() => setShowActivation(false)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="status"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <LicenseStatus
              key={refreshKey}
              onActivateClick={() => setShowActivation(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassPanel className="p-4" intensity="subtle">
          <div className="flex items-start gap-3">
            <Shield size={18} className="text-primary mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-white mb-1">Secure Activation</h4>
              <p className="text-xs text-gray-500">
                Your license key is encrypted and securely validated. Each key can only be activated a limited number of times.
              </p>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-4" intensity="subtle">
          <div className="flex items-start gap-3">
            <HelpCircle size={18} className="text-secondary mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-white mb-1">Need Help?</h4>
              <p className="text-xs text-gray-500">
                Contact{' '}
                <a href="mailto:support@helixmind.ai" className="text-primary hover:underline">
                  support@helixmind.ai
                </a>{' '}
                for license recovery or questions about your subscription.
              </p>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
