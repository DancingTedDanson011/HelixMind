'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Send, Square, ChevronDown, Shield, ShieldOff,
  Zap, Eye, ShieldAlert, Key, ArrowRight, Terminal, Bot, Paperclip,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { SlashCommandMenu } from './SlashCommandMenu';
import { FileAttachmentPill } from './FileAttachment';
import type { FileInfo } from './FileAttachment';

interface ChatInputProps {
  onSend: (content: string) => void;
  isAgentRunning: boolean;
  onStop: () => void;
  mode: 'normal' | 'skip-permissions' | 'yolo';
  onModeChange: (mode: 'normal' | 'skip-permissions' | 'yolo') => void;
  disabled: boolean;
  hasLLMKey?: boolean;
  /** Whether there's an active chat open */
  hasChat?: boolean;
  /** Whether CLI is connected */
  isConnected?: boolean;
  /** Current active tab — controls which quick actions are shown */
  activeTab?: 'chat' | 'console' | 'monitor' | 'jarvis';
  /** Whether this is a pure chat (no CLI session attached) */
  isPureChat?: boolean;
  /** Callback to hand off a pure chat to an agent tab */
  onGiveToAgent?: (target: 'console' | 'monitor' | 'jarvis') => void;
  /** Switch to a different tab */
  onSwitchTab?: (tab: 'console' | 'monitor' | 'jarvis') => void;
  /** Which CLI modes are currently active (have running sessions) */
  activeCliModes?: { console: boolean; monitor: boolean; jarvis: boolean };
  /** Active tab color for accent theming */
  tabColor?: 'chat' | 'console' | 'monitor' | 'jarvis';
  /** Callback for sending with file attachments */
  onSendWithFiles?: (content: string, files: FileInfo[]) => void;
}

