'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Terminal, Eye, Zap, ArrowRight } from 'lucide-react';

const modes = [
  { key: 'chat', icon: Terminal, color: '#00d4ff' },
  { key: 'monitor', icon: Eye, color: '#ff4444' },
  { key: 'auto', icon: Zap, color: '#ff00ff' },
];

export function EnterpriseModes() {
  const t = useTranslations('enterprise.modes');

  return (
    <section id="modes" className="py-24 sm:py-32 px-4 relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] rounded-full bg-secondary/[0.03] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-5xl relative">
        <div className="text-center mb-16">
          <motion.p
            className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-secondary/60 mb-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {t('label')}
          </motion.p>

          <motion.h2
            className="heading-lg text-3xl sm:text-4xl text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
            {t('title')}
          </motion.h2>

          <motion.p
            className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto font-light"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {t('subtitle')}
          </motion.p>
        </div>

        {/* Mode cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {modes.map((mode, i) => (
            <motion.div
              key={mode.key}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 hover:bg-white/[0.03] transition-all duration-300 hover:scale-[1.02]"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.1 }}
              style={{
                borderLeftColor: mode.color,
                borderLeftWidth: '3px',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${mode.color}15` }}
              >
                <mode.icon size={24} style={{ color: mode.color }} />
              </div>
              <h3 className="font-display font-semibold text-lg text-white mb-2">
                {t(`items.${mode.key}.title`)}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {t(`items.${mode.key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Terminal mockup */}
        <motion.div
          className="mt-12 rounded-xl border border-white/[0.06] bg-black/40 overflow-hidden"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <div className="terminal-titlebar">
            <div className="terminal-dot bg-red-500" />
            <div className="terminal-dot bg-yellow-500" />
            <div className="terminal-dot bg-green-500" />
            <span className="ml-2 text-xs text-gray-500">helixmind</span>
          </div>
          <div className="terminal-body font-mono text-xs sm:text-sm">
            <div className="text-gray-500"># Interactive Chat — Spiral delivers context</div>
            <div className="text-primary">$</div>
            <div className="text-gray-300">helixmind chat -m &quot;fix auth middleware&quot;</div>
            <div className="text-gray-500 mt-2">→ L1: auth/middleware.ts (0.94 relevance)</div>
            <div className="text-gray-500">→ L2: session.ts, tokens.ts (connected)</div>
            <div className="text-gray-500">→ L3: SECURITY_PATTERNS.md (proactive)</div>
            <div className="text-success mt-2">✓ Fixed: Added CSRF validation</div>
            <div className="mt-4 text-gray-500"># Monitor Mode — Watching for threats</div>
            <div className="text-primary">$</div>
            <div className="text-gray-300">/monitor defensive</div>
            <div className="text-warning mt-2">⚠ Hardcoded API key in config.ts:14</div>
            <div className="text-success">✓ Auto-rotated and moved to .env</div>
            <div className="mt-4 text-gray-500"># Auto Mode — 10 parallel workers</div>
            <div className="text-primary">$</div>
            <div className="text-gray-300">/auto refactor legacy auth to OAuth2</div>
            <div className="text-gray-500 mt-2">→ Spawning 10 workers...</div>
            <div className="text-gray-500">→ Worker 1: Analyzing legacy files</div>
            <div className="text-gray-500">→ Worker 2: Generating OAuth config</div>
            <div className="text-spiral-l6">→ L6: Fetching OAuth2 best practices...</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
