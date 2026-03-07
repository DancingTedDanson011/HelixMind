'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Minimize2, Mic, MicOff, Search, Filter, Brain, MessageSquare, Send, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCliContext } from './CliConnectionProvider';
import type { DemoNode, DemoEdge } from '@/components/brain/brain-types';

// Lazy-load the heavy 3D scene
const BrainScene = dynamic(
  () => import('@/components/brain/BrainScene').then(m => ({ default: m.BrainScene })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading Brain...</span>
        </div>
      </div>
    ),
  },
);

// Level definitions for filter
const LEVELS = [
  { level: 1, color: '#E040FB', name: 'Focus' },
  { level: 2, color: '#00FF88', name: 'Active' },
  { level: 3, color: '#7B68EE', name: 'Reference' },
  { level: 4, color: '#00FFFF', name: 'Archive' },
  { level: 5, color: '#FF6B6B', name: 'Deep Archive' },
  { level: 6, color: '#FFD700', name: 'Web Knowledge' },
] as const;

interface BrainOverlayProps {
  onClose: () => void;
  onMinimize?: () => void;
  cliPort?: number | null;
  projectName?: string;
}

export function BrainOverlay({ onClose, onMinimize, projectName }: BrainOverlayProps) {
  const { connection } = useCliContext();
  const isConnected = connection.connectionState === 'connected';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6]));
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [brainNodes, setBrainNodes] = useState<DemoNode[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load brain data
  useEffect(() => {
    if (!isConnected) {
      // Load demo data as fallback
      import('@/components/brain/brain-demo-data').then((m) => {
        setBrainNodes(m.demoNodes);
        setIsLoading(false);
      });
      return;
    }

    setIsLoading(true);
    
    // Request brain sync from CLI
    connection.sendRaw?.(JSON.stringify({ type: 'brain_sync_pull', brainId: 'main' }));

    // Listen for brain sync data
    const handleBrainSync = (msg: Record<string, unknown>) => {
      if (msg.type === 'brain_sync_data' && typeof msg.nodesJson === 'string') {
        try {
          const data = JSON.parse(msg.nodesJson);
          setBrainNodes(data.nodes || []);
          setIsLoading(false);
        } catch {
          // Fallback to demo
          import('@/components/brain/brain-demo-data').then((m) => {
            setBrainNodes(m.demoNodes);
            setIsLoading(false);
          });
        }
      }
    };

    const unsubscribe = connection.onWsMessage?.(handleBrainSync);

    // Timeout fallback
    const timeout = setTimeout(() => {
      if (isLoading) {
        import('@/components/brain/brain-demo-data').then((m) => {
          setBrainNodes(m.demoNodes);
          setIsLoading(false);
        });
      }
    }, 3000);

    return () => {
      unsubscribe?.();
      clearTimeout(timeout);
    };
  }, [isConnected, connection, isLoading]);

  // ESC to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Toggle level filter
  const toggleLevel = useCallback((level: number) => {
    setSelectedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  const toggleVoiceInput = useCallback(() => setIsListening(prev => !prev), []);
  
  const handleChatSend = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatInput('');
  }, [chatInput]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full h-full max-w-[95vw] max-h-[95vh] m-4 rounded-2xl overflow-hidden border border-white/10 bg-[#050510]">
        {/* Top-left buttons */}
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-black/50 border border-white/10 text-gray-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/30 transition-all"
            title="Close"
          >
            <X size={18} />
          </button>
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-black/50 border border-white/10 text-gray-400 hover:text-white hover:bg-black/70 transition-all"
              title="Minimize"
            >
              <Minimize2 size={16} />
            </button>
          )}
        </div>

        {/* Project name */}
        {projectName && (
          <div className="absolute top-4 left-28 z-10">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/50 border border-white/10">
              <Brain size={14} className="text-purple-400" />
              <span className="text-xs font-mono text-gray-300">{projectName}</span>
            </div>
          </div>
        )}

        {/* Chat toggle */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => setShowChat(prev => !prev)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all ${
              showChat
                ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                : 'bg-black/50 border-white/10 text-gray-400 hover:text-white hover:bg-black/70'
            }`}
            title="Chat with Brain"
          >
            <MessageSquare size={16} />
          </button>
        </div>

        {/* Filters panel */}
        <div className="absolute left-4 top-16 bottom-4 w-56 z-10 hidden md:flex flex-col gap-3">
          <div className="rounded-xl bg-black/60 border border-white/10 backdrop-blur-md overflow-hidden">
            <div className="p-3 border-b border-white/5">
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Search Nodes</div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-200 placeholder-gray-600 focus:border-cyan-500/30 focus:outline-none"
                  />
                </div>
                <button
                  onClick={toggleVoiceInput}
                  className={`p-1.5 rounded-lg border transition-all ${
                    isListening
                      ? 'bg-red-500/20 border-red-500/30 text-red-400 animate-pulse'
                      : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md overflow-hidden">
            <div className="p-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                <Filter size={10} />
                Filters
              </div>
            </div>
            <div className="p-2 space-y-1 overflow-y-auto max-h-[calc(100%-40px)]">
              {LEVELS.map(({ level, color, name }) => {
                const isSelected = selectedLevels.has(level);
                const count = brainNodes?.filter(n => n.level === level).length || 0;
                return (
                  <button
                    key={level}
                    onClick={() => toggleLevel(level)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                      isSelected
                        ? 'bg-white/5 border border-white/10'
                        : 'bg-transparent border border-transparent opacity-50 hover:opacity-70'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                    />
                    <span className="text-xs text-gray-300">L{level} {name}</span>
                    <span className="ml-auto text-[9px] text-gray-600">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chat panel */}
        {showChat && (
          <div className="absolute right-4 top-16 bottom-4 w-72 z-10 flex flex-col rounded-xl bg-black/60 border border-white/10 backdrop-blur-md overflow-hidden">
            <div className="p-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-cyan-400" />
                <span className="text-xs font-medium text-gray-300">Chat with Brain</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="text-xs text-gray-500 text-center py-8">
                Access grant, permissions, and direct commands will appear here.
              </div>
            </div>
            <div className="p-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                  placeholder="Ask HelixMind..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-200 placeholder-gray-600 focus:border-cyan-500/30 focus:outline-none"
                />
                <button
                  onClick={handleChatSend}
                  disabled={!chatInput.trim()}
                  className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-all disabled:opacity-30"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3D Scene */}
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading Brain...</span>
            </div>
          </div>
        ) : (
          <BrainScene />
        )}
      </div>
    </div>
  );
}
