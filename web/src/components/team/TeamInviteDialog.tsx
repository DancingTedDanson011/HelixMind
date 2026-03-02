'use client';

import { useState, useEffect } from 'react';

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface TeamInviteDialogProps {
  teamId: string;
  open: boolean;
  onClose: () => void;
}

export function TeamInviteDialog({ teamId, open, onClose }: TeamInviteDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) fetchInvites();
  }, [open]);

  async function fetchInvites() {
    const res = await fetch(`/api/teams/${teamId}/invite`);
    if (res.ok) {
      const data = await res.json();
      setInvites(data.invites);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/teams/${teamId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      if (res.ok) {
        setEmail('');
        fetchInvites();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send invite');
      }
    } finally {
      setLoading(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    await fetch(`/api/teams/${teamId}/invite/${inviteId}`, { method: 'DELETE' });
    fetchInvites();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0a0a1a] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Invite Members</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>

        <form onSubmit={sendInvite} className="mb-6 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            className="flex-1 rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-[#00d4ff]/50"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#12122a] px-2 py-2 text-sm text-white"
          >
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-black hover:bg-[#00d4ff]/80 transition-colors disabled:opacity-50"
          >
            Invite
          </button>
        </form>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {invites.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-400">Pending Invites</h4>
            <div className="space-y-2">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-[#12122a] px-3 py-2">
                  <div>
                    <span className="text-sm text-white">{inv.email}</span>
                    <span className="ml-2 text-xs text-gray-500">{inv.role}</span>
                    <span className="ml-2 text-xs text-gray-600">
                      expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => revokeInvite(inv.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
