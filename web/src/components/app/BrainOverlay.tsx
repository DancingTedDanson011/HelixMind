'use client';

import { useEffect, useState } from 'react';
import { X, Brain, Loader2 } from 'lucide-react';
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

interface BrainOverlayProps {
  onClose: () => void;
  projectName?: string;
}

export function BrainOverlay({ onClose, projectName }: BrainOverlayProps) {
  const { connection } = useCliContext();
  const isConnected = connection.connectionState === 'connected';
  
  const [brainNodes, setBrainNodes] = useState<DemoNode[] | null>(null);
  const [brainEdges, setBrainEdges] = useState<DemoEdge[] | null>(null);

  // Load brain data from CLI via WebSocket
  useEffect(() => {
    // Always load demo first for immediate display
    import('@/components/brain/brain-demo-data').then((m) => {
      setBrainNodes(m.demoNodes);
      setBrainEdges(m.demoEdges);
    });

    // If connected, try to get real brain data
    if (!isConnected) return;

    // Request brain sync from CLI
    connection.sendRaw?.(JSON.stringify({ type: 'brain_sync_pull', brainId: 'main' }));

    // Listen for brain sync data
    const handleBrainSync = (msg: Record<string, unknown>) => {
      if (msg.type === 'brain_sync_data' && typeof msg.nodesJson === 'string') {
        try {
          const data = JSON.parse(msg.nodesJson);
          if (data.nodes?.length > 0) {
            // Convert CLI brain format to DemoNode format
            const nodes: DemoNode[] = data.nodes.map((n: any) => ({
              id: n.id,
              label: n.label || n.content?.slice(0, 50) || 'Node',
              type: n.type || 'memory',
              level: n.level || 2,
              relevance: n.relevanceScore || 0.5,
            }));
            const edges: DemoEdge[] = (data.edges || []).map((e: any) => ({
              source: e.source,
              target: e.target,
              type: e.type || 'related',
              weight: e.weight || 1,
            }));
            setBrainNodes(nodes);
            setBrainEdges(edges);
          }
        } catch { /* keep demo */ }
      }
    };

    const unsubscribe = connection.onWsMessage?.(handleBrainSync);
    return () => unsubscribe?.();
  }, [isConnected, connection]);

  // ESC to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Content */}
      <div className="relative w-full h-full max-w-[95vw] max-h-[95vh] m-4 rounded-2xl overflow-hidden border border-white/10 bg-[#050510]">
        {/* Top-left: Only Close button */}
        <div className="absolute top-4 left-4 z-30">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-black/50 border border-white/10 text-gray-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/30 transition-all"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Project name badge */}
        {projectName && (
          <div className="absolute top-4 left-16 z-10">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/50 border border-white/10">
              <Brain size={14} className="text-purple-400" />
              <span className="text-xs font-mono text-gray-300">{projectName}</span>
            </div>
          </div>
        )}

        {/* 3D Scene with real brain data */}
        <BrainScene nodes={brainNodes || undefined} edges={brainEdges || undefined} />
      </div>
    </div>
  );
}
