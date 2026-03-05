'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useCliConnection, type UseCliConnectionReturn } from '@/hooks/use-cli-connection';
import { useCliChat, type UseCliChatReturn, type ActiveTool } from '@/hooks/use-cli-chat';
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
  /** Port of the currently connected CLI instance */
  connectedPort: number | undefined;
  /** Register a callback for CLI chat completion */
  registerOnComplete: (fn: (text: string, tools: ActiveTool[]) => void) => void;
  /** Whether the current connection is via relay (remote) */
  isRelay: boolean;
  /** Toast message to display (auto-clears) */
  toast: string | null;
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
  const { data: session } = useSession();
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('local');
  const [selectedPort, setSelectedPort] = useState<number | undefined>();
  const [authToken, setAuthToken] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const connectPendingRef = useRef(false);
  const hasAutoConnectedRef = useRef(false);
  const relayFallbackTriedRef = useRef(false);
  const prevConnectionStateRef = useRef<string>('disconnected');

  // Discovery: scans localhost:9420-9440 every 10s
  const discovery = useCliDiscovery();

  // Connection hook with current params
  const connection = useCliConnection({
    mode: connectionMode,
    port: selectedPort,
    token: authToken,
  });

  // onComplete callback registration for CLI chat
  const onCliCompleteRef = useRef<((text: string, tools: ActiveTool[]) => void) | null>(null);
  const registerOnComplete = useCallback((fn: (text: string, tools: ActiveTool[]) => void) => {
    onCliCompleteRef.current = fn;
  }, []);

  // Chat hook with wsVersion for reconnect handling
  const chat = useCliChat(connection.connectionId, connection.wsVersion, (text, tools) => {
    onCliCompleteRef.current?.(text, tools);
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

  // ── Connect after React state has settled ──
  // Must have dependencies to ensure it fires after state updates
  useEffect(() => {
    if (connectPendingRef.current && selectedPort && authToken) {
      connectPendingRef.current = false;
      connection.connect();
    }
  }, [connection, selectedPort, authToken]);

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

  // ── Auto-relay fallback: no local instances + user logged in → try relay ──
  useEffect(() => {
    if (
      !relayFallbackTriedRef.current &&
      session?.user &&
      !discovery.scanning &&
      discovery.instances.length === 0 &&
      connection.connectionState === 'disconnected' &&
      connectionMode === 'local'
    ) {
      relayFallbackTriedRef.current = true;
      setConnectionMode('relay');
      setSelectedPort(undefined);
      setAuthToken(undefined);
      connectPendingRef.current = true;
    }
  }, [session, discovery.scanning, discovery.instances.length, connection.connectionState, connectionMode]);

  // ── Relay connect after mode switch ──
  useEffect(() => {
    if (connectPendingRef.current && connectionMode === 'relay') {
      connectPendingRef.current = false;
      connection.connect();
    }
  }, [connection, connectionMode]);

  // ── Toast on connection state changes ──
  useEffect(() => {
    const prev = prevConnectionStateRef.current;
    const curr = connection.connectionState;
    prevConnectionStateRef.current = curr;

    if (prev !== 'connected' && curr === 'connected') {
      const mode = connectionMode === 'relay' ? 'remote' : 'local';
      const project = connection.instanceMeta?.projectName;
      setToast(project ? `Connected (${mode}) — ${project}` : `Connected (${mode})`);
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [connection.connectionState, connection.instanceMeta, connectionMode]);

  // ── Reset relay fallback when local instances appear ──
  useEffect(() => {
    if (discovery.instances.length > 0 && connectionMode === 'relay' && relayFallbackTriedRef.current) {
      // Local instance appeared — switch back to local
      relayFallbackTriedRef.current = false;
      const inst = discovery.instances[0];
      connection.disconnect();
      setSelectedPort(inst.port);
      setAuthToken(inst.token || undefined);
      setConnectionMode('local');
      connectPendingRef.current = true;
    }
  }, [discovery.instances, connectionMode, connection]);

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
    relayFallbackTriedRef.current = true; // don't auto-fallback again
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
      connectedPort: selectedPort,
      registerOnComplete,
      isRelay: connectionMode === 'relay',
      toast,
    }}>
      {children}
    </CliContext.Provider>
  );
}
