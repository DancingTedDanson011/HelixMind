'use client';

import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
}

interface TabInfoPageProps {
  icon: ReactNode;
  title: string;
  description: string;
  features: Feature[];
  actions?: ReactNode;
  accentColor: 'cyan' | 'purple' | 'fuchsia' | 'amber';
  /** Link to docs page for this feature */
  docsHref?: string;
  docsLabel?: string;
}

const gradients: Record<string, string> = {
  cyan: 'from-cyan-500/10 to-blue-500/10',
  purple: 'from-purple-500/10 to-red-500/10',
  fuchsia: 'from-fuchsia-500/10 to-purple-500/10',
  amber: 'from-amber-500/10 to-orange-500/10',
};

const iconColors: Record<string, string> = {
  cyan: 'text-cyan-400/60',
  purple: 'text-purple-400/60',
  fuchsia: 'text-fuchsia-400/60',
  amber: 'text-amber-400/60',
};

const featureBorders: Record<string, string> = {
  cyan: 'hover:border-cyan-500/20',
  purple: 'hover:border-purple-500/20',
  fuchsia: 'hover:border-fuchsia-500/20',
  amber: 'hover:border-amber-500/20',
};

const linkColors: Record<string, string> = {
  cyan: 'text-cyan-400/60 hover:text-cyan-400',
  purple: 'text-purple-400/60 hover:text-purple-400',
  fuchsia: 'text-fuchsia-400/60 hover:text-fuchsia-400',
  amber: 'text-amber-400/60 hover:text-amber-400',
};

export function TabInfoPage({ icon, title, description, features, actions, accentColor, docsHref, docsLabel }: TabInfoPageProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className={`mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br ${gradients[accentColor]} border border-white/5 flex items-center justify-center`}>
            <div className={iconColors[accentColor]}>{icon}</div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
            <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Features */}
        <div className="grid gap-3">
          {features.map((f, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 ${featureBorders[accentColor]} transition-colors`}
            >
              <div className={`flex-shrink-0 mt-0.5 ${iconColors[accentColor]}`}>{f.icon}</div>
              <div>
                <p className="text-sm font-medium text-gray-300">{f.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {actions}
          </div>
        )}

        {/* Docs link */}
        {docsHref && (
          <div className="flex justify-center pt-1">
            <a
              href={docsHref}
              className={`flex items-center gap-1.5 text-[11px] ${linkColors[accentColor]} transition-colors`}
            >
              <FileText size={12} />
              {docsLabel || 'Documentation'}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
