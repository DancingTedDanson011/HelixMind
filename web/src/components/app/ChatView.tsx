'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, Bot, ArrowDown, Loader2, CheckCircle2, XCircle, Wifi } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { AgentPromptBlock } from './AgentPromptBlock';
import { InlineBugPanel } from './InlineBugPanel';
import type { ChatMessage } from './AppShell';
import type { ActiveTool } from '@/hooks/use-cli-chat';
import type { BugInfo } from '@/lib/cli-types';

/* ─── Tool display helpers ────────────────────── */

function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    read_file: 'Reading', write_file: 'Writing', edit_file: 'Editing',
    run_command: 'Running', search_files: 'Searching', find_files: 'Finding',
    list_dir: 'Listing', web_research: 'Researching', git_status: 'Git Status',
    git_diff: 'Git Diff', git_commit: 'Committing',
  };
  return labels[name] || name;
}

function toolDetail(tool: ActiveTool): string | null {
  const input = tool.toolInput;
  if (input?.path) return String(input.path);
  if (input?.command) return String(input.command).slice(0, 100);
  if (input?.query) return `"${String(input.query)}"`;
  if (input?.pattern) return String(input.pattern);
  return null;
}

interface ChatViewProps {
  messages: ChatMessage[];
  isAgentRunning: boolean;
  streamingContent: string;
  activeTools?: ActiveTool[];
  hasChat: boolean;
  agentPrompt?: string | null;
  chatStatus?: string;
  onEditPrompt?: (prompt: string) => void;
  onConnectInstance?: () => void;
  onExecutePrompt?: (prompt: string) => void;
  isConnected?: boolean;
  isExecuting?: boolean;
  bugs?: BugInfo[];
  showBugPanel?: boolean;
  onCloseBugPanel?: () => void;
  onFixBug?: (bugId: number) => void;
  onFixAll?: () => void;
}

export function ChatView({
  messages,
  isAgentRunning,
  streamingContent,
  activeTools = [],
  hasChat,
  agentPrompt,
  chatStatus,
  onEditPrompt,
  onConnectInstance,
  onExecutePrompt,
  isConnected = false,
  isExecuting = false,
  bugs = [],
  showBugPanel = false,
  onCloseBugPanel,
  onFixBug,
  onFixAll,
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
  }, [messages.length, streamingContent, activeTools.length, scrollToBottom]);

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
      <div className="flex flex-col h-full">
        {/* Bug panel in empty state */}
        {showBugPanel && bugs.length > 0 && (
          <div className="px-4 pt-4">
            <InlineBugPanel
              bugs={bugs}
              isConnected={isConnected}
              onFixBug={onFixBug ?? (() => {})}
              onFixAll={onFixAll ?? (() => {})}
              onClose={onCloseBugPanel ?? (() => {})}
            />
          </div>
        )}

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md px-6">
            {isConnected ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/10 flex items-center justify-center">
                  <Wifi size={28} className="text-emerald-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-300">{t('cliConnected')}</h3>
                <p className="text-sm text-gray-600">{t('chatTabHint')}</p>
              </>
            ) : (
              <>
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center">
                  <Bot size={28} className="text-cyan-500/50" />
                </div>
                <h3 className="text-lg font-medium text-gray-300">{t('noMessages')}</h3>
                <p className="text-sm text-gray-600">{t('noMessagesHint')}</p>
              </>
            )}
          </div>
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
        {/* Inline Bug Panel */}
        {showBugPanel && bugs.length > 0 && (
          <InlineBugPanel
            bugs={bugs}
            isConnected={isConnected}
            onFixBug={onFixBug ?? (() => {})}
            onFixAll={onFixAll ?? (() => {})}
            onClose={onCloseBugPanel ?? (() => {})}
          />
        )}

        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Agent Prompt Block */}
          {agentPrompt && (chatStatus === 'prompt_ready' || chatStatus === 'executing' || chatStatus === 'done') && (
            <AgentPromptBlock
              prompt={agentPrompt}
              onEdit={onEditPrompt ?? (() => {})}
              onConnectInstance={onConnectInstance ?? (() => {})}
              onExecute={onExecutePrompt ?? (() => {})}
              isConnected={isConnected}
              isExecuting={isExecuting}
            />
          )}

          {/* Active tool calls */}
          {activeTools.length > 0 && isAgentRunning && (
            <div className="space-y-1.5 pl-10">
              {activeTools.map((tool) => (
                <div
                  key={tool.stepNum}
                  className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    {tool.status === 'running' ? (
                      <Loader2 size={12} className="text-cyan-400 animate-spin flex-shrink-0" />
                    ) : tool.status === 'done' ? (
                      <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle size={12} className="text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-cyan-400 font-medium">{toolLabel(tool.toolName)}</span>
                    {toolDetail(tool) && (
                      <span className="text-gray-500 font-mono truncate max-w-[300px]">{toolDetail(tool)}</span>
                    )}
                  </div>
                  {tool.status !== 'running' && tool.result && (
                    <div className="text-gray-600 text-[11px] pl-5 truncate max-w-full">
                      {String(tool.result).slice(0, 150)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Streaming indicator */}
          {isAgentRunning && (
            <div className="flex gap-3">
              <style>{`
                @keyframes helixPulse {
                  0%, 100% { transform: scaleY(0.4); opacity: 0.4; }
                  50% { transform: scaleY(1); opacity: 1; }
                }
              `}</style>
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                <Bot size={14} className="text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                {streamingContent ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    {streamingContent}
                    <span className="inline-block w-2 h-4 rounded-sm bg-gradient-to-b from-cyan-400 to-purple-400 animate-pulse ml-0.5" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <div className="flex items-center gap-0.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className="w-1 rounded-full bg-gradient-to-t from-cyan-400 to-purple-400"
                          style={{
                            height: '12px',
                            animation: `helixPulse 1.5s ease-in-out ${i * 0.15}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="animate-pulse">{t('thinking')}</span>
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
