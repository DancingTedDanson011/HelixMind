'use client';

export interface TeamSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  memberCount: number;
  myRole: string;
  createdAt: string;
}

interface TeamListProps {
  teams: TeamSummary[];
  selectedId: string | null;
  onSelect: (teamId: string) => void;
}

export function TeamList({ teams, selectedId, onSelect }: TeamListProps) {
  if (teams.length <= 1) return null;

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto">
      {teams.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
            selectedId === t.id
              ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
          }`}
        >
          {t.name}
          <span className="ml-2 text-xs opacity-60">{t.memberCount} members</span>
        </button>
      ))}
    </div>
  );
}
