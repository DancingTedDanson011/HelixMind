'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { getPlanBadgeVariant } from '@/lib/plan-utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  KeyRound, Plus, Trash2, Copy, Check,
  Shield, Calendar, Users, Zap,
} from 'lucide-react';

interface License {
  id: string;
  key: string;
  plan: string;
  seats: number;
  features: string[];
  expiresAt: string;
  activatedAt: string | null;
  activations: number;
  maxActivations: number;
  createdAt: string;
  team: { id: string; name: string; slug: string } | null;
}

const AVAILABLE_FEATURES = [
  'brain-sync',
  'brain-api',
  'saml-sso',
  'priority-support',
  'custom-branding',
  'audit-log',
  'advanced-analytics',
  'unlimited-brains',
];



const tableRowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, duration: 0.3 },
  }),
};

export function LicenseManager() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Create form state
  const [seats, setSeats] = useState(10);
  const [maxActivations, setMaxActivations] = useState(1);
  const [plan, setPlan] = useState('ENTERPRISE');
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchLicenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/licenses');
      if (res.ok) {
        const data = await res.json();
        setLicenses(data.licenses);
      }
    } catch (err) {
      console.error('Failed to fetch licenses:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  const handleCreate = async () => {
    if (!expiresAt) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seats,
          features: selectedFeatures,
          expiresAt,
          maxActivations,
          plan,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        setShowCreate(false);
        setSeats(10);
        setMaxActivations(1);
        setPlan('ENTERPRISE');
        setExpiresAt('');
        setSelectedFeatures([]);
        fetchLicenses();
      }
    } catch (err) {
      console.error('Failed to create license:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this license?')) return;
    try {
      const res = await fetch(`/api/admin/licenses?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchLicenses();
      }
    } catch (err) {
      console.error('Failed to delete license:', err);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFeature = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature],
    );
  };

  const getStatus = (license: License) => {
    if (new Date(license.expiresAt) < new Date()) return 'expired';
    if (license.activations >= license.maxActivations) return 'maxed';
    if (license.activations > 0) return 'active';
    return 'unused';
  };

  const statusVariant: Record<string, 'default' | 'primary' | 'error' | 'warning'> = {
    active: 'primary',
    unused: 'default',
    expired: 'error',
    maxed: 'warning',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
            <KeyRound size={18} className="text-warning" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">License Management</h2>
            <p className="text-sm text-gray-500">
              {licenses.length} license{licenses.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="gap-2"
        >
          <Plus size={16} />
          Create License
        </Button>
      </div>

      {/* Created key banner */}
      <AnimatePresence>
        {createdKey && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <GlassPanel className="p-4 border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">
                    License created. Copy this key now -- it will not be shown again.
                  </p>
                  <code className="text-primary font-mono text-lg">{createdKey}</code>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleCopy(createdKey)}
                    variant="ghost"
                    className="gap-2"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    onClick={() => setCreatedKey(null)}
                    variant="ghost"
                    className="text-gray-500"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <GlassPanel className="p-6 space-y-4">
              <h3 className="text-lg font-medium text-white">New License</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Plan</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a1a] border border-white/10 text-white text-sm focus:border-primary/50 focus:outline-none"
                  >
                    <option value="ENTERPRISE">Enterprise</option>
                    <option value="TEAM">Team</option>
                    <option value="PRO">Pro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Seats</label>
                  <Input
                    type="number"
                    value={seats}
                    onChange={(e) => setSeats(parseInt(e.target.value) || 1)}
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Activations</label>
                  <Input
                    type="number"
                    value={maxActivations}
                    onChange={(e) => setMaxActivations(parseInt(e.target.value) || 1)}
                    min={1}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Expires At</label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Features</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_FEATURES.map((feature) => (
                    <button
                      key={feature}
                      onClick={() => toggleFeature(feature)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        selectedFeatures.includes(feature)
                          ? 'bg-primary/20 border-primary/40 text-primary'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {feature}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!expiresAt || creating}
                >
                  {creating ? 'Creating...' : 'Create License'}
                </Button>
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* License table */}
      <GlassPanel className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading licenses...</div>
        ) : licenses.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <KeyRound size={32} className="mx-auto mb-3 opacity-30" />
            <p>No licenses created yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Key</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Seats</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Activations</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Expires</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Team</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((license, i) => {
                  const status = getStatus(license);
                  return (
                    <motion.tr
                      key={license.id}
                      custom={i}
                      variants={tableRowVariants}
                      initial="hidden"
                      animate="visible"
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <code className="text-xs text-gray-300 font-mono">{license.key}</code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getPlanBadgeVariant(license.plan)}>
                          {license.plan}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-gray-300">
                          <Users size={13} className="text-gray-500" />
                          {license.seats}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {license.activations} / {license.maxActivations}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-gray-300">
                          <Calendar size={13} className="text-gray-500" />
                          {new Date(license.expiresAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {license.team?.name || '--'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[status] || 'default'}>
                          {status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(license.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-error hover:bg-error/10 transition-colors"
                          title="Delete license"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      {/* Features legend */}
      {licenses.some((l) => l.features.length > 0) && (
        <GlassPanel className="p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
            <Zap size={14} />
            Features in Use
          </h4>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(licenses.flatMap((l) => l.features))).map((feature) => (
              <span
                key={feature}
                className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10 text-gray-400"
              >
                {feature}
              </span>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}
