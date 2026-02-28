'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  FileText, Copy, Pencil, Check, Plug, ChevronDown, ChevronUp,
} from 'lucide-react';

interface AgentPromptBlockProps {
  prompt: string;
  onEdit: (newPrompt: string) => void;
  onConnectInstance: () => void;
}

export function AgentPromptBlock({ prompt, onEdit, onConnectInstance }: AgentPromptBlockProps) {
  const t = useTranslations('app');
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(prompt);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt]);

  const handleSaveEdit = useCallback(() => {
    onEdit(editValue);
    setEditing(false);
  }, [editValue, onEdit]);

  return (
    <div className="mx-auto max-w-3xl my-4">
      <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <FileText size={14} />
            {t('agentPrompt')}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
              title={t('copyPrompt')}
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
            <button
              onClick={() => { setEditing(!editing); setEditValue(prompt); }}
              className={`p-1.5 rounded-md transition-all ${
                editing
                  ? 'text-cyan-400 bg-cyan-500/10'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
              title={t('editPrompt')}
            >
              <Pencil size={13} />
            </button>
          </div>
        </div>

        {/* Body */}
        {expanded && (
          <div className="px-4 py-3">
            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full min-h-[200px] rounded-lg border border-white/10 bg-[#0a0a1a] px-3 py-2 text-sm text-gray-200 font-mono resize-y outline-none focus:border-cyan-500/30 transition-all"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 rounded-lg text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {prompt}
              </div>
            )}
          </div>
        )}

        {/* Footer — Connect Instance CTA */}
        <div className="px-4 py-3 border-t border-white/5 bg-white/[0.02]">
          <button
            onClick={onConnectInstance}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 hover:border-cyan-500/30 transition-all"
          >
            <Plug size={14} />
            {t('connectInstance')}
          </button>
        </div>
      </div>
    </div>
  );
}
