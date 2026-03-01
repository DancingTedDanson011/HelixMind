'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  MessageSquare, Bot, ArrowDown, Loader2, CheckCircle2, XCircle,
  Wifi, Terminal, Download, Plug, ExternalLink, FolderOpen, Key, BookOpen,
} from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { AgentPromptBlock } from './AgentPromptBlock';
import type { ChatMessage } from './AppShell';
import type { ActiveTool } from '@/hooks/use-cli-chat';

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
}: ChatViewProps) {
  const t = useTranslations('app');
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const autoScrollRef = useRef(true);

  const scrollToBottom = useCallback((instant = false) => {
    const el = containerRef.current;
    if (el) {
      if (instant) {
        el.scrollTop = el.scrollHeight;
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
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

  // Empty state — no chat selected or empty chat without connection
  if (!hasChat || (messages.length === 0 && !isAgentRunning && !isConnected)) {
    return (
      <div className="flex items-center justify-center h-full overflow-y-auto py-8">
        <div className="space-y-6 max-w-md px-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center">
              <Plug size={24} className="text-cyan-500/40" />
            </div>
            <h3 className="text-base font-medium text-gray-300">{t('setupTitle')}</h3>
            <p className="text-xs text-gray-600 max-w-xs mx-auto">{t('setupDesc')}</p>
          </div>

          {/* Steps */}
          <div className="space-y-3 text-left">
            {/* Step 1 — Install */}
            <div className="px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Download size={12} className="text-cyan-400" />
                </div>
                <p className="text-xs font-medium text-gray-300">{t('setupStep1Title')}</p>
              </div>
              <p className="text-[11px] text-gray-600 pl-[34px]">{t('setupStep1Desc')}</p>
              <div className="pl-[34px]">
                <code className="inline-block px-2 py-1 rounded-md bg-white/5 text-cyan-400/80 text-[11px] font-mono">npm install -g helixmind</code>
              </div>
              <p className="text-[10px] text-gray-700 pl-[34px]">{t('setupStep1Requires')}</p>
              <a href="/docs/getting-started" className="flex items-center gap-1 text-[10px] text-cyan-500/60 hover:text-cyan-400 transition-colors pl-[34px]">
                <BookOpen size={10} />{t('setupDocsInstall')}
                <ExternalLink size={8} />
              </a>
            </div>

            {/* Step 2 — Configure provider */}
            <div className="px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Key size={12} className="text-amber-400" />
                </div>
                <p className="text-xs font-medium text-gray-300">{t('setupStep2Title')}</p>
              </div>
              <p className="text-[11px] text-gray-600 pl-[34px]">{t('setupStep2Desc')}</p>
              <div className="pl-[34px] space-y-1">
                <code className="inline-block px-2 py-1 rounded-md bg-white/5 text-amber-400/80 text-[11px] font-mono">helixmind config set provider anthropic</code>
                <br />
                <code className="inline-block px-2 py-1 rounded-md bg-white/5 text-amber-400/80 text-[11px] font-mono">helixmind config set apiKey sk-ant-...</code>
              </div>
              <a href="/docs/providers" className="flex items-center gap-1 text-[10px] text-cyan-500/60 hover:text-cyan-400 transition-colors pl-[34px]">
                <BookOpen size={10} />{t('setupDocsProviders')}
                <ExternalLink size={8} />
              </a>
            </div>

            {/* Step 3 — Start agent */}
            <div className="px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Terminal size={12} className="text-cyan-400" />
                </div>
                <p className="text-xs font-medium text-gray-300">{t('setupStep3Title')}</p>
              </div>
              <p className="text-[11px] text-gray-600 pl-[34px]">{t('setupStep3Desc')}</p>
              <div className="pl-[34px] space-y-1">
                <code className="inline-block px-2 py-1 rounded-md bg-white/5 text-cyan-400/80 text-[11px] font-mono">cd your-project</code>
                <br />
                <code className="inline-block px-2 py-1 rounded-md bg-white/5 text-cyan-400/80 text-[11px] font-mono">helixmind</code>
                <span className="text-[10px] text-gray-700 ml-1.5">{t('setupStep3Alias')}</span>
              </div>
              <a href="/docs/cli-reference" className="flex items-center gap-1 text-[10px] text-cyan-500/60 hover:text-cyan-400 transition-colors pl-[34px]">
                <BookOpen size={10} />{t('setupDocsCli')}
                <ExternalLink size={8} />
              </a>
            </div>

            {/* Step 4 — Init project */}
            <div className="px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <FolderOpen size={12} className="text-purple-400" />
                </div>
                <p className="text-xs font-medium text-gray-300">{t('setupStep4Title')}</p>
              </div>
              <p className="text-[11px] text-gray-600 pl-[34px]">{t('setupStep4Desc')}</p>
              <div className="pl-[34px]">
                <code className="inline-block px-2 py-1 rounded-md bg-white/5 text-purple-400/80 text-[11px] font-mono">helixmind init</code>
              </div>
              <a href="/docs/project-setup" className="flex items-center gap-1 text-[10px] text-cyan-500/60 hover:text-cyan-400 transition-colors pl-[34px]">
                <BookOpen size={10} />{t('setupDocsProject')}
                <ExternalLink size={8} />
              </a>
            </div>

            {/* Step 5 — Auto-connect */}
            <div className="px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Wifi size={12} className="text-emerald-400" />
                </div>
                <p className="text-xs font-medium text-gray-300">{t('setupStep5Title')}</p>
              </div>
              <p className="text-[11px] text-gray-600 pl-[34px]">{t('setupStep5Desc')}</p>
            </div>
          </div>

          {/* Full docs link */}
          <div className="text-center pt-1">
            <a href="/docs/getting-started" className="inline-flex items-center gap-1.5 text-[11px] text-cyan-500/60 hover:text-cyan-400 transition-colors">
              <BookOpen size={12} />{t('setupDocsFullGuide')}
              <ExternalLink size={9} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Empty chat — connected, no messages yet
  if (messages.length === 0 && !isAgentRunning) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md px-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/10 flex items-center justify-center">
              <Wifi size={28} className="text-emerald-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-300">{t('cliConnected')}</h3>
            <p className="text-sm text-gray-600">{t('chatTabHint')}</p>
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
            <div className="flex gap-3 animate-message-in">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                <Bot size={14} className="text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                {streamingContent ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    {streamingContent}
                    <span className="inline-block w-2 h-5 rounded-sm bg-gradient-to-b from-cyan-400 to-purple-400 ml-0.5" style={{ animation: 'helix-glow 1.5s ease-in-out infinite, blink 1s step-end infinite' }} />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    {/* Helix DNA thinking animation */}
                    <div className="flex items-end gap-[2px]">
                      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex flex-col gap-[2px]">
                          <span
                            className="w-[3px] rounded-full bg-cyan-400"
                            style={{
                              height: '14px',
                              animation: `helix-strand-a 1.8s ease-in-out ${i * 0.12}s infinite`,
                              transformOrigin: 'bottom',
                            }}
                          />
                          <span
                            className="w-[3px] rounded-full bg-purple-400"
                            style={{
                              height: '14px',
                              animation: `helix-strand-b 1.8s ease-in-out ${i * 0.12}s infinite`,
                              transformOrigin: 'top',
                            }}
                          />
                        </div>
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
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 right-4 p-2 rounded-full bg-surface/90 border border-white/10 text-gray-400 hover:text-white shadow-lg backdrop-blur-sm transition-all hover:scale-105"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}
