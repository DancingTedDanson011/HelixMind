'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Save, CreditCard, Coins, Zap, X, Plus,
  Check, Sparkles, Building2, Users,
} from 'lucide-react';

interface PlanConfig {
  id: string;
  plan: string;
  displayName: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  tokenLimit: number | null;
  maxApiKeys: number;
  features: string[];
  isActive: boolean;
  stripePriceMonthly: string | null;
  stripePriceYearly: string | null;
}

const planIcons: Record<string, typeof CreditCard> = {
  FREE: CreditCard,
  PRO: Sparkles,
  TEAM: Users,
  ENTERPRISE: Building2,
};

const planGradients: Record<string, string> = {
  FREE: 'from-gray-500/20 to-gray-600/5',
  PRO: 'from-primary/20 to-primary/5',
  TEAM: 'from-accent/20 to-accent/5',
  ENTERPRISE: 'from-warning/20 to-warning/5',
};

const planBorders: Record<string, string> = {
  FREE: 'border-gray-500/20 hover:border-gray-500/30',
  PRO: 'border-primary/20 hover:border-primary/30',
  TEAM: 'border-accent/20 hover:border-accent/30',
  ENTERPRISE: 'border-warning/20 hover:border-warning/30',
};

const planAccents: Record<string, string> = {
  FREE: 'text-gray-400',
  PRO: 'text-primary',
  TEAM: 'text-accent',
  ENTERPRISE: 'text-warning',
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' },
  }),
};