export function ChatInput({
  onSend,
  isAgentRunning,
  onStop,
  mode,
  onModeChange,
  disabled,
  hasLLMKey = false,
  hasChat = false,
  isConnected = false,
  activeTab = 'chat',
  isPureChat = false,
  onGiveToAgent,
  onSwitchTab,
  activeCliModes = { console: false, monitor: false, jarvis: false },
  tabColor = 'chat',
  onSendWithFiles,
}: ChatInputProps) {
  const t = useTranslations('app');
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [giveMenuOpen, setGiveMenuOpen] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileInfo[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const giveRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
      if (giveRef.current && !giveRef.current.contains(e.target as Node)) {
        setGiveMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // File handling
  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, 3 - attachedFiles.length); // max 3 total
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) return; // skip > 5MB
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachedFiles((prev) => {
          if (prev.length >= 3) return prev;
          return [...prev, {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            dataBase64: base64,
          }];
        });
      };
      reader.readAsDataURL(file);
    });
  }, [attachedFiles.length]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [addFiles]);

  const handleSend = useCallback(() => {
    if (!value.trim() || disabled || isAgentRunning) return;
    if (attachedFiles.length > 0 && onSendWithFiles) {
      onSendWithFiles(value, attachedFiles);
    } else {
      onSend(value);
    }
    setValue('');
    setAttachedFiles([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, isAgentRunning, onSend, onSendWithFiles, attachedFiles]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Let SlashCommandMenu handle navigation keys when open
    if (slashMenuOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab' || e.key === 'Escape')) {
      return; // SlashCommandMenu's global handler will catch this
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (slashMenuOpen) return; // Let menu handle Enter
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, slashMenuOpen]);

  // Slash command detection
  const isSlashQuery = value.startsWith('/') && !value.includes('\n');
  const slashQuery = isSlashQuery ? value.slice(1).split(/\s/)[0] : '';
  const showSlashMenu = isSlashQuery && slashQuery === value.slice(1).trim() && !isAgentRunning;

  useEffect(() => {
    setSlashMenuOpen(showSlashMenu);
  }, [showSlashMenu]);

  const handleSlashSelect = useCallback((command: string) => {
    setValue('/' + command + ' ');
    setSlashMenuOpen(false);
    textareaRef.current?.focus();
  }, []);

  const showQuickActions = hasChat && !isAgentRunning;

  return (
    <div className="border-t border-white/5 bg-surface/50 backdrop-blur-sm px-4 pt-3 pb-4">
      <div className="max-w-3xl mx-auto">
        {/* Quick action buttons — tab-specific, above input */}
        {showQuickActions && (
          <div className="flex items-center gap-1.5 mb-2 px-1 overflow-x-auto scrollbar-none">
            {(activeTab === 'chat' || activeTab === 'console') && (
              <button
                onClick={() => onSend('Run an automatic code review and improvement analysis on the current project. Look for bugs, code smells, and potential improvements.')}
                disabled={!isConnected}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/[0.03] border border-white/5 transition-all flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed text-cyan-400/60 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/20"
                title={t('quickAutoReviewDesc')}
              >
                <Zap size={10} />
                {t('quickAutoReview')}
              </button>
            )}
            {(activeTab === 'chat' || activeTab === 'console') && (
              <button
                onClick={() => onSend('Perform a comprehensive security audit on the current project. Check for vulnerabilities, exposed secrets, unsafe dependencies, and security best practices.')}
                disabled={!isConnected}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/[0.03] border border-white/5 transition-all flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed text-amber-400/60 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20"
                title={t('quickSecurityAuditDesc')}
              >
                <ShieldAlert size={10} />
                {t('quickSecurityAudit')}
              </button>
            )}
            {(activeTab === 'chat' || activeTab === 'monitor') && (
              <button
                onClick={() => onSend('Start monitoring the project for file changes and potential issues. Watch for errors, test failures, and code quality problems.')}
                disabled={!isConnected}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/[0.03] border border-white/5 transition-all flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed text-blue-400/60 hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20"
                title={t('quickMonitorDesc')}
              >
                <Eye size={10} />
                {t('quickMonitor')}
              </button>
            )}

            {/* Mode-switch buttons — show inactive modes in chat tab */}
            {activeTab === 'chat' && isConnected && onSwitchTab && (
              <>
                {!activeCliModes.console && (
                  <button
                    onClick={() => onSwitchTab('console')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/[0.03] border border-white/5 transition-all flex-shrink-0 text-emerald-400/50 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20"
                    title={t('switchToConsoleDesc')}
                  >
                    <Terminal size={10} />
                    {t('switchToConsole')}
                  </button>
                )}
                {!activeCliModes.monitor && (
                  <button
                    onClick={() => onSwitchTab('monitor')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/[0.03] border border-white/5 transition-all flex-shrink-0 text-blue-400/50 hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20"
                    title={t('switchToMonitorDesc')}
                  >
                    <Eye size={10} />
                    {t('switchToMonitor')}
                  </button>
                )}
                {!activeCliModes.jarvis && (
                  <button
                    onClick={() => onSwitchTab('jarvis')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/[0.03] border border-white/5 transition-all flex-shrink-0 text-red-400/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                    title={t('switchToJarvisDesc')}
                  >
                    <Bot size={10} />
                    {t('switchToJarvis')}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* "Give to Agent" button for pure chats */}
        {isPureChat && hasChat && isConnected && onGiveToAgent && !isAgentRunning && (
          <div className="flex items-center gap-1.5 mb-2 px-1" ref={giveRef}>
            <div className="relative">
              <button
                onClick={() => setGiveMenuOpen(!giveMenuOpen)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-amber-500/5 border border-amber-500/15 text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-400 transition-all"
              >
                <ArrowRight size={10} />
                {t('giveToAgent')}
                <ChevronDown size={8} />
              </button>
              {giveMenuOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-44 rounded-xl border border-white/10 bg-[#0a0a1a]/95 backdrop-blur-xl shadow-2xl py-1 z-50">
                  <button
                    onClick={() => { onGiveToAgent('console'); setGiveMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors"
                  >
                    <Terminal size={12} className="text-emerald-400" />
                    {t('sendToConsole')}
                  </button>
                  <button
                    onClick={() => { onGiveToAgent('monitor'); setGiveMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-blue-400 hover:bg-blue-500/5 transition-colors"
                  >
                    <Eye size={12} className="text-blue-400" />
                    {t('sendToMonitor')}
                  </button>
                  <button
                    onClick={() => { onGiveToAgent('jarvis'); setGiveMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                  >
                    <Bot size={12} className="text-red-400" />
                    {t('sendToJarvis')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Slash command autocomplete menu */}
        {slashMenuOpen && (
          <div className="relative">
            <SlashCommandMenu
              query={slashQuery}
              onSelect={handleSlashSelect}
              onClose={() => setSlashMenuOpen(false)}
            />
          </div>
        )}

        {/* Attached files pills */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 px-1">
            {attachedFiles.map((file, i) => (
              <FileAttachmentPill
                key={`${file.name}-${i}`}
                file={file}
                onRemove={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Outer glow wrapper — symmetrical on all sides, colored by tab */}
        <div
          className={`relative rounded-2xl transition-all duration-300 ${
            isDragOver ? 'ring-2 ring-cyan-500/30 bg-cyan-500/5' : ''
          } ${
            isFocused
              ? tabColor === 'console' ? 'shadow-[0_0_25px_rgba(16,185,129,0.12),0_0_60px_rgba(16,185,129,0.04)]'
                : tabColor === 'monitor' ? 'shadow-[0_0_25px_rgba(96,165,250,0.12),0_0_60px_rgba(96,165,250,0.04)]'
                : tabColor === 'jarvis' ? 'shadow-[0_0_25px_rgba(248,113,113,0.12),0_0_60px_rgba(248,113,113,0.04)]'
                : 'shadow-[0_0_25px_rgba(0,212,255,0.12),0_0_60px_rgba(0,212,255,0.04)]'
              : tabColor === 'console' ? 'shadow-[0_0_8px_rgba(16,185,129,0.03)]'
                : tabColor === 'monitor' ? 'shadow-[0_0_8px_rgba(96,165,250,0.03)]'
                : tabColor === 'jarvis' ? 'shadow-[0_0_8px_rgba(248,113,113,0.03)]'
                : 'shadow-[0_0_8px_rgba(0,212,255,0.03)]'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={`relative flex items-end rounded-2xl border transition-all duration-300 ${
            isFocused
              ? tabColor === 'console' ? 'border-emerald-500/30 bg-white/[0.04]'
                : tabColor === 'monitor' ? 'border-blue-500/30 bg-white/[0.04]'
                : tabColor === 'jarvis' ? 'border-red-500/30 bg-white/[0.04]'
                : 'border-cyan-500/30 bg-white/[0.04]'
              : 'border-white/[0.07] bg-white/[0.02]'
          }`}>
            {/* Mode selector — left side with border separator */}
            <div className="relative flex-shrink-0 self-stretch" ref={modeRef}>
              <button
                onClick={() => setModeMenuOpen(!modeMenuOpen)}
                className={`
                  flex items-center gap-1 px-3 h-full border-r transition-all rounded-l-2xl text-xs font-medium
                  ${isFocused
                    ? tabColor === 'console' ? 'border-emerald-500/15'
                      : tabColor === 'monitor' ? 'border-blue-500/15'
                      : tabColor === 'jarvis' ? 'border-red-500/15'
                      : 'border-cyan-500/15'
                    : 'border-white/[0.07]'}
                  ${mode === 'skip-permissions'
                    ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/5'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }
                `}
                title={mode === 'normal' ? t('modeNormal') : t('modeSkipPermissions')}
              >
                {mode === 'skip-permissions' ? <ShieldOff size={14} /> : <Shield size={14} />}
              </button>

              {modeMenuOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-48 rounded-xl border border-white/10 bg-[#0a0a1a]/95 backdrop-blur-xl shadow-2xl py-1 z-50">
                  <button
                    onClick={() => { onModeChange('normal'); setModeMenuOpen(false); }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${
                      mode === 'normal' ? 'text-cyan-400 bg-cyan-500/5' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Shield size={13} />
                    {t('modeNormal')}
                  </button>
                  <button
                    onClick={() => { onModeChange('skip-permissions'); setModeMenuOpen(false); }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${
                      mode === 'skip-permissions' ? 'text-amber-400 bg-amber-500/5' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <ShieldOff size={13} />
                    {t('modeSkipPermissions')}
                  </button>
                </div>
              )}
            </div>

            {/* Attach file button */}
            {isConnected && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={attachedFiles.length >= 3 || isAgentRunning}
                className="flex-shrink-0 self-center px-1.5 text-gray-600 hover:text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={t('attachFile')}
              >
                <Paperclip size={15} />
              </button>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={t('sendMessage')}
              disabled={disabled}
              rows={1}
              className="flex-1 resize-none bg-transparent py-3 px-3 text-sm text-gray-200 placeholder-gray-600 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            />

            {/* Send / Stop button */}
            <div className="flex-shrink-0 self-end p-2">
              {isAgentRunning ? (
                <button
                  onClick={onStop}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-all"
                >
                  <Square size={12} />
                  {t('stopAgent')}
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!value.trim() || disabled}
                  className={`w-9 h-9 rounded-full transition-all duration-200 flex items-center justify-center ${
                    value.trim() && !disabled
                      ? tabColor === 'console' ? 'bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:bg-emerald-500/30 hover:shadow-[0_0_16px_rgba(16,185,129,0.4)]'
                        : tabColor === 'monitor' ? 'bg-blue-500/20 text-blue-300 shadow-[0_0_12px_rgba(96,165,250,0.3)] hover:bg-blue-500/30 hover:shadow-[0_0_16px_rgba(96,165,250,0.4)]'
                        : tabColor === 'jarvis' ? 'bg-red-500/20 text-red-300 shadow-[0_0_12px_rgba(248,113,113,0.3)] hover:bg-red-500/30 hover:shadow-[0_0_16px_rgba(248,113,113,0.4)]'
                        : 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_12px_rgba(0,212,255,0.3)] hover:bg-cyan-500/30 hover:shadow-[0_0_16px_rgba(0,212,255,0.4)]'
                      : 'bg-white/[0.03] text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed'
                  }`}
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hints below input */}
        {mode === 'skip-permissions' && (
          <div className="mt-1.5 text-[10px] text-amber-500/60 flex items-center gap-1 px-3">
            <ShieldOff size={10} />
            {t('skipPermissionsWarning')}
          </div>
        )}

        {!hasLLMKey && (
          <div className="mt-1.5 text-[10px] text-gray-500 flex items-center gap-1 px-3">
            <Key size={9} className="text-cyan-500/50" />
            <Link href={'/dashboard/api-keys' as any} className="text-cyan-500/70 hover:text-cyan-400 underline underline-offset-2 transition-colors">
              {t('noApiKeyLink')}
            </Link>
            <span className="text-gray-600">{t('noApiKeyText')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
