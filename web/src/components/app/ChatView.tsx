'use client';

import { useRef, useEffect, useCallback, useState, memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  MessageSquare, Bot, ArrowDown, Loader2, CheckCircle2, XCircle,
  Wifi, Terminal, Download, Plug, ExternalLink, Key, BookOpen,
  Square, Globe, Smartphone,
} from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { AgentPromptBlock } from './AgentPromptBlock';
import { PermissionRequestCard } from './PermissionRequestCard';
import { StreamingText } from './StreamingText';
import type { ChatMessage } from './AppShell';
import type { ActiveTool } from '@/hooks/use-cli-chat';
import type { ToolPermissionRequest, InstanceMeta } from '@/lib/cli-types';

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

/* ─── Tab accent color mapping ─────────────────── */

const TAB_ACCENT = {
  chat:    { dot: 'bg-cyan-400',    cursor: 'bg-cyan-400',    text: 'text-cyan-400' },
  console: { dot: 'bg-emerald-400', cursor: 'bg-emerald-400', text: 'text-emerald-400' },
  monitor: { dot: 'bg-blue-400',    cursor: 'bg-blue-400',    text: 'text-blue-400' },
  jarvis:  { dot: 'bg-red-400',     cursor: 'bg-red-400',     text: 'text-red-400' },
} as const;

/* ─── Thinking Dots ─────────────────────────────── */

