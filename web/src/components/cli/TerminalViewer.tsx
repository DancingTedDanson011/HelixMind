'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { ArrowDown } from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface TerminalViewerProps {
  lines: string[];
  maxLines?: number;
}

/* ─── Component ───────────────────────────────── */

export function TerminalViewer({ lines, maxLines = 500 }: TerminalViewerProps) {
  const t = useTranslations('cli');

  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const autoScrollRef = useRef(true);

  // Trim lines to maxLines
  const visibleLines = lines.length > maxLines ? lines.slice(lines.length - maxLines) : lines;

  // ── Scroll tracking ─────────────────────────────

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const threshold = 40;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    autoScrollRef.current = isAtBottom;
    setIsScrolledUp(!isAtBottom);
  }, []);

  // ── Auto-scroll on new lines ───────────────────

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines.length]);

  // ── Scroll to bottom handler ───────────────────

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      autoScrollRef.current = true;
      setIsScrolledUp(false);
    }
  }, []);

  return (
    <div className="relative rounded-lg overflow-hidden border border-white/5">
      {/* Terminal viewport */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-[#0a0a1a] max-h-[500px] overflow-y-auto overflow-x-hidden font-mono text-xs leading-5 p-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {visibleLines.length === 0 ? (
          <div className="text-gray-600 text-center py-8">
            {t('terminalEmpty')}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {visibleLines.map((line, i) => {
                const lineNum = lines.length > maxLines
                  ? lines.length - maxLines + i + 1
                  : i + 1;

                return (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="text-right pr-3 py-0 select-none text-gray-600 w-10 align-top whitespace-nowrap">
                      {lineNum}
                    </td>
                    <td className="py-0 text-gray-300 break-all whitespace-pre-wrap">
                      {line}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Scroll to bottom button */}
      {isScrolledUp && (
        <div className="absolute bottom-3 right-3">
          <Button
            variant="outline"
            size="sm"
            className="bg-surface/90 backdrop-blur-sm shadow-lg"
            onClick={scrollToBottom}
          >
            <ArrowDown size={12} />
            {t('scrollToBottom')}
          </Button>
        </div>
      )}
    </div>
  );
}
