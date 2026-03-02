'use client';

import { useState, useEffect, useRef } from 'react';

interface StreamingTextProps {
  /** The full text received so far from the stream */
  text: string;
  /** Characters revealed per frame (higher = faster catch-up) */
  charsPerFrame?: number;
}

/**
 * Smoothly reveals streaming text character-by-character using
 * requestAnimationFrame. When new tokens arrive faster than the
 * reveal speed, it accelerates to catch up.
 */
export function StreamingText({ text, charsPerFrame = 3 }: StreamingTextProps) {
  const [displayed, setDisplayed] = useState('');
  const targetRef = useRef(text);
  const displayedRef = useRef('');
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  // Keep target in sync
  targetRef.current = text;

  useEffect(() => {
    function tick(now: number) {
      const target = targetRef.current;
      const current = displayedRef.current;

      if (current.length < target.length) {
        // Calculate how many chars to add this frame
        // Speed up when we're far behind (> 50 chars behind → burst mode)
        const behind = target.length - current.length;
        const speed = behind > 50 ? Math.min(behind, 20) : charsPerFrame;

        const next = target.slice(0, current.length + speed);
        displayedRef.current = next;
        setDisplayed(next);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [charsPerFrame]);

  // When text shrinks (new message), reset immediately
  useEffect(() => {
    if (text.length < displayedRef.current.length) {
      displayedRef.current = '';
      setDisplayed('');
    }
  }, [text]);

  return <>{displayed}</>;
}
