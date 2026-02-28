'use client';

import { useState } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Copy, Check, Trash2, Plus } from 'lucide-react';

interface ApiKeyManagerProps {
  apiKeys: any[];
}

export function ApiKeyManager({ apiKeys: initialKeys }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createKey = async () => {
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
        setNewKey(data.key);
        setKeys((prev) => [data.apiKey, ...prev]);
        setNewKeyName('');
      }
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' });
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create new key */}
      <GlassPanel>
        <h2 className="text-lg font-semibold mb-4">API Keys</h2>
        <div className="flex gap-3">
          <Input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., production)"
            className="flex-1"
          />
          <Button onClick={createKey} loading={creating}>
            <Plus size={16} />
            Create
          </Button>
        </div>

        {newKey && (
          <div className="mt-4 p-3 rounded-lg bg-success/5 border border-success/20">
            <p className="text-xs text-success mb-2">
              Copy this key now — it won't be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-white font-mono bg-surface p-2 rounded">
                {newKey}
              </code>
              <Button variant="ghost" size="sm" onClick={copyKey}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          </div>
        )}
      </GlassPanel>

      {/* Key list */}
      <GlassPanel>
        <div className="space-y-3">
          {keys.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No API keys yet</p>
          ) : (
            keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5"
              >
                <div>
                  <p className="text-sm text-white font-medium">{key.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{key.keyPrefix}...</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{key.scopes?.join(', ') || 'read'}</Badge>
                  <Button variant="danger" size="sm" onClick={() => revokeKey(key.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
