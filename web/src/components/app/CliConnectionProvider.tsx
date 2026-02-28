'use client';

import { createContext, useContext, useEffect } from 'react';
import { useCliConnection, type UseCliConnectionReturn } from '@/hooks/use-cli-connection';
import { useCliChat, type UseCliChatReturn } from '@/hooks/use-cli-chat';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CliContextValue {
  connection: UseCliConnectionReturn;
  chat: UseCliChatReturn;
}

const CliContext = createContext<CliContextValue | null>(null);

export function useCliContext(): CliContextValue {
  const ctx = useContext(CliContext);
  if (!ctx) {
    throw new Error('useCliContext must be used within <CliConnectionProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CliConnectionProvider({ children }: { children: React.ReactNode }) {
  const connection = useCliConnection({ mode: 'relay' });
  const chat = useCliChat(connection.connectionId);

  // Auto-connect on mount
  useEffect(() => {
    if (connection.connectionState === 'disconnected') {
      connection.connect();
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CliContext.Provider value={{ connection, chat }}>
      {children}
    </CliContext.Provider>
  );
}
