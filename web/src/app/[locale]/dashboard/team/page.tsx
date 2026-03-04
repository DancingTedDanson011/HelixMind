'use client';

import { useState, useEffect, useCallback } from 'react';
import { TeamList, type TeamSummary } from '@/components/team/TeamList';
import { TeamDetail, type TeamDetailData } from '@/components/team/TeamDetail';
import { TeamForm } from '@/components/team/TeamForm';

export default function TeamPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
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

  async function handleCreateTeam(name: string, slug: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug }),
    });
    if (res.ok) {
      const data = await res.json();
      setShowCreate(false);
      fetchTeams();
      fetchTeamDetail(data.team.id);
      return { success: true };
    } else {
      const data = await res.json();
      return { success: false, error: data.error || 'Failed to create team' };
    }
  }

  function handleTeamDeleted() {
    setSelectedTeam(null);
    fetchTeams();
  }

  const myRole = teams.find((t) => t.id === selectedTeam?.id)?.myRole || '';

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
          <div className="mb-8">
            <TeamForm
              onSubmit={handleCreateTeam}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        )}

        {/* Team list (when multiple teams) */}
        <TeamList
          teams={teams}
          selectedId={selectedTeam?.id || null}
          onSelect={fetchTeamDetail}
        />

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
          <TeamDetail
            team={selectedTeam}
            myRole={myRole}
            onUpdate={() => fetchTeamDetail(selectedTeam.id)}
            onDelete={handleTeamDeleted}
          />
        )}
      </div>
    </div>
  );
}
