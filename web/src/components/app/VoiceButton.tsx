'use client';

import { Mic, MicOff, Loader2 } from 'lucide-react';
import type { VoiceSessionState } from '@/lib/cli-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceButtonProps {
  voiceState: VoiceSessionState;
  audioLevel: number;
  onToggle: () => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Mic toggle button with visual state indicators:
 * - idle: gray
 * - listening: pulsing green ring (intensity scales with audioLevel)
 * - processing: spinner overlay
 * - speaking: animated wave bars
 */
export function VoiceButton({ voiceState, audioLevel, onToggle, disabled = false }: VoiceButtonProps) {
  const isActive = voiceState !== 'idle';

  return (
    <div className="relative flex items-center justify-center flex-shrink-0">
      {/* Pulsing ring for listening state */}
      {voiceState === 'listening' && (
        <span
          className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"
          style={{ opacity: 0.3 + audioLevel * 0.7 }}
        />
      )}

      {/* Speaking wave rings */}
      {voiceState === 'speaking' && (
        <>
          <span className="absolute inset-[-4px] rounded-full border border-cyan-500/40 animate-ping" style={{ animationDuration: '1s' }} />
          <span className="absolute inset-[-8px] rounded-full border border-cyan-500/20 animate-ping" style={{ animationDuration: '1.4s', animationDelay: '0.2s' }} />
        </>
      )}

      <button
        onClick={onToggle}
        disabled={disabled}
        aria-label={isActive ? 'Stop voice' : 'Start voice'}
        title={isActive ? 'Stop voice' : 'Start voice'}
        className={`
          relative w-9 h-9 rounded-full flex items-center justify-center
          transition-all duration-200
          disabled:opacity-30 disabled:cursor-not-allowed
          ${voiceState === 'idle'
            ? 'bg-white/[0.03] text-gray-500 hover:bg-white/[0.07] hover:text-gray-300 border border-white/[0.07]'
            : voiceState === 'listening'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : voiceState === 'processing'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(0,212,255,0.25)]'
          }
        `}
      >
        {voiceState === 'processing' ? (
          <Loader2 size={15} className="animate-spin" />
        ) : isActive ? (
          <Mic size={15} />
        ) : (
          <MicOff size={15} />
        )}
      </button>
    </div>
  );
}
