'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { UseCliConnectionReturn } from './use-cli-connection';
import { getConnectionWs } from '@/lib/cli-ws-registry';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LINES = 500;

/** Strip ANSI escape codes from a string. */
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseCliOutputParams {
  connection: UseCliConnectionReturn;
  sessionId: string | null;
}

export interface UseCliOutputReturn {
  lines: string[];
  lineCount: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribes to output lines from a specific CLI session via the WebSocket
 * connection. Maintains a ring buffer of the last 500 lines with ANSI codes
 * stripped and provides a container ref for auto-scrolling.
 */
export function useCliOutput(params: UseCliOutputParams): UseCliOutputReturn {
  const { connection, sessionId } = params;

  const [lines, setLines] = useState<string[]>([]);
  const [lineCount, setLineCount] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const subscribedIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom when new lines arrive
  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // Subscribe / unsubscribe when sessionId changes
  useEffect(() => {
    const prevId = subscribedIdRef.current;

    // Unsubscribe from previous session
    if (prevId && connection.connectionState === 'connected') {
      connection.sendRequest('unsubscribe_output', { sessionId: prevId }).catch(() => {
        // Ignore errors during unsubscribe (connection may already be closed)
      });
    }

    // Reset lines
    setLines([]);
    setLineCount(0);

    // Subscribe to new session
    if (sessionId && connection.connectionState === 'connected') {
      subscribedIdRef.current = sessionId;
      connection.sendRequest('subscribe_output', { sessionId }).catch(() => {
        // Ignore errors during subscribe
      });
    } else {
      subscribedIdRef.current = null;
    }

    return () => {
      // Cleanup: unsubscribe on unmount
      const currentId = subscribedIdRef.current;
      if (currentId && connection.connectionState === 'connected') {
        connection.sendRequest('unsubscribe_output', { sessionId: currentId }).catch(() => {
          // Ignore errors during cleanup unsubscribe
        });
        subscribedIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, connection.connectionState]);

  // Listen for output_line events on the raw WebSocket
  useEffect(() => {
    const ws = getConnectionWs(connection.connectionId);
    if (!ws) return;

    function onMessage(event: MessageEvent) {
      try {
        const data: { type: string; sessionId?: string; line?: string } = JSON.parse(
          String(event.data),
        );

        if (
          data.type === 'output_line' &&
          data.sessionId === subscribedIdRef.current &&
          typeof data.line === 'string'
        ) {
          const cleaned = stripAnsi(data.line);

          setLines((prev) => {
            const next = [...prev, cleaned];
            // Ring buffer: keep only the last MAX_LINES
            if (next.length > MAX_LINES) {
              return next.slice(next.length - MAX_LINES);
            }
            return next;
          });

          setLineCount((prev) => prev + 1);

          // Auto-scroll after the DOM has updated
          requestAnimationFrame(scrollToBottom);
        }
      } catch {
        // Ignore malformed messages
      }
    }

    ws.addEventListener('message', onMessage);
    return () => {
      ws.removeEventListener('message', onMessage);
    };
  }, [connection.connectionId, connection.connectionState, scrollToBottom]);

  return { lines, lineCount, containerRef };
}
