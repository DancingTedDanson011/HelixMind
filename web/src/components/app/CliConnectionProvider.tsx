'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useCliConnection, type UseCliConnectionReturn } from '@/hooks/use-cli-connection';
import { useCliChat, type UseCliChatReturn } from '@/hooks/use-cli-chat';
import { useCliDiscovery } from '@/hooks/use-cli-discovery';
import type { ConnectionMode, DiscoveredInstance } from '@/lib/cli-types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CliContextValue {
  connection: UseCliConnectionReturn;
  chat: UseCliChatReturn;
  /** Discovered local CLI instances */
  instances: DiscoveredInstance[];
  /** Whether discovery is currently scanning */
  scanning: boolean;
  /** Manually trigger a rescan */
  rescan: () => void;
  /** Connect to a specific instance */
  connectTo: (instance: DiscoveredInstance) => void;
  /** Disconnect from current instance */
  disconnectCli: () => void;
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
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('local');
  const [selectedPort, setSelectedPort] = useState<number | undefined>();
  const [authToken, setAuthToken] = useState<string | undefined>();
  const connectPendingRef = useRef(false);
  const hasAutoConnectedRef = useRef(false);

  // Discovery: scans localhost:9420-9440 every 10s
  const discovery = useCliDiscovery();

  // Connection hook with current params
  const connection = useCliConnection({
    mode: connectionMode,
    port: selectedPort,
    token: authToken,
  });

  // Chat hook with wsVersion for reconnect handling
  const chat = useCliChat(connection.connectionId, connection.wsVersion);

  // ── Connect after React state has settled ──
  useEffect(() => {
    if (connectPendingRef.current) {
      connectPendingRef.current = false;
      connection.connect();
    }
  });

  // ── Auto-connect to first discovered local instance ──
  useEffect(() => {
    if (
      !hasAutoConnectedRef.current &&
      discovery.instances.length > 0 &&
      connection.connectionState === 'disconnected'
    ) {
      hasAutoConnectedRef.current = true;
      const inst = discovery.instances[0];
      setSelectedPort(inst.port);
      setAuthToken(inst.token || undefined);
      setConnectionMode('local');
      connectPendingRef.current = true;
    }
  }, [discovery.instances, connection.connectionState]);

  // ── Re-auto-connect when instance appears after disconnection ──
  // (e.g. user restarts CLI)
  useEffect(() => {
    if (
      hasAutoConnectedRef.current &&
      connection.connectionState === 'disconnected' &&
      discovery.instances.length > 0
    ) {
      // Check if the previously connected instance is still available
      const inst = selectedPort
        ? discovery.instances.find(i => i.port === selectedPort) ?? discovery.instances[0]
        : discovery.instances[0];

      // Brief delay to avoid rapid reconnect loops
      const timer = setTimeout(() => {
        if (connection.connectionState === 'disconnected') {
          setSelectedPort(inst.port);
          setAuthToken(inst.token || undefined);
          setConnectionMode('local');
          connectPendingRef.current = true;
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [discovery.instances, connection.connectionState, selectedPort]);

  // ── Manual connect to a specific instance ──
  const connectTo = useCallback((instance: DiscoveredInstance) => {
    hasAutoConnectedRef.current = true;
    connection.disconnect();
    setSelectedPort(instance.port);
    setAuthToken(instance.token || undefined);
    setConnectionMode('local');
    connectPendingRef.current = true;
  }, [connection]);

  // ── Manual disconnect ──
  const disconnectCli = useCallback(() => {
    hasAutoConnectedRef.current = true; // prevent auto-reconnect loop
    connection.disconnect();
  }, [connection]);

  return (
    <CliContext.Provider value={{
      connection,
      chat,
      instances: discovery.instances,
      scanning: discovery.scanning,
      rescan: discovery.scan,
      connectTo,
      disconnectCli,
    }}>
      {children}
    </CliContext.Provider>
  );
}