export function AdminPlans() {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<PlanConfig>>({});
  const [newFeature, setNewFeature] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/plans');
      const data = await res.json();
      setPlans(Array.isArray(data) ? data : []);
    } catch {
      // Keep state
    }
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const startEdit = (plan: PlanConfig) => {
    setEditing(plan.id);
    setEditData({ ...plan });
    setNewFeature('');
  };

  const savePlan = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch('/api/admin/plans', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing, ...editData }),
    });
    setSaving(false);
    setEditing(null);
    fetchPlans();
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    setEditData((prev) => ({
      ...prev,
      features: [...(prev.features || []), newFeature.trim()],
    }));
    setNewFeature('');
  };

  const removeFeature = (index: number) => {
    setEditData((prev) => ({
      ...prev,
      features: (prev.features || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <CreditCard size={18} className="text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-white">Plan Configuration</h2>
          <p className="text-sm text-gray-500">Configure pricing, token limits, and features per tier</p>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && plans.length === 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <GlassPanel key={i} className="animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="h-5 w-24 bg-white/5 rounded" />
                <div className="h-5 w-16 bg-white/5 rounded-full" />
              </div>
              <div className="h-8 w-20 bg-white/5 rounded mb-4" />
              <div className="space-y-2">
                {[...Array(3)].map((__, j) => (
                  <div key={j} className="h-4 bg-white/5 rounded w-3/4" />
                ))}
              </div>
            </GlassPanel>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && plans.length === 0 && (
        <GlassPanel className="text-center py-16">
          <CreditCard size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No plans configured yet</p>
          <p className="text-xs text-gray-600 mt-1">Run the seed script to initialize default plans</p>
        </GlassPanel>
      )}

      {/* Plan Cards */}
      <div className="grid lg:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              layout
            >
              <GlassPanel className={`border ${planBorders[plan.plan] || 'border-white/10'} transition-all duration-300`}>
                {/* Gradient top bar */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${planGradients[plan.plan] || ''} rounded-t-xl`} />

                {editing === plan.id ? (
                  /* ── Edit Mode ── */
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = planIcons[plan.plan] || CreditCard;
                          return <Icon size={18} className={planAccents[plan.plan]} />;
                        })()}
                        <h3 className="text-lg font-bold text-white">{plan.plan}</h3>
                      </div>
                      <Badge variant={plan.isActive ? 'success' : 'default'}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Display Name"
                        value={editData.displayName || ''}
                        onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                      />
                      <Input
                        label="Max API Keys"
                        type="number"
                        value={String(editData.maxApiKeys || 0)}
                        onChange={(e) => setEditData({ ...editData, maxApiKeys: parseInt(e.target.value) || 0 })}
                      />
                      <Input
                        label="Monthly Price"
                        type="number"
                        value={editData.monthlyPrice != null ? String(editData.monthlyPrice) : ''}
                        onChange={(e) => setEditData({ ...editData, monthlyPrice: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Custom"
                      />
                      <Input
                        label="Yearly Price"
                        type="number"
                        value={editData.yearlyPrice != null ? String(editData.yearlyPrice) : ''}
                        onChange={(e) => setEditData({ ...editData, yearlyPrice: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Custom"
                      />
                      <Input
                        label="Token Limit"
                        type="number"
                        value={editData.tokenLimit != null ? String(editData.tokenLimit) : ''}
                        onChange={(e) => setEditData({ ...editData, tokenLimit: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Unlimited"
                      />
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editData.isActive ?? true}
                            onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                            className="rounded border-white/10 bg-surface text-primary"
                          />
                          Active
                        </label>
                      </div>
                    </div>

                    {/* Stripe Price IDs */}
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Stripe Monthly Price ID"
                        value={editData.stripePriceMonthly || ''}
                        onChange={(e) => setEditData({ ...editData, stripePriceMonthly: e.target.value || null })}
                        placeholder="price_..."
                      />
                      <Input
                        label="Stripe Yearly Price ID"
                        value={editData.stripePriceYearly || ''}
                        onChange={(e) => setEditData({ ...editData, stripePriceYearly: e.target.value || null })}
                        placeholder="price_..."
                      />
                    </div>

                    {/* Features editor */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Features</label>
                      <div className="space-y-2">
                        {(editData.features || []).map((feat, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="flex items-center gap-2"
                          >
                            <span className="flex-1 text-sm text-gray-300 bg-white/5 px-3 py-1.5 rounded-lg">
                              {feat}
                            </span>
                            <button onClick={() => removeFeature(idx)} className="text-gray-500 hover:text-error transition-colors">
                              <X size={14} />
                            </button>
                          </motion.div>
                        ))}
                        <div className="flex gap-2">
                          <input
                            value={newFeature}
                            onChange={(e) => setNewFeature(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addFeature()}
                            placeholder="Add feature..."
                            className="flex-1 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                          <Button size="sm" variant="ghost" onClick={addFeature}>
                            <Plus size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button onClick={savePlan} loading={saving}>
                        <Save size={14} />
                        Save Changes
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  /* ── View Mode ── */
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        {(() => {
                          const Icon = planIcons[plan.plan] || CreditCard;
                          return (
                            <div className={`p-2 rounded-lg bg-white/5`}>
                              <Icon size={16} className={planAccents[plan.plan]} />
                            </div>
                          );
                        })()}
                        <div>
                          <h3 className="text-lg font-bold text-white">{plan.displayName}</h3>
                          <span className="text-[10px] text-gray-600 font-mono uppercase">{plan.plan}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={plan.isActive ? 'success' : 'default'}>
                          {plan.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(plan)}>
                          Edit
                        </Button>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="flex items-baseline gap-2 mb-5">
                      {plan.monthlyPrice != null ? (
                        <>
                          <span className={`text-3xl font-bold ${planAccents[plan.plan]}`}>
                            {plan.monthlyPrice}
                          </span>
                          <span className="text-gray-500 text-sm">/month</span>
                          {plan.yearlyPrice != null && (
                            <span className="text-xs text-gray-600 ml-2 bg-white/5 px-2 py-0.5 rounded-full">
                              {plan.yearlyPrice}/year
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xl font-bold text-gray-400">Custom Pricing</span>
                      )}
                    </div>

                    {/* Limits row */}
                    <div className="flex gap-4 mb-5 text-xs">
                      <div className="flex items-center gap-1.5 bg-white/[0.03] px-3 py-1.5 rounded-lg">
                        <Coins size={12} className="text-warning" />
                        <span className="text-gray-400">
                          {plan.tokenLimit ? plan.tokenLimit.toLocaleString() + ' tokens' : 'Unlimited'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white/[0.03] px-3 py-1.5 rounded-lg">
                        <Zap size={12} className="text-primary" />
                        <span className="text-gray-400">
                          {plan.maxApiKeys} API key{plan.maxApiKeys !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Features list */}
                    <div className="space-y-2">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-sm">
                          <Check size={14} className="text-success mt-0.5 flex-shrink-0" />
                          <span className="text-gray-300">{feat}</span>
                        </div>
                      ))}
                      {plan.features.length === 0 && (
                        <p className="text-xs text-gray-600 italic">No features configured</p>
                      )}
                    </div>

                    {/* Stripe IDs */}
                    {(plan.stripePriceMonthly || plan.stripePriceYearly) && (
                      <div className="mt-5 pt-3 border-t border-white/5 text-[10px] font-mono text-gray-600 space-y-0.5">
                        {plan.stripePriceMonthly && <p>Monthly: {plan.stripePriceMonthly}</p>}
                        {plan.stripePriceYearly && <p>Yearly: {plan.stripePriceYearly}</p>}
                      </div>
                    )}
                  </div>
                )}
              </GlassPanel>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
