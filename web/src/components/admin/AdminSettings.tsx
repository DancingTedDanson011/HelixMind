'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Save, Eye, EyeOff, Plus, Trash2, KeyRound,
  Shield, Mail, CreditCard, Settings, Lock,
} from 'lucide-react';

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  label: string;
  description: string | null;
  isSecret: boolean;
  hasValue: boolean;
  updatedAt: string;
}

const categoryConfig: Record<string, { label: string; color: string; icon: typeof Settings }> = {
  auth: { label: 'Authentication', color: 'text-accent', icon: Shield },
  payments: { label: 'Payments', color: 'text-success', icon: CreditCard },
  email: { label: 'Email', color: 'text-primary', icon: Mail },
  general: { label: 'General', color: 'text-gray-400', icon: Settings },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4 },
  }),
};

export function AdminSettings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newLabel, setNewLabel] = useState('');
  const [newIsSecret, setNewIsSecret] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      setSettings(Array.isArray(data) ? data : []);
    } catch {
      // Keep state
    }
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const saveSetting = async (key: string) => {
    const value = editValues[key];
    if (value === undefined) return;

    setSaving(key);
    const existing = settings.find((s) => s.key === key);
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        value,
        category: existing?.category,
        label: existing?.label,
        isSecret: existing?.isSecret,
      }),
    });
    setSaving(null);
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    fetchSettings();
  };

  const addSetting = async () => {
    if (!newKey || !newValue) return;
    setSaving('new');
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: newKey,
        value: newValue,
        category: newCategory,
        label: newLabel || newKey,
        isSecret: newIsSecret,
      }),
    });
    setSaving(null);
    setShowAddForm(false);
    setNewKey('');
    setNewValue('');
    setNewLabel('');
    setNewIsSecret(false);
    fetchSettings();
  };

  const deleteSetting = async (key: string) => {
    await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
    fetchSettings();
  };

  // Group by category
  const grouped = settings.reduce((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  const categoryOrder = ['auth', 'payments', 'email', 'general'];
  const sortedCategories = Object.entries(grouped).sort(
    ([a], [b]) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-white">System Settings</h2>
            <p className="text-sm text-gray-500">Manage API keys, secrets, and configuration</p>
          </div>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} size="sm">
          <Plus size={14} />
          Add Setting
        </Button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <GlassPanel className="space-y-4 border border-primary/10">
              <div className="flex items-center gap-2 mb-2">
                <Plus size={14} className="text-primary" />
                <h3 className="font-medium text-white">New Setting</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  label="Key"
                  placeholder="MY_API_KEY"
                />
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  label="Display Name"
                  placeholder="My API Key"
                />
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  label="Value"
                  placeholder="Enter value..."
                  type={newIsSecret ? 'password' : 'text'}
                />
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="auth">Authentication</option>
                    <option value="payments">Payments</option>
                    <option value="email">Email</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsSecret}
                  onChange={(e) => setNewIsSecret(e.target.checked)}
                  className="rounded border-white/10 bg-surface text-primary"
                />
                <Lock size={12} className="text-warning" />
                Secret value (will be masked in UI)
              </label>
              <div className="flex gap-3">
                <Button onClick={addSetting} loading={saving === 'new'} size="sm">
                  <Save size={14} />
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      {loading && settings.length === 0 && (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <GlassPanel key={i} className="animate-pulse">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4 bg-white/5 rounded" />
                <div className="h-4 w-28 bg-white/5 rounded" />
              </div>
              <div className="space-y-3">
                {[...Array(2)].map((__, j) => (
                  <div key={j} className="h-12 bg-white/5 rounded-lg" />
                ))}
              </div>
            </GlassPanel>
          ))}
        </div>
      )}

      {/* Settings grouped by category */}
      {sortedCategories.map(([category, items], i) => {
        const config = categoryConfig[category] || categoryConfig.general;
        const Icon = config.icon;

        return (
          <motion.div
            key={category}
            custom={i}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <GlassPanel>
              <div className="flex items-center gap-2 mb-5">
                <div className={`p-1.5 rounded-lg bg-white/5`}>
                  <Icon size={14} className={config.color} />
                </div>
                <h3 className="font-semibold text-white">
                  {config.label}
                </h3>
                <Badge>{items.length}</Badge>
              </div>

              <div className="space-y-3">
                {items.map((setting) => (
                  <motion.div
                    key={setting.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-white">{setting.label}</p>
                        {setting.isSecret && (
                          <Badge variant="warning" className="text-[10px]">
                            <Lock size={8} className="mr-0.5" />
                            Secret
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-mono">{setting.key}</p>
                      {setting.description && (
                        <p className="text-xs text-gray-500 mt-1">{setting.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:w-80 flex-shrink-0">
                      <div className="flex-1 relative">
                        <input
                          type={setting.isSecret && !showSecrets[setting.key] ? 'password' : 'text'}
                          value={editValues[setting.key] ?? (setting.isSecret ? '' : setting.value)}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                          placeholder={setting.hasValue ? (setting.isSecret ? setting.value : setting.value) : 'Not configured'}
                          className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 hover:border-white/20 transition-colors"
                        />
                      </div>
                      {setting.isSecret && (
                        <button
                          onClick={() => setShowSecrets((prev) => ({ ...prev, [setting.key]: !prev[setting.key] }))}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                          title={showSecrets[setting.key] ? 'Hide value' : 'Show value'}
                        >
                          {showSecrets[setting.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                      <AnimatePresence>
                        {editValues[setting.key] !== undefined && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                          >
                            <Button
                              size="sm"
                              onClick={() => saveSetting(setting.key)}
                              loading={saving === setting.key}
                            >
                              <Save size={12} />
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <button
                        onClick={() => deleteSetting(setting.key)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-error hover:bg-error/5 transition-colors"
                        title="Delete setting"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassPanel>
          </motion.div>
        );
      })}

      {/* Empty state */}
      {!loading && settings.length === 0 && (
        <GlassPanel className="text-center py-16">
          <KeyRound size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No settings configured yet</p>
          <p className="text-xs text-gray-600 mt-1">Click "Add Setting" above or run the seed script to initialize defaults</p>
        </GlassPanel>
      )}
    </motion.div>
  );
}
