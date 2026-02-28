'use client';

import { createContext, useContext } from 'react';
import { ToastContainer, useToastState, type ToastOptions } from '@/components/ui/Toast';

/* ─── Context ─────────────────────────────────── */

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/* ─── Provider ────────────────────────────────── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, toast, dismiss } = useToastState();

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/* ─── Hook ────────────────────────────────────── */

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
