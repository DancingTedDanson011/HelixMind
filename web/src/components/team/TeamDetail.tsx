'use client';

import { useState } from 'react';
import { TeamMembers } from './TeamMembers';
import { TeamInviteDialog } from './TeamInviteDialog';
import { TeamBrains } from './TeamBrains';
import { TeamSettings } from './TeamSettings';

export interface TeamDetailData {
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

interface TeamDetailProps {
  team: TeamDetailData;
  myRole: string;
  onUpdate: () => void;
  onDelete: () => void;
}

export function TeamDetail({ team, myRole, onUpdate, onDelete }: TeamDetailProps) {
  const [tab, setTab] = useState<Tab>('members');
  const [showInvite, setShowInvite] = useState(false);

  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'members', label: `Members (${team.memberCount})` },
    { key: 'invites', label: `Invites (${team.inviteCount})` },
    { key: 'brains', label: `Brains (${team.brainShareCount})` },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a1a] p-6">
      {/* Team header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{team.name}</h2>
          <span className="text-xs text-gray-500">/{team.slug}</span>
          <span className="ml-3 inline-block rounded px-2 py-0.5 text-xs bg-[#8a2be2]/20 text-[#8a2be2]">
            {team.plan}
          </span>
        </div>
        {canManage && (
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
          teamId={team.id}
          members={team.members}
          myRole={myRole}
          onUpdate={onUpdate}
        />
      )}
      {tab === 'invites' && (
        <TeamInviteDialog
          teamId={team.id}
          open={true}
          onClose={() => setTab('members')}
        />
      )}
      {tab === 'brains' && (
        <TeamBrains
          teamId={team.id}
          myRole={myRole}
          onUpdate={onUpdate}
        />
      )}
      {tab === 'settings' && (
        <TeamSettings
          teamId={team.id}
          teamName={team.name}
          isOwner={myRole === 'OWNER'}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}

      {/* Invite dialog (standalone, triggered by button) */}
      {showInvite && tab !== 'invites' && (
        <TeamInviteDialog
          teamId={team.id}
          open={showInvite}
          onClose={() => {
            setShowInvite(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
