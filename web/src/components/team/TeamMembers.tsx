'use client';

import { useState } from 'react';

interface Member {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  joinedAt: string;
}

interface TeamMembersProps {
  teamId: string;
  members: Member[];
  myRole: string;
  onUpdate: () => void;
}

export function TeamMembers({ teamId, members, myRole, onUpdate }: TeamMembersProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  async function changeRole(userId: string, role: string) {
    setLoading(userId);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) onUpdate();
    } finally {
      setLoading(null);
    }
  }

  async function removeMember(userId: string) {
    if (!confirm('Remove this member from the team?')) return;
    setLoading(userId);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) onUpdate();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-gray-400">
            <th className="pb-3 pr-4 font-medium">Member</th>
            <th className="pb-3 pr-4 font-medium">Role</th>
            <th className="pb-3 pr-4 font-medium">Joined</th>
            {canManage && <th className="pb-3 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b border-white/5">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  {m.image ? (
                    <img src={m.image} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8a2be2]/20 text-xs text-[#8a2be2]">
                      {(m.name || m.email)[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-white">{m.name || 'Unnamed'}</div>
                    <div className="text-gray-500 text-xs">{m.email}</div>
                  </div>
                </div>
              </td>
              <td className="py-3 pr-4">
                {canManage && m.role !== 'OWNER' ? (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.userId, e.target.value)}
                    disabled={loading === m.userId}
                    className="rounded bg-[#0a0a1a] border border-white/10 px-2 py-1 text-xs text-white"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                ) : (
                  <span className={`inline-block rounded px-2 py-0.5 text-xs ${
                    m.role === 'OWNER' ? 'bg-[#8a2be2]/20 text-[#8a2be2]' :
                    m.role === 'ADMIN' ? 'bg-[#00d4ff]/20 text-[#00d4ff]' :
                    'bg-white/10 text-gray-400'
                  }`}>
                    {m.role}
                  </span>
                )}
              </td>
              <td className="py-3 pr-4 text-gray-400">
                {new Date(m.joinedAt).toLocaleDateString()}
              </td>
              {canManage && (
                <td className="py-3">
                  {m.role !== 'OWNER' && (
                    <button
                      onClick={() => removeMember(m.userId)}
                      disabled={loading === m.userId}
                      className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
