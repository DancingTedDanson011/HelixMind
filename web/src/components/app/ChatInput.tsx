'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Send, Square, ChevronDown, Shield, ShieldOff,
  Zap, Eye, Activity, ShieldAlert, Bot,
} from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string) => void;
  isAgentRunning: boolean;
  onStop: () => void;
  mode: 'normal' | 'skip-permissions';
  onModeChange: (mode: 'normal' | 'skip-permissions') => void;
  disabled: boolean;
  hasLLMKey?: boolean;
  /** Whether there's an active chat open */
  hasChat?: boolean;
  /** Whether CLI is connected */
  isConnected?: boolean;
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
}: ChatInputProps) {
  const t = useTranslations('app');
  const [value, setValue] = useState('');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  // Close mode menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSend = useCallback(() => {
    if (!value.trim() || disabled || isAgentRunning) return;
    onSend(value);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, isAgentRunning, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const showQuickActions = hasChat && isConnected && !isAgentRunning;

  return (
    <div className="border-t border-white/5 bg-surface/50 backdrop-blur-sm px-4 py-3">
      <div className="max-w-3xl mx-auto">
        {/* Quick action buttons — above input, only when in a chat with CLI */}
        {showQuickActions && (
          <div className="flex items-center gap-1.5 mb-2 px-1 overflow-x-auto scrollbar-none">
            <button
              onClick={() => onSend('Run an automatic code review and improvement analysis on the current project. Look for bugs, code smells, and potential improvements.')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-gray-500 bg-white/[0.03] border border-white/5 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/20 transition-all flex-shrink-0"
            >
              <Zap size={10} />
              Auto
            </button>
            <button
              onClick={() => onSend('Perform a comprehensive security audit on the current project. Check for vulnerabilities, exposed secrets, unsafe dependencies, and security best practices.')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-gray-500 bg-white/[0.03] border border-white/5 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20 transition-all flex-shrink-0"
            >
              <ShieldAlert size={10} />
              Security
            </button>
            <button
              onClick={() => onSend('Start monitoring the project for file changes and potential issues. Watch for errors, test failures, and code quality problems.')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-gray-500 bg-white/[0.03] border border-white/5 hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/20 transition-all flex-shrink-0"
            >
              <Eye size={10} />
              Monitor
            </button>
            <button
              onClick={() => onSend('Analyze the current project structure, identify all open tasks and issues, and create a prioritized action plan for improvements.')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-gray-500 bg-white/[0.03] border border-white/5 hover:bg-fuchsia-500/10 hover:text-fuchsia-400 hover:border-fuchsia-500/20 transition-all flex-shrink-0"
            >
              <Bot size={10} />
              Jarvis
            </button>
          </div>
        )}

        <div className="relative flex items-end rounded-2xl border border-white/10 bg-white/[0.03] focus-within:border-cyan-500/25 focus-within:bg-white/[0.05] transition-all">
          {/* Mode selector — left side with border separator */}
          <div className="relative flex-shrink-0 self-stretch" ref={modeRef}>
            <button
              onClick={() => setModeMenuOpen(!modeMenuOpen)}
              className={`
                flex items-center gap-1 px-3 h-full border-r border-white/10 rounded-l-2xl text-xs font-medium transition-all
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

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('sendMessage')}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent py-3 px-3 text-sm text-gray-200 placeholder-gray-600 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          />

          {/* Send / Stop button — round */}
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
                className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                <Send size={16} />
              </button>
            )}
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
          <div className="mt-1.5 text-[10px] text-gray-600 flex items-center gap-1 px-3">
            {t('noApiKey')}
          </div>
        )}
      </div>
    </div>
  );
}
