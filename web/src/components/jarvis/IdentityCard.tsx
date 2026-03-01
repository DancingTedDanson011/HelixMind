'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Brain, Shield, Zap, MessageSquare, Sparkles } from 'lucide-react';
import type { IdentityInfo } from '@/lib/cli-types';

interface IdentityCardProps {
  identity: IdentityInfo | null;
  autonomyLevel: number;
  onSetAutonomy: (level: number) => void;
}

const TRAIT_ICONS: Record<string, typeof Brain> = {
  confidence: Zap,
  caution: Shield,
  proactivity: Sparkles,
  verbosity: MessageSquare,
  creativity: Brain,
};

const TRAIT_COLORS: Record<string, string> = {
  confidence: 'bg-amber-500',
  caution: 'bg-blue-500',
  proactivity: 'bg-fuchsia-500',
  verbosity: 'bg-cyan-500',
  creativity: 'bg-purple-500',
};

const AUTONOMY_LABELS: Record<number, { label: string; color: string; desc: string }> = {
  0: { label: 'L0', color: 'text-red-400', desc: 'Locked — no tool access' },
  1: { label: 'L1', color: 'text-orange-400', desc: 'Read-only — observe only' },
  2: { label: 'L2', color: 'text-yellow-400', desc: 'Proposals — suggest changes' },
  3: { label: 'L3', color: 'text-emerald-400', desc: 'Trusted — safe edits' },
  4: { label: 'L4', color: 'text-cyan-400', desc: 'Autonomous — most actions' },
  5: { label: 'L5', color: 'text-fuchsia-400', desc: 'Full AGI — all capabilities' },
};

export function IdentityCard({ identity, autonomyLevel, onSetAutonomy }: IdentityCardProps) {
  const [expanded, setExpanded] = useState(false);

  const aut = AUTONOMY_LABELS[autonomyLevel] ?? AUTONOMY_LABELS[2];

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-all rounded-xl"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center">
            <Brain size={14} className="text-fuchsia-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-gray-300">Identity</p>
            <p className="text-[10px] text-gray-600">
              Autonomy: <span className={aut.color}>{aut.label}</span>
              {identity ? ` · Trust ${Math.round(identity.trust.approvalRate * 100)}%` : ''}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
          {/* Autonomy slider */}
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Autonomy Level</p>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((lvl) => {
                const la = AUTONOMY_LABELS[lvl];
                const isActive = lvl === autonomyLevel;
                return (
                  <button
                    key={lvl}
                    onClick={() => onSetAutonomy(lvl)}
                    title={la.desc}
                    className={`flex-1 py-1 rounded text-[10px] font-medium border transition-all ${
                      isActive
                        ? `${la.color} bg-white/10 border-white/20`
                        : 'text-gray-600 bg-white/[0.02] border-white/5 hover:bg-white/5'
                    }`}
                  >
                    {la.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-600 mt-1">{aut.desc}</p>
          </div>

          {/* Traits */}
          {identity && (
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Traits</p>
              <div className="space-y-1.5">
                {Object.entries(identity.traits).map(([trait, value]) => {
                  const Icon = TRAIT_ICONS[trait] ?? Brain;
                  const barColor = TRAIT_COLORS[trait] ?? 'bg-gray-500';
                  return (
                    <div key={trait} className="flex items-center gap-2">
                      <Icon size={10} className="text-gray-500 flex-shrink-0" />
                      <span className="text-[10px] text-gray-500 w-16 capitalize">{trait}</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.round(value * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-600 w-8 text-right">
                        {Math.round(value * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trust metrics */}
          {identity && (
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Trust</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-sm font-medium text-emerald-400">{Math.round(identity.trust.approvalRate * 100)}%</p>
                  <p className="text-[9px] text-gray-600">Approval</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-sm font-medium text-cyan-400">{Math.round(identity.trust.successRate * 100)}%</p>
                  <p className="text-[9px] text-gray-600">Success</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-sm font-medium text-gray-400">{identity.trust.totalProposals}</p>
                  <p className="text-[9px] text-gray-600">Proposals</p>
                </div>
              </div>
            </div>
          )}

          {/* Recent learnings */}
          {identity && identity.recentLearnings.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Recent Learnings</p>
              <div className="space-y-1">
                {identity.recentLearnings.slice(-5).map((learning, i) => (
                  <p key={i} className="text-[10px] text-gray-500 pl-2 border-l border-fuchsia-500/20">
                    {learning}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
