'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, Bot, ArrowDown } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from './AppShell';

interface ChatViewProps {
  messages: ChatMessage[];
  isAgentRunning: boolean;
  streamingContent: string;
  hasChat: boolean;
}

export function ChatView({
  messages,
  isAgentRunning,
  streamingContent,
  hasChat,
}: ChatViewProps) {
  const t = useTranslations('app');
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const autoScrollRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      autoScrollRef.current = true;
      setShowScrollBtn(false);
    }
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoScrollRef.current) {
      scrollToBottom();
    }
  }, [messages.length, streamingContent, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    autoScrollRef.current = atBottom;
    setShowScrollBtn(!atBottom);
  }, []);

  // Empty state — no chat selected
  if (!hasChat) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center">
            <MessageSquare size={28} className="text-cyan-500/50" />
          </div>
          <h3 className="text-lg font-medium text-gray-300">{t('noMessages')}</h3>
          <p className="text-sm text-gray-600">{t('noMessagesHint')}</p>
        </div>
      </div>
    );
  }

  // Empty chat — no messages yet
  if (messages.length === 0 && !isAgentRunning) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center">
            <Bot size={28} className="text-cyan-500/50" />
          </div>
          <h3 className="text-lg font-medium text-gray-300">{t('noMessages')}</h3>
          <p className="text-sm text-gray-600">{t('noMessagesHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming indicator */}
          {isAgentRunning && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                <Bot size={14} className="text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                {streamingContent ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    {streamingContent}
                    <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-0.5" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    {t('thinking')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 p-2 rounded-full bg-surface/90 border border-white/10 text-gray-400 hover:text-white shadow-lg backdrop-blur-sm transition-all hover:scale-105"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}
