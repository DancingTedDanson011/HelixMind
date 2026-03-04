'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import {
  Brain,
  Layers,
  ShieldCheck,
  Globe,
  Wifi,
  MonitorCog,
  Sparkles,
  Zap,
  GitBranch,
  Search,
  Terminal,
  Eye,
  Bot,
  Shield,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { colors } from '@/lib/constants';

// ── Mode cards (3 modes) ──────────────────────────────────────

const modeKeys = ['agent', 'jarvis', 'monitor'] as const;
const modeIcons = { jarvis: Bot, agent: Terminal, monitor: Shield };
const modeColors = { jarvis: '#ffaa00', agent: '#00d4ff', monitor: '#ff4444' };

// ── Main feature details ──────────────────────────────────────

const featureDetails = [
  {
    key: 'memory',
    icon: Layers,
    color: colors.spiralL1,
    docsLink: '/docs/spiral-memory',
    details: [
      '5+1 level spiral architecture (L1 Focus → L6 Web Knowledge)',
      'Context automatically promotes on use, decays when stale',
      'Embedding-based semantic search (384d MiniLM)',
      'Cross-session persistence with SQLite + sqlite-vec',
    ],
  },
  {
    key: 'brain',
    icon: Brain,
    color: colors.spiralL2,
    docsLink: '/docs/brain-visualization',
    details: [
      'Real-time 3D helix visualization in your browser',
      'Nodes colored by spiral level, sized by relevance',
      'Live edge connections showing knowledge relationships',
      'WebSocket push updates during agent work',
    ],
  },
  {
    key: 'validation',
    icon: ShieldCheck,
    color: colors.spiralL3,
    docsLink: '/docs/validation-matrix',
    details: [
      '3-phase pipeline: Classify → Work → Validate',
      '15+ static checks (HTML, SQL, imports, secrets...)',
      'Dynamic mini-LLM checks with smaller model',
      'Spiral-based checks using learned patterns',
      'Auto-fix loop (up to 3 iterations)',
    ],
  },
  {
    key: 'web',
    icon: Globe,
    color: colors.spiralL6,
    docsLink: '/docs/web-knowledge',
    details: [
      'Auto-detects topics from your conversation',
      'DuckDuckGo search + intelligent HTML extraction',
      'Stores findings as L6 Web Knowledge nodes',
      'Live brain popups when new knowledge arrives',
      'Explicit web_research agent tool',
    ],
  },
  {
    key: 'offline',
    icon: Wifi,
    color: colors.primary,
    docsLink: '/docs/ollama-offline',
    details: [
      'Full Ollama integration with auto-detection',
      'Model listing, pulling, and download progress',
      'Zero data leaves your machine',
      'Same spiral memory works with any provider',
    ],
  },
  {
    key: 'sessions',
    icon: MonitorCog,
    color: colors.accent,
    docsLink: '/docs/sessions',
    details: [
      'Background security audits while you code',
      'Each session gets own history, undo stack, controller',
      'Tab-based terminal UI with Ctrl+PageUp/Down switching',
      'Brain findings panel for agent discoveries',
    ],
  },
];

// ── More features ─────────────────────────────────────────────

const moreFeatureKeys = ['checkpoints', 'tools', 'mcp', 'search', 'cli', 'permissions'] as const;
const moreFeatureIcons = {
  checkpoints: Sparkles,
  tools: Zap,
  mcp: GitBranch,
  search: Search,
  cli: Terminal,
  permissions: Eye,
};

export default function FeaturesPage() {
  const t = useTranslations('features');

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-6xl">
        {/* Hero */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Badge variant="primary" className="mb-4">
            <Sparkles size={12} className="mr-1.5" />
            Features
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">{t('pageTitle')}</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('pageSubtitle')}</p>
        </motion.div>

        {/* Three Modes Section */}
        <motion.div
          className="mb-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">{t('modesTitle')}</h2>
            <p className="text-gray-500 text-sm">{t('modesSubtitle')}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {modeKeys.map((key, i) => {
              const Icon = modeIcons[key];
              const color = modeColors[key];
              const docsLink = t(`modeCards.${key}.link`);

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                >
                  <Link href={docsLink}>
                    <div className="group relative h-full rounded-xl p-5 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300 cursor-pointer">
                      <div
                        className="absolute top-0 left-4 right-4 h-[2px] rounded-full"
                        style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }}
                      />
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="p-2 rounded-lg"
                          style={{ background: `${color}12` }}
                        >
                          <Icon size={18} style={{ color }} />
                        </div>
                        <h3 className="font-semibold text-white text-sm">
                          {t(`modeCards.${key}.title`)}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">
                        {t(`modeCards.${key}.desc`)}
                      </p>
                      <span className="flex items-center gap-1 text-xs font-medium group-hover:gap-2 transition-all duration-200" style={{ color }}>
                        {t('learnMore')} <ArrowRight size={12} />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Main Features */}
        <div className="space-y-6 mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">{t('title')}</h2>
            <p className="text-gray-500 text-sm">{t('subtitle')}</p>
          </div>

          {featureDetails.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
              >
                <GlassPanel className="p-6 sm:p-8">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-shrink-0">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                          background: `rgba(${hexToRgb(feature.color)}, 0.1)`,
                          border: `1px solid rgba(${hexToRgb(feature.color)}, 0.2)`,
                        }}
                      >
                        <Icon size={24} style={{ color: feature.color }} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {t(`${feature.key}.title`)}
                      </h3>
                      <p className="text-gray-400 text-sm mb-4">{t(`${feature.key}.desc`)}</p>
                      <ul className="space-y-2 mb-4">
                        {feature.details.map((detail, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-gray-500">
                            <span
                              className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                              style={{ background: feature.color }}
                            />
                            {detail}
                          </li>
                        ))}
                      </ul>
                      <Link href={feature.docsLink}>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium hover:gap-2.5 transition-all duration-200" style={{ color: feature.color }}>
                          <ExternalLink size={12} />
                          {t('viewDocs')}
                        </span>
                      </Link>
                    </div>
                  </div>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>

        {/* More Features Grid */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">{t('moreTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {moreFeatureKeys.map((key, i) => {
              const Icon = moreFeatureIcons[key];
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                >
                  <GlassPanel intensity="subtle" className="p-5 h-full">
                    <Icon size={20} className="text-primary mb-3" />
                    <h3 className="font-medium text-white text-sm mb-1">{t(`more.${key}.title`)}</h3>
                    <p className="text-xs text-gray-500">{t(`more.${key}.desc`)}</p>
                  </GlassPanel>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/pricing">
            <Button size="lg">{t('viewPricing')}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
