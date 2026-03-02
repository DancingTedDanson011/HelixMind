'use client';

import { useState } from 'react';

interface TeamSettingsProps {
  teamId: string;
  teamName: string;
  onUpdate: () => void;
  onDelete: () => void;
  isOwner: boolean;
}

export function TeamSettings({ teamId, teamName, onUpdate, onDelete, isOwner }: TeamSettingsProps) {
  const [name, setName] = useState(teamName);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (name === teamName) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) onUpdate();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
    if (res.ok) onDelete();
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 text-sm font-medium text-gray-400">General</h3>
        <form onSubmit={handleRename} className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white outline-none focus:border-[#00d4ff]/50"
          />
          <button
            type="submit"
            disabled={saving || name === teamName}
            className="rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-black hover:bg-[#00d4ff]/80 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Rename'}
          </button>
        </form>
      </div>

      {isOwner && (
        <div className="rounded-lg border border-red-500/20 p-4">
          <h3 className="mb-2 text-sm font-medium text-red-400">Danger Zone</h3>
          <p className="mb-3 text-xs text-gray-500">
            Deleting a team removes all members, invites, and shared brains. This cannot be undone.
          </p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Delete Team
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
