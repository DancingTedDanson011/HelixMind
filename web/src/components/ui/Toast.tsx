'use client';

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastOptions {
  type: ToastType;
  message: string;
  duration?: number;
}

/* ─── Config ──────────────────────────────────── */

const DEFAULT_DURATION = 4000;

const toastConfig: Record<ToastType, {
  icon: typeof CheckCircle;
  borderColor: string;
  bgColor: string;
  textColor: string;
  iconColor: string;
}> = {
  success: {
    icon: CheckCircle,
    borderColor: 'border-success/30',
    bgColor: 'bg-success/5',
    textColor: 'text-success',
    iconColor: 'text-success',
  },
  error: {
    icon: XCircle,
    borderColor: 'border-error/30',
    bgColor: 'bg-error/5',
    textColor: 'text-error',
    iconColor: 'text-error',
  },
  warning: {
    icon: AlertTriangle,
    borderColor: 'border-warning/30',
    bgColor: 'bg-warning/5',
    textColor: 'text-warning',
    iconColor: 'text-warning',
  },
  info: {
    icon: Info,
    borderColor: 'border-info/30',
    bgColor: 'bg-info/5',
    textColor: 'text-info',
    iconColor: 'text-info',
  },
};

/* ─── Single Toast ────────────────────────────── */

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const config = toastConfig[toast.type];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`
        glass-strong rounded-xl border ${config.borderColor}
        px-4 py-3 min-w-[300px] max-w-[420px]
        flex items-start gap-3 shadow-lg
        pointer-events-auto
      `}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${config.iconColor}`} />

      <p className="text-sm text-gray-200 flex-1 leading-relaxed">
        {toast.message}
      </p>

      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

/* ─── Toast Container ─────────────────────────── */

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Hook (standalone) ───────────────────────── */

let idCounter = 0;

export function useToastState() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = `toast-${++idCounter}-${Date.now()}`;
      const duration = options.duration ?? DEFAULT_DURATION;

      const newToast: ToastMessage = { id, ...options };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }

      return id;
    },
    [dismiss],
  );

  return { toasts, toast, dismiss };
}
