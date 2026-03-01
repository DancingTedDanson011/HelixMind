'use client';

import { useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { ProposalInfo } from '@/lib/cli-types';

interface ProposalCardProps {
  proposal: ProposalInfo;
  onApprove: (id: number) => void;
  onDeny: (id: number, reason: string) => void;
}

const statusColors = {
  pending: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  approved: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  denied: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' },
  expired: { bg: 'bg-gray-500/10', border: 'border-gray-500/20', text: 'text-gray-500' },
};

export function ProposalCard({ proposal, onApprove, onDeny }: ProposalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const [showDenyInput, setShowDenyInput] = useState(false);

  const colors = statusColors[proposal.status] || statusColors.pending;
  const isPending = proposal.status === 'pending';

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} transition-all`}>
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                {proposal.status}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500">
                {proposal.category}
              </span>
              <span className="text-[10px] text-gray-600 font-mono">#{proposal.id}</span>
            </div>
            <p className="text-sm text-gray-200 font-medium">{proposal.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{proposal.description}</p>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-600 hover:text-gray-400 transition-colors p-1"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
            {/* Rationale */}
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Rationale</p>
              <p className="text-xs text-gray-400">{proposal.rationale}</p>
            </div>

            {/* Affected files */}
            {proposal.affectedFiles.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileText size={10} />
                  Files ({proposal.affectedFiles.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {proposal.affectedFiles.map((f) => (
                    <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-mono">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Denial reason (if denied) */}
            {proposal.denialReason && (
              <div>
                <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Denial Reason</p>
                <p className="text-xs text-red-400/70">{proposal.denialReason}</p>
              </div>
            )}

            {/* Timestamp */}
            <p className="text-[10px] text-gray-700">
              {new Date(proposal.createdAt).toLocaleString()}
              {proposal.decidedAt && ` · Decided ${new Date(proposal.decidedAt).toLocaleString()}`}
            </p>
          </div>
        )}

        {/* Action buttons (only for pending) */}
        {isPending && (
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
            <button
              onClick={() => onApprove(proposal.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
            >
              <CheckCircle2 size={12} />
              Approve
            </button>

            {!showDenyInput ? (
              <button
                onClick={() => setShowDenyInput(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                <XCircle size={12} />
                Deny
              </button>
            ) : (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                  placeholder="Reason..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && denyReason.trim()) {
                      onDeny(proposal.id, denyReason.trim());
                      setDenyReason('');
                      setShowDenyInput(false);
                    }
                  }}
                  className="flex-1 px-2 py-1 rounded-lg bg-white/5 border border-red-500/20 text-xs text-gray-300 placeholder-gray-600 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (denyReason.trim()) {
                      onDeny(proposal.id, denyReason.trim());
                      setDenyReason('');
                      setShowDenyInput(false);
                    }
                  }}
                  className="px-2 py-1 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  <XCircle size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
