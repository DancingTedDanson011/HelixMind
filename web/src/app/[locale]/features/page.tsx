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
} from 'lucide-react';
import { colors } from '@/lib/constants';

const featureDetails = [
  {
    key: 'memory',
    icon: Layers,
    color: colors.spiralL1,
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
    details: [
      'Background security audits while you code',
      'Each session gets own history, undo stack, controller',
      'Tab-based terminal UI with Ctrl+PageUp/Down switching',
      'Brain findings panel for agent discoveries',
    ],
  },
];

const moreFeatures = [
  { icon: Sparkles, title: 'Checkpoint System', desc: 'Auto-created at every tool call. Double-ESC to browse and revert.' },
  { icon: Zap, title: '14 Agent Tools', desc: 'read/write/edit files, search, git, run commands, spiral, web research.' },
  { icon: GitBranch, title: 'MCP Server', desc: 'Works with Claude Code, Cursor, VS Code, Windsurf, Codex, JetBrains.' },
  { icon: Search, title: 'Semantic Search', desc: 'Embedding-based KNN search across all spiral levels.' },
  { icon: Terminal, title: 'Rich CLI', desc: 'Figlet banners, syntax highlighting, animated status bar, slash commands.' },
  { icon: Eye, title: 'Permission System', desc: '3-tier: auto/ask/dangerous. YOLO mode for the brave.' },
];

export default function FeaturesPage() {
  const t = useTranslations('features');

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Badge variant="primary" className="mb-4">
            <Sparkles size={12} className="mr-1.5" />
            Features
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">{t('title')}</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('subtitle')}</p>
        </motion.div>

        {/* Main Features */}
        <div className="space-y-8 mb-20">
          {featureDetails.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassPanel className="p-8">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-shrink-0">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center"
                        style={{
                          background: `rgba(${hexToRgb(feature.color)}, 0.1)`,
                          border: `1px solid rgba(${hexToRgb(feature.color)}, 0.2)`,
                        }}
                      >
                        <Icon size={28} style={{ color: feature.color }} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-white mb-2">
                        {t(`${feature.key}.title`)}
                      </h2>
                      <p className="text-gray-400 mb-4">{t(`${feature.key}.desc`)}</p>
                      <ul className="space-y-2">
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
                    </div>
                  </div>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>

        {/* More Features Grid */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">And so much more</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {moreFeatures.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                >
                  <GlassPanel intensity="subtle" className="p-5 h-full">
                    <Icon size={20} className="text-primary mb-3" />
                    <h3 className="font-medium text-white text-sm mb-1">{f.title}</h3>
                    <p className="text-xs text-gray-500">{f.desc}</p>
                  </GlassPanel>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/pricing">
            <Button size="lg">See Pricing</Button>
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
