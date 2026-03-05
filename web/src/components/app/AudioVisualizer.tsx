'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { VoiceSessionState } from '@/lib/cli-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AudioVisualizerProps {
  audioLevel: number;
  voiceState: VoiceSessionState;
  isVisible: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_COUNT = 20;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const CANVAS_HEIGHT = 32;
const CANVAS_WIDTH = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Canvas-based waveform bar visualizer.
 * - Listening: reactive bars scaled to audioLevel
 * - Speaking: smooth wave animation
 * - Processing/Idle: flat baseline animation
 */
export function AudioVisualizer({ audioLevel, voiceState, isVisible }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef(0);
  const smoothedBarsRef = useRef<number[]>(Array(BAR_COUNT).fill(0));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    phaseRef.current += 0.08;
    const phase = phaseRef.current;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const centerY = CANVAS_HEIGHT / 2;
    const maxH = CANVAS_HEIGHT * 0.85;

    for (let i = 0; i < BAR_COUNT; i++) {
      let targetH: number;

      if (voiceState === 'listening') {
        // Reactive bars: center bars react most to audio level
        const distFromCenter = Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2);
        const envelope = 1 - distFromCenter * 0.6;
        const noise = Math.sin(phase * 3 + i * 1.2) * 0.15;
        targetH = Math.max(2, (audioLevel * 0.85 + noise) * envelope * maxH);
      } else if (voiceState === 'speaking') {
        // Wave animation for AI speech
        const wave = Math.sin(phase + (i / BAR_COUNT) * Math.PI * 3) * 0.5 + 0.5;
        const secondary = Math.sin(phase * 0.7 + (i / BAR_COUNT) * Math.PI * 2) * 0.2;
        targetH = Math.max(2, (wave + secondary) * maxH * 0.7);
      } else if (voiceState === 'processing') {
        // Slow pulse
        const pulse = Math.sin(phase * 0.5 + i * 0.3) * 0.3 + 0.35;
        targetH = pulse * maxH * 0.4;
      } else {
        // Idle: flat with tiny noise
        targetH = 2 + Math.sin(phase * 0.2 + i * 0.5) * 1.5;
      }

      // Smooth transitions
      const prev = smoothedBarsRef.current[i];
      const smoothed = prev + (targetH - prev) * 0.25;
      smoothedBarsRef.current[i] = smoothed;

      const x = i * (BAR_WIDTH + BAR_GAP);
      const h = smoothed;

      // Color by state
      if (voiceState === 'listening') {
        ctx.fillStyle = `rgba(52, 211, 153, ${0.5 + audioLevel * 0.5})`;
      } else if (voiceState === 'speaking') {
        const alpha = 0.4 + (smoothed / maxH) * 0.6;
        ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`;
      } else if (voiceState === 'processing') {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
      } else {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
      }

      const radius = Math.min(BAR_WIDTH / 2, h / 2);
      ctx.beginPath();
      ctx.roundRect(x, centerY - h / 2, BAR_WIDTH, h, radius);
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [voiceState, audioLevel]);

  useEffect(() => {
    if (!isVisible) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isVisible, draw]);

  if (!isVisible) return null;

  return (
    <div className="flex items-center justify-center py-1">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="opacity-90"
        style={{ display: 'block' }}
      />
    </div>
  );
}
