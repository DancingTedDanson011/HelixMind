'use client';

import { useState, useRef, useCallback } from 'react';

interface BrainstormState {
  isProcessing: boolean;
  streamingText: string;
  error: string | null;
}

export interface UseBrainstormChatReturn {
  sendMessage: (text: string, chatId: string) => void;
  state: BrainstormState;
  abort: () => void;
  reset: () => void;
}

export function useBrainstormChat(): UseBrainstormChatReturn {
  const [state, setState] = useState<BrainstormState>({
    isProcessing: false,
    streamingText: '',
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback((text: string, chatId: string) => {
    // Abort any previous request
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setState({ isProcessing: true, streamingText: '', error: null });

    (async () => {
      try {
        const res = await fetch('/api/chat/brainstorm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, content: text }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          setState(prev => ({ ...prev, isProcessing: false, error: errText }));
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setState(prev => ({ ...prev, isProcessing: false, error: 'No response stream' }));
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'text') {
                setState(prev => ({
                  ...prev,
                  streamingText: prev.streamingText + event.content,
                }));
              } else if (event.type === 'done') {
                setState(prev => ({
                  ...prev,
                  isProcessing: false,
                  streamingText: event.fullText,
                }));
              } else if (event.type === 'error') {
                setState(prev => ({
                  ...prev,
                  isProcessing: false,
                  error: event.error,
                }));
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        // In case stream ended without 'done' event
        setState(prev => {
          if (prev.isProcessing) {
            return { ...prev, isProcessing: false };
          }
          return prev;
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    })();
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setState(prev => ({ ...prev, isProcessing: false }));
  }, []);

  const reset = useCallback(() => {
    setState({ isProcessing: false, streamingText: '', error: null });
  }, []);

  return { sendMessage, state, abort, reset };
}
