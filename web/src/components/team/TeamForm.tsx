'use client';

import { useState } from 'react';

interface TeamFormProps {
  onSubmit: (name: string, slug: string) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
}

export function TeamForm({ onSubmit, onCancel }: TeamFormProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await onSubmit(name, slug);
      if (result.success) {
        setName('');
        setSlug('');
      } else {
        setError(result.error || 'Failed to create team');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a1a] p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">Create New Team</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-gray-400">Team Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={submitting}
            className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white outline-none focus:border-[#00d4ff]/50 disabled:opacity-50"
            placeholder="My Team"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            required
            pattern="^[a-z0-9-]+$"
            disabled={submitting}
            className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white outline-none focus:border-[#00d4ff]/50 disabled:opacity-50"
            placeholder="my-team"
          />
          <p className="mt-1 text-xs text-gray-600">Lowercase letters, numbers, and hyphens only.</p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-black hover:bg-[#00d4ff]/80 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
