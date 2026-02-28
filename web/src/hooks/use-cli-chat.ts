'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getConnectionWs } from '@/lib/cli-ws-registry';
import type {
  ChatTextChunkEvent,
  ChatToolStartEvent,
  ChatToolEndEvent,
  ChatCompleteEvent,
  ChatErrorEvent,
} from '@/lib/cli-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActiveTool {
  stepNum: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  result?: string;
}

export interface CliChatState {
  isProcessing: boolean;
  streamingText: string;
  activeTools: ActiveTool[];
  error: string | null;
}

export interface UseCliChatReturn {
  state: CliChatState;
  sendMessage: (text: string, chatId: string, mode?: 'normal' | 'skip-permissions') => void;
  abort: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook that listens for chat_* events on an existing CLI WebSocket connection
 * and accumulates state for the UI (streaming text, active tools, errors).
 *
 * @param connectionId — unique ID of the CLI connection (for WS registry lookup)
 * @param wsVersion — increments each time the WebSocket reconnects (re-attach listeners)
 */
export function useCliChat(connectionId: string, wsVersion: number): UseCliChatReturn {
  const [state, setState] = useState<CliChatState>({
    isProcessing: false,
    streamingText: '',
    activeTools: [],
    error: null,
  });

  const activeChatIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Reset state
  const reset = useCallback(() => {
    activeChatIdRef.current = null;
    setState({
      isProcessing: false,
      streamingText: '',
      activeTools: [],
      error: null,
    });
  }, []);

  // Send a chat message
  const sendMessage = useCallback((text: string, chatId: string, mode: 'normal' | 'skip-permissions' = 'normal') => {
    const ws = getConnectionWs(connectionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    activeChatIdRef.current = chatId;
    setState({
      isProcessing: true,
      streamingText: '',
      activeTools: [],
      error: null,
    });

    ws.send(JSON.stringify({
      type: 'send_chat',
      text,
      chatId,
      mode,
      timestamp: Date.now(),
    }));
  }, [connectionId]);

  // Abort (send abort request)
  const abort = useCallback(() => {
    const chatId = activeChatIdRef.current;
    if (!chatId) return;
    setState(prev => ({ ...prev, isProcessing: false, error: 'Aborted' }));
    activeChatIdRef.current = null;
  }, []);

  // Listen for chat_* events on the WebSocket
  // Re-runs whenever wsVersion changes (new WebSocket after reconnect)
  useEffect(() => {
    mountedRef.current = true;

    const handleWsMessage = (event: MessageEvent) => {
      if (!mountedRef.current) return;

      try {
        const msg = JSON.parse(String(event.data));
        const chatId = activeChatIdRef.current;

        // Only process events for our active chat (or accept if no chatId filter)
        if (chatId && msg.chatId && msg.chatId !== chatId) return;

        switch (msg.type) {
          case 'chat_started':
            setState(prev => ({ ...prev, isProcessing: true }));
            break;

          case 'chat_text_chunk': {
            const chunk = (msg as ChatTextChunkEvent).text;
            setState(prev => ({
              ...prev,
              streamingText: prev.streamingText + chunk,
            }));
            break;
          }

          case 'chat_tool_start': {
            const toolEvt = msg as ChatToolStartEvent;
            setState(prev => ({
              ...prev,
              activeTools: [...prev.activeTools, {
                stepNum: toolEvt.stepNum,
                toolName: toolEvt.toolName,
                toolInput: toolEvt.toolInput,
                status: 'running',
              }],
            }));
            break;
          }

          case 'chat_tool_end': {
            const endEvt = msg as ChatToolEndEvent;
            setState(prev => ({
              ...prev,
              activeTools: prev.activeTools.map(t =>
                t.stepNum === endEvt.stepNum
                  ? { ...t, status: endEvt.status, result: endEvt.result }
                  : t
              ),
            }));
            break;
          }

          case 'chat_complete': {
            const completeEvt = msg as ChatCompleteEvent;
            setState(prev => ({
              ...prev,
              isProcessing: false,
              streamingText: completeEvt.text,
            }));
            activeChatIdRef.current = null;
            break;
          }

          case 'chat_error': {
            const errEvt = msg as ChatErrorEvent;
            setState(prev => ({
              ...prev,
              isProcessing: false,
              error: errEvt.error,
            }));
            activeChatIdRef.current = null;
            break;
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    // Attach listener to the connection's WebSocket
    const ws = getConnectionWs(connectionId);
    if (ws) {
      ws.addEventListener('message', handleWsMessage);
    }

    return () => {
      mountedRef.current = false;
      const ws = getConnectionWs(connectionId);
      if (ws) {
        ws.removeEventListener('message', handleWsMessage);
      }
    };
  }, [connectionId, wsVersion]);

  return { state, sendMessage, abort, reset };
}
