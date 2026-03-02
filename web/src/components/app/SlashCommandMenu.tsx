'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal, Eye, ShieldAlert, Brain, MessageSquare,
  Bot, Bug, Zap, Plug, PlugZap, HelpCircle, Square,
  Activity, Users, FileText, GitBranch, Sparkles,
  Settings, Shield, RotateCcw,
} from 'lucide-react';

/* ─── Command definitions ─────────────────────── */

export interface SlashCommand {
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
}

const SLASH_COMMANDS: SlashCommand[] = [
  // Navigation
  { name: 'chat', description: 'Switch to Chat tab', category: 'Navigation', icon: <MessageSquare size={13} /> },
  { name: 'console', description: 'Switch to Console tab', category: 'Navigation', icon: <Terminal size={13} /> },
  { name: 'monitor', description: 'Switch to Monitor tab', category: 'Navigation', icon: <Eye size={13} /> },
  { name: 'jarvis', description: 'Switch to Jarvis tab', category: 'Navigation', icon: <Bot size={13} /> },
  { name: 'brain', description: 'Open 3D Brain visualization', category: 'Navigation', icon: <Brain size={13} /> },
  // Agent
  { name: 'auto', description: 'Start automatic code review', category: 'Agent', icon: <Zap size={13} /> },
  { name: 'security', description: 'Start security audit', category: 'Agent', icon: <ShieldAlert size={13} /> },
  { name: 'stop', description: 'Stop all running sessions', category: 'Agent', icon: <Square size={13} /> },
  // Bugs
  { name: 'bugs', description: 'Toggle bug journal panel', category: 'Bugs', icon: <Bug size={13} /> },
  { name: 'bugfix', description: 'Fix all open bugs', category: 'Bugs', icon: <Bug size={13} /> },
  // Connection
  { name: 'connect', description: 'Connect to CLI instance', category: 'Connection', icon: <Plug size={13} /> },
  { name: 'disconnect', description: 'Disconnect from CLI', category: 'Connection', icon: <PlugZap size={13} /> },
  // CLI Commands (forwarded to CLI)
  { name: 'help', description: 'Show available commands', category: 'Info', icon: <HelpCircle size={13} /> },
  { name: 'model', description: 'Switch LLM model', category: 'Config', icon: <Settings size={13} /> },
  { name: 'yolo', description: 'Toggle YOLO mode', category: 'Config', icon: <Zap size={13} /> },
  { name: 'skip-permissions', description: 'Toggle skip-permissions mode', category: 'Config', icon: <Shield size={13} /> },
  { name: 'spiral', description: 'Show spiral memory status', category: 'Info', icon: <Activity size={13} /> },
  { name: 'tokens', description: 'Show token usage', category: 'Info', icon: <FileText size={13} /> },
  { name: 'git', description: 'Git operations', category: 'CLI', icon: <GitBranch size={13} /> },
  { name: 'diff', description: 'Show current git diff', category: 'CLI', icon: <GitBranch size={13} /> },
  { name: 'undo', description: 'Undo last file change', category: 'CLI', icon: <RotateCcw size={13} /> },
  { name: 'compact', description: 'Compact spiral memory', category: 'CLI', icon: <Activity size={13} /> },
  { name: 'context', description: 'Show current context', category: 'CLI', icon: <FileText size={13} /> },
  { name: 'sessions', description: 'List active sessions', category: 'CLI', icon: <Users size={13} /> },
  { name: 'validation', description: 'Toggle validation mode', category: 'CLI', icon: <Shield size={13} /> },
  { name: 'feed', description: 'Feed files into spiral', category: 'CLI', icon: <FileText size={13} /> },
  { name: 'project', description: 'Show project info', category: 'Info', icon: <FileText size={13} /> },
];

/* ─── Component ─────────────────────────────────── */

interface SlashCommandMenuProps {
  query: string;
  onSelect: (command: string) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ query, onSelect, onClose }: SlashCommandMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const lowerQuery = query.toLowerCase();
  const filtered = SLASH_COMMANDS.filter((cmd) =>
    cmd.name.startsWith(lowerQuery) ||
    cmd.description.toLowerCase().includes(lowerQuery)
  );

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = itemRefs.current.get(activeIndex);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Keyboard handler — called from parent via ref or event bubbling
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (filtered.length === 0) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i >= filtered.length - 1 ? 0 : i + 1));
        break;
      case 'Tab':
      case 'Enter':
        if (filtered[activeIndex]) {
          e.preventDefault();
          onSelect(filtered[activeIndex].name);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filtered, activeIndex, onSelect, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (filtered.length === 0) return null;

  // Group by category
  const grouped = new Map<string, { cmd: SlashCommand; globalIdx: number }[]>();
  filtered.forEach((cmd, i) => {
    const arr = grouped.get(cmd.category) || [];
    arr.push({ cmd, globalIdx: i });
    grouped.set(cmd.category, arr);
  });

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-h-[280px] overflow-y-auto rounded-xl border border-white/10 bg-[#0a0a1a]/95 backdrop-blur-xl shadow-2xl z-50"
    >
      <div className="py-1">
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category}>
            <div className="px-3 py-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wider">
              {category}
            </div>
            {items.map(({ cmd, globalIdx }) => (
              <button
                key={cmd.name}
                ref={(el) => { if (el) itemRefs.current.set(globalIdx, el); }}
                onClick={() => onSelect(cmd.name)}
                onMouseEnter={() => setActiveIndex(globalIdx)}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-xs transition-colors ${
                  globalIdx === activeIndex
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <span className={`flex-shrink-0 ${globalIdx === activeIndex ? 'text-cyan-400' : 'text-gray-600'}`}>
                  {cmd.icon}
                </span>
                <span className="font-mono text-[11px]">/{cmd.name}</span>
                <span className="text-gray-600 text-[10px] truncate ml-auto">{cmd.description}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
