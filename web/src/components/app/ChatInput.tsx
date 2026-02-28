'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Square, ChevronDown, Shield, ShieldOff } from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string) => void;
  isAgentRunning: boolean;
  onStop: () => void;
  mode: 'normal' | 'skip-permissions';
  onModeChange: (mode: 'normal' | 'skip-permissions') => void;
  disabled: boolean;
  isConnected?: boolean;
  hasLLMKey?: boolean;
}

export function ChatInput({
  onSend,
  isAgentRunning,
  onStop,
  mode,
  onModeChange,
  disabled,
  isConnected = true,
  hasLLMKey = false,
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

  return (
    <div className="border-t border-white/5 bg-surface/50 backdrop-blur-sm p-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2">
          {/* Mode selector */}
          <div className="relative" ref={modeRef}>
            <button
              onClick={() => setModeMenuOpen(!modeMenuOpen)}
              className={`
                flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all border
                ${mode === 'skip-permissions'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/15'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }
              `}
              title={mode === 'normal' ? t('modeNormal') : t('modeSkipPermissions')}
            >
              {mode === 'skip-permissions' ? <ShieldOff size={13} /> : <Shield size={13} />}
              <ChevronDown size={10} />
            </button>

            {modeMenuOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-48 rounded-lg border border-white/10 bg-[#0a0a1a]/95 backdrop-blur-xl shadow-2xl py-1 z-50">
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
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('sendMessage')}
              disabled={disabled}
              rows={1}
              className="w-full resize-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-cyan-500/30 focus:bg-white/[0.07] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          {/* Send / Stop button */}
          {isAgentRunning ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all"
            >
              <Square size={12} />
              {t('stopAgent')}
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <Send size={16} />
            </button>
          )}
        </div>

        {/* Mode hint */}
        {mode === 'skip-permissions' && (
          <div className="mt-1.5 text-[10px] text-amber-500/60 flex items-center gap-1">
            <ShieldOff size={10} />
            Skip Permissions mode — tools execute without confirmation
          </div>
        )}

        {/* Brainstorm hint */}
        {!isConnected && hasLLMKey && !disabled && (
          <div className="mt-1.5 text-[10px] text-purple-400/60 flex items-center gap-1">
            {t('brainstormHint')}
          </div>
        )}

        {/* No API key hint */}
        {!isConnected && !hasLLMKey && (
          <div className="mt-1.5 text-[10px] text-gray-600 flex items-center gap-1">
            {t('noApiKey')}
          </div>
        )}
      </div>
    </div>
  );
}
