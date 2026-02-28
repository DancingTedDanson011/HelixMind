'use client';

export default function OfflinePage() {
  // Minimal page — no heavy deps, works without network
  // Detect locale from URL for basic i18n
  const isDE =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/de');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050510] text-white px-6">
      <div className="text-center max-w-md">
        <div className="text-7xl mb-6" role="img" aria-label="spiral">
          🌀
        </div>
        <h1 className="text-2xl font-bold mb-3">
          {isDE ? 'Du bist offline' : 'You are offline'}
        </h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          {isDE
            ? 'HelixMind braucht eine Internetverbindung. Bitte prüfe deine Netzwerkverbindung und versuche es erneut.'
            : 'HelixMind needs an internet connection. Please check your network connection and try again.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] font-medium hover:bg-[#00d4ff]/20 transition-colors"
        >
          {isDE ? 'Erneut versuchen' : 'Try Again'}
        </button>
      </div>
    </div>
  );
}
