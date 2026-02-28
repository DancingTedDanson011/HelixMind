'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/providers/ToastProvider';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  X,
  AlertTriangle,
  Clock,
  Shield,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes?: string[];
  createdAt: string;
  lastUsed?: string | null;
}

interface ApiKeyManagerFullProps {
  apiKeys?: ApiKey[];
}

/* ─── Mock Data ───────────────────────────────── */

const mockKeys: ApiKey[] = [
  {
    id: '1',
    name: 'production',
    keyPrefix: 'hm_a3f8c2',
    scopes: ['read', 'write'],
    createdAt: '2026-01-15T10:30:00Z',
    lastUsed: '2026-02-27T08:12:00Z',
  },
  {
    id: '2',
    name: 'staging',
    keyPrefix: 'hm_7b2e91',
    scopes: ['read'],
    createdAt: '2026-02-01T14:00:00Z',
    lastUsed: '2026-02-26T16:45:00Z',
  },
  {
    id: '3',
    name: 'local-dev',
    keyPrefix: 'hm_e4d1f0',
    scopes: ['read'],
    createdAt: '2026-02-20T09:15:00Z',
    lastUsed: null,
  },
];

/* ─── Animation Variants ──────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/* ─── Helpers ─────────────────────────────────── */

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ─── Component ───────────────────────────────── */

export function ApiKeyManagerFull({ apiKeys: initialKeys }: ApiKeyManagerFullProps) {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys || mockKeys);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();

      if (data.key) {
        setCreatedKey(data.key);
        setKeys((prev) => [data.apiKey, ...prev]);
        setNewKeyName('');
        toast({ type: 'success', message: 'API key created successfully.' });
      }
    } catch {
      toast({ type: 'error', message: 'Failed to create API key.' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' });
      setKeys((prev) => prev.filter((k) => k.id !== id));
      setRevokeConfirm(null);
      toast({ type: 'success', message: 'API key revoked.' });
    } catch {
      toast({ type: 'error', message: 'Failed to revoke API key.' });
    }
  };

  const copyToClipboard = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setNewKeyName('');
    setCreatedKey(null);
    setCopied(false);
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Header ── */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage API keys for programmatic access.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={16} />
          Create New Key
        </Button>
      </motion.div>

      {/* ── Security Notice ── */}
      <motion.div variants={item}>
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-warning/5 border border-warning/15 text-sm">
          <Shield size={16} className="text-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-warning font-medium">Keep your keys secure</p>
            <p className="text-gray-400 mt-0.5">
              API keys grant access to your HelixMind account. Never share them publicly or commit them to version control.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Key List ── */}
      <motion.div variants={item}>
        <GlassPanel className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Key size={14} className="text-primary" />
              Active Keys
            </h2>
            <span className="text-xs text-gray-600">{keys.length} key{keys.length !== 1 ? 's' : ''}</span>
          </div>

          {keys.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Key size={32} className="mx-auto text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">No API keys yet</p>
              <p className="text-xs text-gray-600 mt-1">Create your first key to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                      <Key size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{key.name}</p>
                      <p className="text-xs font-mono text-gray-500">{key.keyPrefix}...</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock size={11} />
                        Created {formatDate(key.createdAt)}
                      </div>
                      <div className="text-gray-600 mt-0.5">
                        Last used: {timeAgo(key.lastUsed)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {key.scopes?.map((scope) => (
                        <Badge key={scope} variant="default">{scope}</Badge>
                      ))}
                    </div>

                    {/* Revoke */}
                    {revokeConfirm === key.id ? (
                      <div className="flex items-center gap-1">
                        <Button variant="danger" size="sm" onClick={() => handleRevoke(key.id)}>
                          Confirm
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRevokeConfirm(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setRevokeConfirm(key.id)}>
                        <Trash2 size={14} className="text-gray-500 hover:text-error" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </motion.div>

      {/* ── Create Key Modal ── */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeCreateModal}
            />

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md"
            >
              <GlassPanel intensity="strong" className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Key size={18} className="text-primary" />
                    {createdKey ? 'Key Created' : 'Create New API Key'}
                  </h3>
                  <button
                    onClick={closeCreateModal}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {createdKey ? (
                  // Show created key
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-warning/5 border border-warning/15">
                      <AlertTriangle size={14} className="text-warning mt-0.5 shrink-0" />
                      <p className="text-xs text-gray-400">
                        Copy this key now. It will not be shown again.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm text-white font-mono bg-surface p-2 rounded break-all">
                          {createdKey}
                        </code>
                        <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        </Button>
                      </div>
                    </div>

                    <Button variant="outline" className="w-full" onClick={closeCreateModal}>
                      Done
                    </Button>
                  </div>
                ) : (
                  // Create form
                  <div className="space-y-4">
                    <Input
                      id="key-name"
                      label="Key Name"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., production, staging, local-dev"
                    />
                    <div className="flex gap-2 pt-2">
                      <Button variant="ghost" className="flex-1" onClick={closeCreateModal}>
                        Cancel
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleCreate}
                        loading={creating}
                        disabled={!newKeyName.trim()}
                      >
                        <Plus size={14} />
                        Create Key
                      </Button>
                    </div>
                  </div>
                )}
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
