'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DiscoveredInstance, InstanceMeta } from '@/lib/cli-types';

const PORT_MIN = 9420;
const PORT_MAX = 9440;
const SCAN_INTERVAL_MS = 10_000;
const FETCH_TIMEOUT_MS = 500;

interface UseCliDiscoveryReturn {
  instances: DiscoveredInstance[];
  scanning: boolean;
  scan: () => void;
  error: string | null;
}

/**
 * Probes a single port for a running CLI instance.
 * Returns the discovered instance or null if unreachable / invalid.
 */
async function probePort(port: number): Promise<DiscoveredInstance | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const metaRes = await fetch(`http://127.0.0.1:${port}/api/instance`, {
      signal: controller.signal,
    });

    if (!metaRes.ok) return null;

    const meta: InstanceMeta = await metaRes.json();

    // Auto-fetch the full connection token (safe — server only listens on 127.0.0.1)
    let token = '';
    let tokenHint = '';
    try {
      const tokenController = new AbortController();
      const tokenTimer = setTimeout(() => tokenController.abort(), FETCH_TIMEOUT_MS);
      const tokenRes = await fetch(`http://127.0.0.1:${port}/api/token`, {
        signal: tokenController.signal,
      });
      clearTimeout(tokenTimer);

      if (tokenRes.ok) {
        const tokenData: { token: string } = await tokenRes.json();
        token = tokenData.token ?? '';
        tokenHint = token.slice(-4);
      }
    } catch {
      // token fetch is best-effort; fallback to hint endpoint
      try {
        const hintController = new AbortController();
        const hintTimer = setTimeout(() => hintController.abort(), FETCH_TIMEOUT_MS);
        const hintRes = await fetch(`http://127.0.0.1:${port}/api/token-hint`, {
          signal: hintController.signal,
        });
        clearTimeout(hintTimer);
        if (hintRes.ok) {
          const hintData: { hint: string } = await hintRes.json();
          tokenHint = hintData.hint ?? '';
        }
      } catch { /* ignore */ }
    }

    return { port, meta, token, tokenHint };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hook that scans localhost:9420-9440 for running HelixMind CLI instances.
 * Auto-rescans every 10 seconds while the component is mounted.
 */
export function useCliDiscovery(): UseCliDiscoveryReturn {
  const [instances, setInstances] = useState<DiscoveredInstance[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scan = useCallback(async () => {
    if (!mountedRef.current) return;

    setScanning(true);
    setError(null);

    try {
      const ports: number[] = [];
      for (let p = PORT_MIN; p <= PORT_MAX; p++) {
        ports.push(p);
      }

      const results = await Promise.all(ports.map(probePort));
      const found = results.filter((r): r is DiscoveredInstance => r !== null);

      if (mountedRef.current) {
        setInstances(found);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Scan failed');
      }
    } finally {
      if (mountedRef.current) {
        setScanning(false);
      }
    }
  }, []);

  // Initial scan + interval
  useEffect(() => {
    mountedRef.current = true;

    // Fire initial scan
    void scan();

    intervalRef.current = setInterval(() => {
      void scan();
    }, SCAN_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [scan]);

  return { instances, scanning, scan, error };
}
