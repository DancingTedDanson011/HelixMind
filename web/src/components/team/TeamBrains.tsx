'use client';

import { useState, useEffect } from 'react';

interface SharedBrain {
  shareId: string;
  brainId: string;
  name: string;
  type: string;
  nodeCount: number;
  active: boolean;
  permission: string;
  sharedById: string;
  lastAccessedAt: string;
  createdAt: string;
}

interface UserBrain {
  id: string;
  name: string;
  type: string;
  nodeCount: number;
}

interface TeamBrainsProps {
  teamId: string;
  myRole: string;
  onUpdate: () => void;
}

export function TeamBrains({ teamId, myRole, onUpdate }: TeamBrainsProps) {
  const [brains, setBrains] = useState<SharedBrain[]>([]);
  const [userBrains, setUserBrains] = useState<UserBrain[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [selectedBrain, setSelectedBrain] = useState('');
  const [permission, setPermission] = useState('READ');
  const [loading, setLoading] = useState(true);
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  useEffect(() => {
    fetchBrains();
  }, [teamId]);

  async function fetchBrains() {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/brains`);
      if (res.ok) {
        const data = await res.json();
        setBrains(data.brains);
      }
    } finally {
      setLoading(false);
    }
  }

  async function openShareDialog() {
    const res = await fetch('/api/brain/list');
    if (res.ok) {
      const data = await res.json();
      setUserBrains(data.brains || []);
    }
    setShowShare(true);
  }

  async function shareBrain(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBrain) return;
    const res = await fetch(`/api/teams/${teamId}/brains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brainId: selectedBrain, permission }),
    });
    if (res.ok) {
      setShowShare(false);
      setSelectedBrain('');
      fetchBrains();
      onUpdate();
    }
  }

  async function unshareBrain(brainId: string) {
    const res = await fetch(`/api/teams/${teamId}/brains/${brainId}`, { method: 'DELETE' });
    if (res.ok) {
      fetchBrains();
      onUpdate();
    }
  }

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading brains...</div>;
  }

  return (
    <div>
      {canManage && (
        <button
          onClick={openShareDialog}
          className="mb-4 rounded-lg bg-[#8a2be2] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a2be2]/80 transition-colors"
        >
          Share Brain
        </button>
      )}

      {brains.length === 0 ? (
        <p className="text-gray-500 text-sm">No brains shared with this team yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {brains.map((b) => (
            <div key={b.shareId} className="rounded-lg border border-white/10 bg-[#12122a] p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">{b.name}</h4>
                  <span className="text-xs text-gray-500">{b.type}</span>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs ${
                  b.permission === 'ADMIN' ? 'bg-[#8a2be2]/20 text-[#8a2be2]' :
                  b.permission === 'WRITE' ? 'bg-[#00d4ff]/20 text-[#00d4ff]' :
                  'bg-white/10 text-gray-400'
                }`}>
                  {b.permission}
                </span>
              </div>
              <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
                <span>{b.nodeCount} nodes</span>
                <span>{b.active ? 'Active' : 'Inactive'}</span>
              </div>
              {canManage && (
                <button
                  onClick={() => unshareBrain(b.brainId)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Unshare
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a0a1a] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Share Brain</h3>
              <button onClick={() => setShowShare(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={shareBrain} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Brain</label>
                <select
                  value={selectedBrain}
                  onChange={(e) => setSelectedBrain(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white"
                >
                  <option value="">Select a brain...</option>
                  {userBrains.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.type}, {b.nodeCount} nodes)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Permission</label>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white"
                >
                  <option value="READ">Read</option>
                  <option value="WRITE">Write</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-[#8a2be2] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a2be2]/80 transition-colors"
              >
                Share
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
