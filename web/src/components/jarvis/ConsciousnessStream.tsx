'use client';

import { useRef, useEffect } from 'react';
import { Brain, Lightbulb, Eye, Sparkles } from 'lucide-react';
import type { ThinkingUpdate, ConsciousnessEvent } from '@/lib/cli-types';

interface ConsciousnessStreamProps {
  thinkingUpdates: ThinkingUpdate[];
  consciousnessEvents: ConsciousnessEvent[];
}

type StreamEntry = {
  type: 'thinking' | 'consciousness';
  timestamp: number;
  phase?: string;
  observation?: string;
  eventType?: string;
  content?: string;
  depth?: string;
};

const PHASE_ICONS: Record<string, typeof Brain> = {
  quick: Eye,
  medium: Lightbulb,
  deep: Brain,
};

const PHASE_COLORS: Record<string, string> = {
  quick: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  deep: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
};

const DEPTH_COLORS: Record<string, string> = {
  surface: 'border-l-cyan-500/30',
  moderate: 'border-l-amber-500/30',
  deep: 'border-l-fuchsia-500/30',
};

export function ConsciousnessStream({ thinkingUpdates, consciousnessEvents }: ConsciousnessStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Merge and sort by timestamp
  const entries: StreamEntry[] = [
    ...thinkingUpdates.map((t): StreamEntry => ({
      type: 'thinking',
      timestamp: t.timestamp,
      phase: t.phase,
      observation: t.observation,
    })),
    ...consciousnessEvents.map((e): StreamEntry => ({
      type: 'consciousness',
      timestamp: e.timestamp,
      eventType: e.eventType,
      content: e.content,
      depth: e.depth,
    })),
  ].sort((a, b) => a.timestamp - b.timestamp).slice(-50);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-6">
        <Sparkles size={16} className="mx-auto text-fuchsia-500/30 mb-2" />
        <p className="text-[10px] text-gray-700">Waiting for consciousness activity...</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-64 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
    >
      {entries.map((entry, i) => {
        if (entry.type === 'thinking') {
          const Icon = PHASE_ICONS[entry.phase ?? ''] ?? Eye;
          const phaseColor = PHASE_COLORS[entry.phase ?? ''] ?? PHASE_COLORS.quick;
          return (
            <div key={i} className="flex items-start gap-2 group">
              <span className="text-[9px] text-gray-700 mt-0.5 w-14 flex-shrink-0 font-mono">
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`text-[8px] px-1 py-0.5 rounded border ${phaseColor} flex-shrink-0 mt-0.5`}>
                <Icon size={8} className="inline mr-0.5" />
                {entry.phase}
              </span>
              <p className="text-[10px] text-gray-500 flex-1">
                {entry.observation || 'Thinking...'}
              </p>
            </div>
          );
        }

        // Consciousness event
        const depthColor = DEPTH_COLORS[entry.depth ?? ''] ?? DEPTH_COLORS.surface;
        return (
          <div key={i} className={`flex items-start gap-2 pl-2 border-l-2 ${depthColor}`}>
            <span className="text-[9px] text-gray-700 mt-0.5 w-14 flex-shrink-0 font-mono">
              {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[8px] px-1 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 flex-shrink-0 mt-0.5">
              {entry.eventType}
            </span>
            <p className="text-[10px] text-gray-400 flex-1">
              {entry.content}
            </p>
          </div>
        );
      })}
    </div>
  );
}
