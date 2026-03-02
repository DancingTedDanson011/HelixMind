'use client';

import { useState, useEffect } from 'react';
import { TeamAnalytics } from '@/components/team/TeamAnalytics';

interface Team {
  id: string;
  name: string;
  slug: string;
  myRole: string;
}

export default function TeamAnalyticsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/teams');
        if (res.ok) {
          const data = await res.json();
          setTeams(data.teams);
          if (data.teams.length > 0) {
            setSelectedTeamId(data.teams[0].id);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050510] p-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-[#050510] p-8">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="mb-4 text-2xl font-bold text-white">Team Analytics</h1>
          <p className="text-gray-500">No teams found. Create a team first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050510] p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Team Analytics</h1>
          {teams.length > 1 && (
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0a0a1a] px-3 py-2 text-sm text-white"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {selectedTeamId && (
          <div className="rounded-xl border border-white/10 bg-[#0a0a1a] p-6">
            <TeamAnalytics teamId={selectedTeamId} />
          </div>
        )}
      </div>
    </div>
  );
}
