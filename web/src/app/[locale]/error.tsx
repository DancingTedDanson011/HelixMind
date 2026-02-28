'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, AlertTriangle, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[HelixMind] Route error:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-error/5 blur-[120px]" />
      </div>

      <div className="relative z-10 text-center max-w-lg">
        {/* Error icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-8 flex justify-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-error" />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-3xl sm:text-4xl font-bold mb-4 text-white"
        >
          Something went wrong
        </motion.h1>

        {/* Error message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-gray-400 text-lg mb-3">
            An unexpected error occurred while processing your request.
          </p>
          {error.message && (
            <div className="glass rounded-xl px-4 py-3 mb-8 text-left">
              <p className="text-xs text-gray-500 font-mono mb-1">Error details</p>
              <p className="text-sm text-error/80 font-mono break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-gray-600 font-mono mt-2">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary/10 border border-primary/30 text-primary font-medium transition-all duration-200 hover:bg-primary/20 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]"
          >
            <RefreshCcw className="w-4 h-4" />
            Try Again
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-transparent border border-white/10 text-gray-300 font-medium transition-all duration-200 hover:bg-white/5 hover:border-white/20"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
        </motion.div>

        {/* Decorative footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="mt-16"
        >
          <div className="inline-flex items-center gap-2 text-xs text-gray-600 font-mono">
            <span className="w-2 h-2 rounded-full bg-error/30 animate-pulse" />
            spiral.context.error
          </div>
        </motion.div>
      </div>
    </div>
  );
}
