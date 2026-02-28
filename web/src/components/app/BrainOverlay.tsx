'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';

// Lazy-load the heavy 3D scene
const BrainScene = dynamic(
  () => import('@/components/brain/BrainScene').then(m => ({ default: m.BrainScene })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600 text-sm">Loading Brain...</div>
      </div>
    ),
  },
);

interface BrainOverlayProps {
  onClose: () => void;
}

export function BrainOverlay({ onClose }: BrainOverlayProps) {
  const t = useTranslations('app');

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
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative w-full h-full max-w-[95vw] max-h-[95vh] m-4 rounded-2xl overflow-hidden border border-white/10 bg-[#050510]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-black/50 border border-white/10 text-gray-400 hover:text-white hover:bg-black/70 transition-all"
          title={t('closeBrain')}
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="absolute top-4 left-4 z-10">
          <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <span className="text-lg">🧠</span>
            Spiral Brain
          </h3>
        </div>

        {/* 3D Scene */}
        <BrainScene />
      </div>
    </div>
  );
}
