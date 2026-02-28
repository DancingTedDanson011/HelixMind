'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/providers/ToastProvider';
import { Key, Trash2, Save, Eye, EyeOff } from 'lucide-react';

interface LLMKey {
  id: string;
  provider: string;
  keyHint: string;
  updatedAt: string;
}

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic (Claude)', prefix: 'sk-ant-', placeholder: 'sk-ant-api03-...' },
  { id: 'openai', name: 'OpenAI', prefix: 'sk-', placeholder: 'sk-proj-...' },
] as const;

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function LLMKeySettings() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<LLMKey[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/user/llm-keys');
      if (res.ok) setKeys(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleSave = async (provider: string) => {
    const apiKey = inputs[provider]?.trim();
    if (!apiKey) return;

    setSaving(provider);
    try {
      const res = await fetch('/api/user/llm-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      if (res.ok) {
        toast({ type: 'success', message: `${provider} key saved` });
        setInputs(prev => ({ ...prev, [provider]: '' }));
        await fetchKeys();
      } else {
        const data = await res.json();
        toast({ type: 'error', message: data.error || 'Failed to save key' });
      }
    } catch {
      toast({ type: 'error', message: 'Network error' });
    }
    setSaving(null);
  };

  const handleDelete = async (provider: string) => {
    setDeleting(provider);
    try {
      const res = await fetch(`/api/user/llm-keys?provider=${provider}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ type: 'success', message: `${provider} key removed` });
        await fetchKeys();
      }
    } catch {
      toast({ type: 'error', message: 'Failed to delete key' });
    }
    setDeleting(null);
  };

  return (
    <motion.div variants={item}>
      <GlassPanel>
        <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
          <Key size={16} className="text-primary" />
          LLM API Keys
        </h2>
        <p className="text-xs text-gray-500 mb-6">
          Add your own API keys to use brainstorm mode in the App without a CLI connection.
          Keys are encrypted and stored securely.
        </p>

        <div className="space-y-4">
          {PROVIDERS.map(provider => {
            const existing = keys.find(k => k.provider === provider.id);
            const inputVal = inputs[provider.id] || '';
            const isVisible = visible[provider.id] || false;

            return (
              <div key={provider.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-200">{provider.name}</h3>
                    {existing && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Current: <span className="text-gray-400 font-mono">{existing.keyHint}</span>
                        {' · '}Updated {new Date(existing.updatedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {existing && (
                    <button
                      onClick={() => handleDelete(provider.id)}
                      disabled={deleting === provider.id}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                      title="Remove key"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={isVisible ? 'text' : 'password'}
                      value={inputVal}
                      onChange={e => setInputs(prev => ({ ...prev, [provider.id]: e.target.value }))}
                      placeholder={existing ? 'Enter new key to update...' : provider.placeholder}
                      className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 pr-9 text-sm text-white font-mono placeholder-gray-600 outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
                    />
                    <button
                      onClick={() => setVisible(prev => ({ ...prev, [provider.id]: !isVisible }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSave(provider.id)}
                    loading={saving === provider.id}
                    disabled={!inputVal.trim()}
                  >
                    <Save size={14} />
                    {existing ? 'Update' : 'Save'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </motion.div>
  );
}