function ThinkingDots({ accentDot = 'bg-gray-400' }: { accentDot?: string }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${accentDot}`}
          style={{
            animation: `thinking-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
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
  pendingPermissions?: ToolPermissionRequest[];
  onApprovePermission?: (requestId: string, mode?: 'once' | 'session' | 'yolo') => void;
  onDenyPermission?: (requestId: string) => void;
  instanceMeta?: InstanceMeta | null;
  connectedPort?: number | null;
  cliOutputLines?: string[];
  /** Stop callback for floating stop button */
  onStop?: () => void;
  /** Active tab for accent color theming */
  tabColor?: 'chat' | 'console' | 'monitor' | 'jarvis';
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
  pendingPermissions = [],
  onApprovePermission,
  onDenyPermission,
  instanceMeta,
  connectedPort,
  cliOutputLines = [],
  onStop,
  tabColor = 'chat',
}: ChatViewProps) {
  const t = useTranslations('app');
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const autoScrollRef = useRef(true);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = containerRef.current;
    if (el) {
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
      autoScrollRef.current = true;
      setShowScrollBtn(false);
    }
  }, []);

  // Track when agent starts responding — scroll to answer start
  const prevAgentRunningRef = useRef(false);
  const answerStartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAgentRunning && !prevAgentRunningRef.current) {
      requestAnimationFrame(() => {
        answerStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      autoScrollRef.current = false;
    }
    prevAgentRunningRef.current = isAgentRunning;
  }, [isAgentRunning]);

  // Auto-scroll on new user messages only
  useEffect(() => {
    if (autoScrollRef.current && !isAgentRunning) {
      scrollToBottom(false);
    }
  }, [messages.length, scrollToBottom, isAgentRunning]);

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
      <div className="flex items-center justify-center h-full overflow-y-auto py-6">
        <div className="space-y-4 max-w-lg px-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="mx-auto w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center">
              <Plug size={18} className="text-cyan-500/40" />
            </div>
            <h3 className="text-sm font-medium text-gray-300">{t('setupTitle')}</h3>
            <p className="text-[11px] text-gray-600">{t('setupDesc')}</p>
          </div>

          {/* Steps — 2-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Download size={12} className="text-cyan-400 flex-shrink-0" />
                <p className="text-[11px] font-medium text-gray-300">{t('setupStep1Title')}</p>
              </div>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-cyan-400/80 text-[10px] font-mono">npm i -g helixmind</code>
              <p className="text-[9px] text-gray-500">{t('setupStep1Requires')}{' '}
                <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-cyan-500/70 hover:text-cyan-400 underline">nodejs.org</a>
              </p>
              <p className="text-[9px] text-gray-700">{t('setupStep1Start')}</p>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-cyan-400/80 text-[10px] font-mono">cd your-project && helixmind</code>
              <p className="text-[9px] text-gray-700">{t('setupStep3Alias')}</p>
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Key size={12} className="text-amber-400 flex-shrink-0" />
                <p className="text-[11px] font-medium text-gray-300">{t('setupStep2Title')}</p>
              </div>
              <p className="text-[9px] text-gray-500">{t('setupStep2Hint')}</p>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-amber-400/80 text-[10px] font-mono">/model</code>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-amber-400/80 text-[10px] font-mono mt-1">/api sk-ant-...</code>
              <p className="text-[9px] text-gray-700 mt-0.5">{t('setupStep2Cli')}</p>
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Terminal size={12} className="text-cyan-400 flex-shrink-0" />
                <p className="text-[11px] font-medium text-gray-300">{t('setupStep3Title')}</p>
              </div>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-cyan-400/80 text-[10px] font-mono">cd your-project && helixmind</code>
              <p className="text-[9px] text-gray-500">{t('setupStep3Explorer')}</p>
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Wifi size={12} className="text-emerald-400 flex-shrink-0" />
                <p className="text-[11px] font-medium text-gray-300">{t('setupStep4Title')}</p>
              </div>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-emerald-400/80 text-[10px] font-mono">/feed</code>
              <p className="text-[9px] text-gray-500">{t('setupStep4Mode')}</p>
              <div className="flex gap-1.5 flex-wrap mt-0.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400/70 font-mono">CLI</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400/70 font-mono">Monitor</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/70 font-mono">Jarvis</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <a href="/docs/getting-started" className="inline-flex items-center gap-1.5 text-[10px] text-cyan-500/60 hover:text-cyan-400 transition-colors">
              <BookOpen size={11} />{t('setupDocsFullGuide')}
              <ExternalLink size={8} />
            </a>
          </div>

          {/* Remote Access Section */}
          <div className="px-3 py-3 rounded-lg bg-gradient-to-br from-purple-500/[0.04] to-cyan-500/[0.04] border border-purple-500/10 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                <Globe size={12} className="text-purple-400" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-300">{t('remoteTitle')}</p>
                <p className="text-[9px] text-gray-500">{t('remoteDesc')}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[9px] text-gray-500">{t('remoteStep1')}</p>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-purple-400/80 text-[10px] font-mono">helixmind connect</code>
              <p className="text-[9px] text-gray-500">{t('remoteStep2')}</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[9px] text-gray-600">
                  <Smartphone size={9} />
                  <span>{t('remoteStep3')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[8px] text-gray-600 font-mono">{t('remoteOr')} helixmind login</span>
              <a href="/docs/remote-access" className="inline-flex items-center gap-1 text-[9px] text-purple-400/60 hover:text-purple-400 transition-colors">
                {t('remoteLearnMore')} <ExternalLink size={8} />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty chat — connected, no messages yet → Welcome Banner
  if (messages.length === 0 && !isAgentRunning) {
    const meta = instanceMeta;
    const modeLabel = meta?.permissionMode === 'yolo' ? 'YOLO'
      : meta?.permissionMode === 'skip-permissions' ? 'skip permissions'
      : 'safe permissions';
    const provider = meta ? `${meta.provider} · ${meta.model}` : '—';
    const project = meta?.projectPath.split(/[/\\]/).filter(Boolean).pop() || meta?.projectName || '—';
    const brainUrl = connectedPort ? `ws://127.0.0.1:${connectedPort}` : '—';
    const version = meta?.version || '—';
    const outputPreview = cliOutputLines.slice(-10);

    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto flex items-center justify-center py-8">
          <div className="space-y-6 max-w-lg px-6 w-full">
            <pre
              className="text-[10px] sm:text-xs leading-tight font-mono text-center select-none"
              style={{
                background: 'linear-gradient(135deg, #22d3ee 0%, #a855f7 50%, #22d3ee 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >{`  ██╗  ██╗███████╗██╗     ██╗██╗  ██╗
  ██║  ██║██╔════╝██║     ██║╚██╗██╔╝
  ███████║█████╗  ██║     ██║ ╚███╔╝
  ██╔══██║██╔══╝  ██║     ██║ ██╔██╗
  ██║  ██║███████╗███████╗██║██╔╝ ██╗
  ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝╚═╝  ╚═╝`}</pre>
            <div
              className="text-center text-xs font-mono tracking-[0.3em] select-none"
              style={{
                background: 'linear-gradient(90deg, #22d3ee, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              ─── Mind ───
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs px-4">
              <span className="text-gray-600">{t('bannerProvider')}</span>
              <span className="text-gray-300 truncate">{provider}</span>
              <span className="text-gray-600">{t('bannerProject')}</span>
              <span className="text-cyan-400 truncate">{project}</span>
              <span className="text-gray-600">{t('bannerBrain')}</span>
              <span className="text-purple-400 truncate">{brainUrl}</span>
              <span className="text-gray-600">{t('bannerMode')}</span>
              <span className={`truncate ${
                meta?.permissionMode === 'yolo' ? 'text-red-400' :
                meta?.permissionMode === 'skip-permissions' ? 'text-amber-400' :
                'text-emerald-400'
              }`}>{modeLabel}</span>
              <span className="text-gray-600">{t('bannerVersion')}</span>
              <span className="text-gray-500">{version}</span>
            </div>

            {outputPreview.length > 0 && (
              <div className="space-y-1.5 px-4">
                <div className="text-[10px] font-mono text-gray-600 tracking-wider">── Recent Output ──</div>
                <div className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 max-h-32 overflow-y-auto">
                  {outputPreview.map((line, i) => (
                    <div key={i} className="text-[10px] font-mono text-gray-500 truncate leading-relaxed">{line || '\u00A0'}</div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-gray-600 animate-pulse">{t('bannerStartHint')}</p>
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
        className="h-full overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        <div className="max-w-2xl mx-auto space-y-6">
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

          {/* Pending permission requests */}
          {pendingPermissions.length > 0 && (
            <div className="space-y-2">
              {pendingPermissions.map((perm) => (
                <PermissionRequestCard
                  key={perm.id}
                  request={perm}
                  onApprove={(mode) => onApprovePermission?.(perm.id, mode)}
                  onDeny={() => onDenyPermission?.(perm.id)}
                />
              ))}
            </div>
          )}

          {/* Active tool calls — elegant animated style */}
          {activeTools.length > 0 && isAgentRunning && (
            <div className="space-y-2 ml-1 animate-fade-in">
              {activeTools.map((tool, index) => (
                <div 
                  key={tool.stepNum} 
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {tool.status === 'running' ? (
                    <Loader2 size={14} className="text-cyan-400 animate-spin flex-shrink-0" />
                  ) : tool.status === 'done' ? (
                    <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle size={14} className="text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-xs font-medium text-gray-300">{toolLabel(tool.toolName)}</span>
                  {toolDetail(tool) && (
                    <span className="text-xs text-gray-500 font-mono truncate max-w-[280px] bg-white/5 px-1.5 py-0.5 rounded">{toolDetail(tool)}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Streaming response */}
          {isAgentRunning && (
            <div ref={answerStartRef} className="animate-message-in">
              {streamingContent ? (
                <div className="text-[15px] text-gray-200 whitespace-pre-wrap break-words leading-[1.7]">
                  <StreamingText text={streamingContent} />
                  <span
                    className={`inline-block w-[2px] h-[1.1em] ${TAB_ACCENT[tabColor].cursor} ml-0.5 align-middle rounded-full`}
                    style={{ animation: 'cursor-blink 1s step-end infinite' }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2.5 py-1">
                  <ThinkingDots accentDot={TAB_ACCENT[tabColor].dot} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom padding for breathing room */}
        <div className="h-8" />
      </div>

      {/* Floating stop button */}
      {isAgentRunning && onStop && (
        <button
          onClick={onStop}
          className="absolute bottom-20 right-6 z-10 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 text-xs font-medium transition-all shadow-lg backdrop-blur-sm"
        >
          <Square size={12} />
          {t('stopAgent')}
        </button>
      )}

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-surface/90 border border-white/10 text-gray-400 hover:text-white shadow-lg backdrop-blur-sm transition-all hover:scale-105 text-xs flex items-center gap-1.5"
        >
          <ArrowDown size={12} />
        </button>
      )}
    </div>
  );
}
