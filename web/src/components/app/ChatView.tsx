'use client';

import { useRef, useEffect, useCallback, useState, memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  MessageSquare, Bot, ArrowDown, Loader2, CheckCircle2, XCircle,
  Wifi, Terminal, Download, Plug, ExternalLink, Key, BookOpen,
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
  onApprovePermission?: (requestId: string) => void;
  onDenyPermission?: (requestId: string) => void;
  instanceMeta?: InstanceMeta | null;
  connectedPort?: number | null;
  cliOutputLines?: string[];
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

  // Track when agent starts responding — scroll to answer start, not bottom
  const prevAgentRunningRef = useRef(false);
  const answerStartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // When agent just started (new response), scroll to where the answer begins
    if (isAgentRunning && !prevAgentRunningRef.current) {
      // Small delay to let the streaming indicator render
      requestAnimationFrame(() => {
        answerStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      autoScrollRef.current = false; // Don't auto-scroll to bottom during this response
    }
    prevAgentRunningRef.current = isAgentRunning;
  }, [isAgentRunning]);

  // Auto-scroll on new user messages only (not during agent streaming)
  useEffect(() => {
    if (autoScrollRef.current && !isAgentRunning) {
      scrollToBottom(false);
    }
  }, [messages.length, scrollToBottom, isAgentRunning]);

  // No rAF auto-scroll during streaming — keep user at answer start

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
            {/* Step 1 — Install */}
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Download size={12} className="text-cyan-400 flex-shrink-0" />
                <p className="text-[11px] font-medium text-gray-300">{t('setupStep1Title')}</p>
              </div>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-cyan-400/80 text-[10px] font-mono">npm i -g helixmind</code>
              <p className="text-[9px] text-gray-700">{t('setupStep1Requires')}</p>
            </div>

            {/* Step 2 — Configure provider */}
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Key size={12} className="text-amber-400 flex-shrink-0" />
                <p className="text-[11px] font-medium text-gray-300">{t('setupStep2Title')}</p>
              </div>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-amber-400/80 text-[10px] font-mono">hx config set provider anthropic</code>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-amber-400/80 text-[10px] font-mono mt-1">hx config set apiKey sk-ant-...</code>
            </div>

            {/* Step 3 — Start agent */}
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Terminal size={12} className="text-cyan-400 flex-shrink-0" />
                <p className="text-[11px] font-medium text-gray-300">{t('setupStep3Title')}</p>
              </div>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-cyan-400/80 text-[10px] font-mono">cd your-project && helixmind</code>
              <p className="text-[9px] text-gray-700">{t('setupStep3Alias')}</p>
            </div>

            {/* Step 4 — Init + Auto-connect */}
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Wifi size={12} className="text-emerald-400 flex-shrink-0" />
                <p className="text-[11px] font-medium text-gray-300">{t('setupStep4Title')}</p>
              </div>
              <code className="block px-2 py-1 rounded-md bg-white/5 text-purple-400/80 text-[10px] font-mono">helixmind init</code>
              <p className="text-[9px] text-gray-700">{t('setupStep5Desc')}</p>
            </div>
          </div>

          {/* Full docs link */}
          <div className="text-center">
            <a href="/docs/getting-started" className="inline-flex items-center gap-1.5 text-[10px] text-cyan-500/60 hover:text-cyan-400 transition-colors">
              <BookOpen size={11} />{t('setupDocsFullGuide')}
              <ExternalLink size={8} />
            </a>
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
            {/* ASCII Art Banner */}
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

            {/* Info Grid */}
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

            {/* CLI Output Preview */}
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

            {/* Start hint */}
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

          {/* Pending permission requests */}
          {pendingPermissions.length > 0 && (
            <div className="space-y-2">
              {pendingPermissions.map((perm) => (
                <PermissionRequestCard
                  key={perm.id}
                  request={perm}
                  onApprove={() => onApprovePermission?.(perm.id)}
                  onDeny={() => onDenyPermission?.(perm.id)}
                />
              ))}
            </div>
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
            <div ref={answerStartRef} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                <Bot size={14} className="text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                {streamingContent ? (
                  <div className="prose prose-invert prose-sm max-w-none text-sm text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                    <StreamingText text={streamingContent} />
                    <span className="inline-block w-2 h-5 rounded-sm bg-gradient-to-b from-cyan-400 to-purple-400 ml-0.5 align-middle" style={{ animation: 'helix-glow 1.5s ease-in-out infinite, blink 1s step-end infinite' }} />
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
                              animation: `helix-strand-a 1.4s linear ${i * 0.1}s infinite`,
                              transformOrigin: 'bottom',
                              willChange: 'transform, opacity',
                            }}
                          />
                          <span
                            className="w-[3px] rounded-full bg-purple-400"
                            style={{
                              height: '14px',
                              animation: `helix-strand-b 1.4s linear ${i * 0.1}s infinite`,
                              transformOrigin: 'top',
                              willChange: 'transform, opacity',
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
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 right-4 p-2 rounded-full bg-surface/90 border border-white/10 text-gray-400 hover:text-white shadow-lg backdrop-blur-sm transition-all hover:scale-105"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}
