'use client';

import { useState } from 'react';
import {
  Sparkles, Eye, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import type { ProposalInfo, ThinkingUpdate, ConsciousnessEvent, IdentityInfo } from '@/lib/cli-types';
import { ProposalCard } from './ProposalCard';
import { ConsciousnessStream } from './ConsciousnessStream';

interface JarvisBottomPanelProps {
  proposals: ProposalInfo[];
  thinkingUpdates: ThinkingUpdate[];
  consciousnessEvents: ConsciousnessEvent[];
  identity: IdentityInfo | null;
  autonomyLevel: number;
  isConnected: boolean;
  onApproveProposal: (id: number) => void;
  onDenyProposal: (id: number, reason: string) => void;
  onClose: () => void;
}

export function JarvisBottomPanel({
  proposals, thinkingUpdates, consciousnessEvents,
  onApproveProposal, onDenyProposal, onClose,
}: JarvisBottomPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const pendingProposals = proposals.filter(p => p.status === 'pending');
  const decidedProposals = proposals.filter(p => p.status !== 'pending');
  const consciousnessCount = thinkingUpdates.length + consciousnessEvents.length;

  if (proposals.length === 0 && consciousnessCount === 0) {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl mb-2">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/[0.02] transition-colors"
        >
          <Sparkles size={11} className="text-red-400 flex-shrink-0" />
          <span className="text-gray-300 font-medium">Jarvis Intelligence</span>
          {pendingProposals.length > 0 && (
            <span className="text-amber-400 text-[10px]">
              {pendingProposals.length} proposal{pendingProposals.length !== 1 ? 's' : ''}
            </span>
          )}
          {consciousnessCount > 0 && (
            <span className="text-red-400 text-[10px]">
              <Eye size={8} className="inline mr-0.5" />
              active
            </span>
          )}
          <div className="flex-1" />
          <span
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-0.5 rounded text-gray-600 hover:text-gray-300 transition-colors cursor-pointer"
          >
            <X size={12} />
          </span>
          {expanded ? <ChevronUp size={11} className="text-gray-500" /> : <ChevronDown size={11} className="text-gray-500" />}
        </button>

        {/* Body: 2 columns */}
        {expanded && (
          <div className="border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
            {/* Proposals column */}
            <div className="max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent p-2 space-y-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider flex items-center gap-1 px-1">
                <Sparkles size={9} />
                Proposals ({proposals.length})
              </p>
              {pendingProposals.length > 0 && pendingProposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  onApprove={onApproveProposal}
                  onDeny={onDenyProposal}
                />
              ))}
              {decidedProposals.length > 0 && decidedProposals.slice().reverse().slice(0, 5).map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  onApprove={onApproveProposal}
                  onDeny={onDenyProposal}
                />
              ))}
              {proposals.length === 0 && (
                <p className="text-[10px] text-gray-700 text-center py-3">No proposals yet</p>
              )}
            </div>

            {/* Consciousness column */}
            <div className="max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent p-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider flex items-center gap-1 px-1 mb-1.5">
                <Eye size={9} />
                Consciousness
              </p>
              <ConsciousnessStream
                thinkingUpdates={thinkingUpdates}
                consciousnessEvents={consciousnessEvents}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
