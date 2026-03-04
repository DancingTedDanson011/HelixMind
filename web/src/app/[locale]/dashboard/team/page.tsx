'use client';

import { useState, useEffect, useCallback } from 'react';
import { TeamMembers } from '@/components/team/TeamMembers';
import { TeamInviteDialog } from '@/components/team/TeamInviteDialog';
import { TeamSettings } from '@/components/team/TeamSettings';
import { TeamBrains } from '@/components/team/TeamBrains';

interface Team {
  id: string;
  name: string;
  slug: string;
  plan: string;
  memberCount: number;
  myRole: string;
  createdAt: string;
}

interface TeamDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  ownerId: string;
  memberCount: number;
  inviteCount: number;
  brainShareCount: number;
  createdAt: string;
  members: {
    id: string;
    userId: string;
    name: string | null;
    email: string;
    image: string | null;
    role: string;
    joinedAt: string;
  }[];
}

type Tab = 'members' | 'invites' | 'brains' | 'settings';

export default function TeamPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [tab, setTab] = useState<Tab>('members');
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  // Create team form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [createError, setCreateError] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/teams');
      if (res.status === 401) {
        setFetchError('Session expired. Please log in again.');
        return;
      }
      if (res.status === 403) {
        setFetchError('You do not have permission to access teams. A Team or Enterprise plan is required.');
        return;
      }
      if (!res.ok) {
        setFetchError('Failed to load teams. Please try again.');
        return;
      }
      const data = await res.json();
      setTeams(data.teams);
      if (data.teams.length > 0 && !selectedTeam) {
        fetchTeamDetail(data.teams[0].id);
      }
    } catch {
      setFetchError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function fetchTeamDetail(teamId: string) {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.status === 401) {
        setFetchError('Session expired. Please log in again.');
        return;
      }
      if (!res.ok) {
        setFetchError('Failed to load team details.');
        return;
      }
      const data = await res.json();
      setSelectedTeam(data.team);
    } catch {
      setFetchError('Network error. Please check your connection.');
    }
  }

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, slug: newSlug }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewName('');
      setNewSlug('');
      setShowCreate(false);
      fetchTeams();
      fetchTeamDetail(data.team.id);
    } else {
      const data = await res.json();
      setCreateError(data.error || 'Failed to create team');
    }
  }

  function handleTeamDeleted() {
    setSelectedTeam(null);
    fetchTeams();
  }

  const myRole = teams.find((t) => t.id === selectedTeam?.id)?.myRole || '';
  const tabs: { key: Tab; label: string }[] = [
    { key: 'members', label: `Members (${selectedTeam?.memberCount || 0})` },
    { key: 'invites', label: `Invites (${selectedTeam?.inviteCount || 0})` },
    { key: 'brains', label: `Brains (${selectedTeam?.brainShareCount || 0})` },
    { key: 'settings', label: 'Settings' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050510] p-8">
        <div className="text-gray-500">Loading teams...</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-[#050510] p-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="text-sm text-red-400 mb-4">{fetchError}</p>
            <button
              onClick={() => fetchTeams()}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/20 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050510] p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Team Management</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-black hover:bg-[#00d4ff]/80 transition-colors"
          >
            Create Team
          </button>
        </div>

        {/* Create team form */}
        {showCreate && (
          <div className="mb-8 rounded-xl border border-white/10 bg-[#0a0a1a] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Create New Team</h2>
            <form onSubmit={createTeam} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Team Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white outline-none focus:border-[#00d4ff]/50"
                  placeholder="My Team"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Slug</label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  pattern="^[a-z0-9-]+$"
                  className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white outline-none focus:border-[#00d4ff]/50"
                  placeholder="my-team"
                />
                <p className="mt-1 text-xs text-gray-600">Lowercase letters, numbers, and hyphens only.</p>
              </div>
              {createError && <p className="text-sm text-red-400">{createError}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-black hover:bg-[#00d4ff]/80 transition-colors"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Team list (when multiple teams) */}
        {teams.length > 1 && (
          <div className="mb-6 flex gap-2 overflow-x-auto">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => fetchTeamDetail(t.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedTeam?.id === t.id
                    ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                }`}
              >
                {t.name}
                <span className="ml-2 text-xs opacity-60">{t.memberCount} members</span>
              </button>
            ))}
          </div>
        )}

        {/* No teams */}
        {teams.length === 0 && !showCreate && (
          <div className="rounded-xl border border-white/10 bg-[#0a0a1a] p-12 text-center">
            <h2 className="mb-2 text-lg font-semibold text-white">No Teams Yet</h2>
            <p className="mb-4 text-sm text-gray-500">
              Create a team to collaborate with others. Requires a Team or Enterprise plan.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-[#00d4ff] px-6 py-2 text-sm font-medium text-black hover:bg-[#00d4ff]/80 transition-colors"
            >
              Create Your First Team
            </button>
          </div>
        )}

        {/* Team detail */}
        {selectedTeam && (
          <div className="rounded-xl border border-white/10 bg-[#0a0a1a] p-6">
            {/* Team header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{selectedTeam.name}</h2>
                <span className="text-xs text-gray-500">/{selectedTeam.slug}</span>
                <span className="ml-3 inline-block rounded px-2 py-0.5 text-xs bg-[#8a2be2]/20 text-[#8a2be2]">
                  {selectedTeam.plan}
                </span>
              </div>
              {(myRole === 'OWNER' || myRole === 'ADMIN') && (
                <button
                  onClick={() => setShowInvite(true)}
                  className="rounded-lg bg-[#8a2be2] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a2be2]/80 transition-colors"
                >
                  Invite Member
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="mb-6 flex border-b border-white/10">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    tab === t.key
                      ? 'border-b-2 border-[#00d4ff] text-[#00d4ff]'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tab === 'members' && (
              <TeamMembers
                teamId={selectedTeam.id}
                members={selectedTeam.members}
                myRole={myRole}
                onUpdate={() => fetchTeamDetail(selectedTeam.id)}
              />
            )}
            {tab === 'invites' && (
              <div>
                <TeamInviteDialog
                  teamId={selectedTeam.id}
                  open={true}
                  onClose={() => setTab('members')}
                />
              </div>
            )}
            {tab === 'brains' && (
              <TeamBrains
                teamId={selectedTeam.id}
                myRole={myRole}
                onUpdate={() => fetchTeamDetail(selectedTeam.id)}
              />
            )}
            {tab === 'settings' && (
              <TeamSettings
                teamId={selectedTeam.id}
                teamName={selectedTeam.name}
                isOwner={myRole === 'OWNER'}
                onUpdate={() => fetchTeamDetail(selectedTeam.id)}
                onDelete={handleTeamDeleted}
              />
            )}
          </div>
        )}

        {/* Invite dialog (standalone, triggered by button) */}
        {showInvite && selectedTeam && tab !== 'invites' && (
          <TeamInviteDialog
            teamId={selectedTeam.id}
            open={showInvite}
            onClose={() => {
              setShowInvite(false);
              if (selectedTeam) fetchTeamDetail(selectedTeam.id);
            }}
          />
        )}
      </div>
    </div>
  );
}
