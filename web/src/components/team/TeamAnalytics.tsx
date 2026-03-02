'use client';

import { useState, useEffect } from 'react';

interface MemberStat {
  userId: string;
  name: string | null;
  email: string;
  apiCalls: number;
  tokens: number;
  jarvisTasks: number;
}

interface AnalyticsData {
  period: string;
  totals: {
    apiCalls: number;
    tokens: number;
    jarvisTasks: number;
    activeBrains: number;
  };
  members: MemberStat[];
  daily: { date: string; apiCalls: number; tokens: number }[];
}

interface TeamAnalyticsProps {
  teamId: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function TeamAnalytics({ teamId }: TeamAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [teamId, period]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/analytics?period=${period}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) {
    return <div className="text-gray-500 text-sm">Loading analytics...</div>;
  }

  const statCards = [
    { label: 'API Calls', value: data.totals.apiCalls, color: '#00d4ff' },
    { label: 'Tokens Used', value: data.totals.tokens, color: '#8a2be2' },
    { label: 'Jarvis Tasks', value: data.totals.jarvisTasks, color: '#00ff88' },
    { label: 'Active Brains', value: data.totals.activeBrains, color: '#ffaa00' },
  ];

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {['24h', '7d', '30d'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p
                ? 'bg-[#00d4ff] text-black'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-lg border border-white/10 bg-[#12122a] p-4">
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: s.color }}>
              {formatNumber(s.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Members table */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-400">Per-Member Usage</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="pb-3 pr-4 font-medium">Member</th>
                <th className="pb-3 pr-4 font-medium text-right">API Calls</th>
                <th className="pb-3 pr-4 font-medium text-right">Tokens</th>
                <th className="pb-3 font-medium text-right">Jarvis Tasks</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.userId} className="border-b border-white/5">
                  <td className="py-3 pr-4">
                    <div className="text-white">{m.name || 'Unnamed'}</div>
                    <div className="text-xs text-gray-500">{m.email}</div>
                  </td>
                  <td className="py-3 pr-4 text-right text-[#00d4ff]">{formatNumber(m.apiCalls)}</td>
                  <td className="py-3 pr-4 text-right text-[#8a2be2]">{formatNumber(m.tokens)}</td>
                  <td className="py-3 text-right text-[#00ff88]">{formatNumber(m.jarvisTasks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
