'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <div className="relative z-10 text-center max-w-lg">
        {/* 404 number */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-6"
        >
          <span className="text-[8rem] sm:text-[10rem] font-bold leading-none gradient-text select-none">
            404
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-3xl sm:text-4xl font-bold mb-4"
        >
          <span className="gradient-text-glow">Lost in the spiral?</span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="text-gray-400 text-lg mb-10 leading-relaxed"
        >
          The page you are looking for does not exist or has been moved
          to another dimension.
        </motion.p>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary/10 border border-primary/30 text-primary font-medium transition-all duration-200 hover:bg-primary/20 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-transparent border border-white/10 text-gray-300 font-medium transition-all duration-200 hover:bg-white/5 hover:border-white/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </motion.div>

        {/* Decorative spiral hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-16"
        >
          <div className="inline-flex items-center gap-2 text-xs text-gray-600 font-mono">
            <span className="w-2 h-2 rounded-full bg-primary/30 animate-pulse" />
            spiral.context.not_found
          </div>
        </motion.div>
      </div>
    </div>
  );
}
