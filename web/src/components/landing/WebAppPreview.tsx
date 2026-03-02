'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { MessageSquare, Brain, Sparkles, Shield } from 'lucide-react';

const sidebarItems = [
  { icon: MessageSquare, label: 'Chat', active: true },
  { icon: Brain, label: 'Brain', active: false },
  { icon: Sparkles, label: 'Jarvis', active: false },
  { icon: Shield, label: 'Monitor', active: false },
];

const terminalLines = [
  { color: '#00d4ff', text: 'You: Fix the auth middleware bug' },
  { color: '#8a2be2', text: '\uD83D\uDD0D spiral_query "auth patterns"' },
  { color: '#ffaa00', text: '\u270F\uFE0F edit_file auth/middleware.ts' },
  { color: '#00ff88', text: '\u2705 Fixed: Token validation added' },
];

export function WebAppPreview() {
  const t = useTranslations('webApp');

  return (
    <section className="py-24 sm:py-32 px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-primary/[0.04] blur-[140px]" />
      </div>

      <div className="mx-auto max-w-5xl relative">
        {/* Header */}
        <div className="text-center mb-14">
          <motion.p
            className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-primary/60 mb-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {t('sectionLabel')}
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

        {/* Browser Chrome Mockup */}
        <motion.div
          className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/40"
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
            {/* Traffic lights */}
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            {/* URL bar */}
            <div className="flex-1 mx-4">
              <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 text-xs text-gray-500 font-mono">
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.28 5.78l-4 4a.75.75 0 01-1.06 0l-2-2a.75.75 0 111.06-1.06L6.75 8.19l3.47-3.47a.75.75 0 111.06 1.06z"/></svg>
                <span>{t('urlBar')}</span>
              </div>
            </div>
          </div>

          {/* Dashboard content */}
          <div className="grid grid-cols-[56px_1fr_140px] sm:grid-cols-[64px_1fr_180px] min-h-[280px] sm:min-h-[320px]">
            {/* Sidebar */}
            <div className="border-r border-white/[0.06] bg-white/[0.01] py-4 flex flex-col items-center gap-3">
              {sidebarItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    className={`p-2.5 rounded-xl transition-colors ${
                      item.active
                        ? 'bg-primary/[0.12] text-primary'
                        : 'text-gray-600 hover:text-gray-400'
                    }`}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                  >
                    <Icon size={18} />
                  </motion.div>
                );
              })}
            </div>

            {/* Main content */}
            <div className="p-4 sm:p-6 space-y-3">
              {terminalLines.map((line, i) => (
                <motion.div
                  key={i}
                  className="font-mono text-[11px] sm:text-xs"
                  style={{ color: line.color }}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.12 }}
                >
                  {line.text}
                </motion.div>
              ))}
              {/* Blinking cursor */}
              <motion.div
                className="font-mono text-xs text-primary"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1.0 }}
              >
                <span className="font-bold text-primary">{'\u276F'} </span>
                <span className="animate-pulse">{'\u2588'}</span>
              </motion.div>
            </div>

            {/* Right panel — Brain glow */}
            <div className="border-l border-white/[0.06] bg-white/[0.01] flex items-center justify-center relative overflow-hidden">
              <motion.div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(0,212,255,0.2) 0%, rgba(138,43,226,0.1) 50%, transparent 70%)',
                }}
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.span
                className="absolute text-[10px] font-mono text-gray-600 bottom-4"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8 }}
              >
                Brain
              </motion.span>
            </div>
          </div>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          className="flex justify-center gap-3 mt-8 flex-wrap"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {['pill1', 'pill2', 'pill3'].map((key) => (
            <span
              key={key}
              className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-xs text-gray-400 font-medium"
            >
              {t(key)}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
