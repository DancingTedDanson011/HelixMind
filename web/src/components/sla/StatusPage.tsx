'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────

interface EndpointStatus {
  name: string;
  healthy: boolean;
  responseMs: number;
  lastChecked: string;
}

interface StatusData {
  status: 'operational' | 'degraded' | 'major_outage' | 'unknown';
  uptimePercent: number | null;
  avgResponseMs: number | null;
  lastChecked: string | null;
  endpoints: EndpointStatus[];
}

interface DailyData {
  date: string;
  uptimePercent: number;
  avgResponseMs: number;
}

interface ReportData {
  period: string;
  uptimePercent: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  p99ResponseMs: number;
  totalChecks: number;
  failedChecks: number;
  incidentCount: number;
}

interface HistoryData {
  reports: ReportData[];
  daily: DailyData[];
}

interface IncidentData {
  startTime: string;
  endTime: string | null;
  durationMs: number;
  affectedEndpoints: string[];
  errors: string[];
}

// ─── Helpers ─────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  const hours = Math.floor(ms / 3600000);
  const mins = Math.round((ms % 3600000) / 60000);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getUptimeColor(percent: number): string {
  if (percent >= 99.9) return '#00ff88';
  if (percent >= 99) return '#ffaa00';
  return '#ff4444';
}

function getDayColor(percent: number | undefined): string {
  if (percent === undefined) return '#1a1a2e'; // no data
  if (percent >= 99.9) return '#00ff88';
  if (percent >= 99) return '#ffaa00';
  return '#ff4444';
}

// ─── Component ───────────────────────────────────────────

export function StatusPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, historyRes, incidentsRes] = await Promise.all([
        fetch('/api/sla/status'),
        fetch('/api/sla/history'),
        fetch('/api/sla/incidents'),
      ]);

      if (statusRes.ok) setStatus(await statusRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
      if (incidentsRes.ok) {
        const data = await incidentsRes.json();
        setIncidents(data.incidents || []);
      }

      setLastRefresh(new Date());
    } catch {
      // Silently fail, will retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050510' }}>
        <div className="text-gray-400 text-lg">Loading status...</div>
      </div>
    );
  }

  const statusConfig = {
    operational: { label: 'All Systems Operational', color: '#00ff88', bg: 'rgba(0, 255, 136, 0.08)', border: 'rgba(0, 255, 136, 0.2)' },
    degraded: { label: 'Degraded Performance', color: '#ffaa00', bg: 'rgba(255, 170, 0, 0.08)', border: 'rgba(255, 170, 0, 0.2)' },
    major_outage: { label: 'Major Outage', color: '#ff4444', bg: 'rgba(255, 68, 68, 0.08)', border: 'rgba(255, 68, 68, 0.2)' },
    unknown: { label: 'Status Unknown', color: '#6c757d', bg: 'rgba(108, 117, 125, 0.08)', border: 'rgba(108, 117, 125, 0.2)' },
  };

  const currentStatus = status?.status || 'unknown';
  const cfg = statusConfig[currentStatus];

  // Build 90-day grid
  const dailyMap = new Map<string, DailyData>();
  if (history?.daily) {
    for (const d of history.daily) {
      dailyMap.set(d.date, d);
    }
  }

  const days: { date: string; data?: DailyData }[] = [];
  for (let i = 89; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    days.push({ date, data: dailyMap.get(date) });
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4" style={{ background: '#050510' }}>
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">HelixMind Status</h1>
          <p className="text-gray-500 text-sm">
            Last updated: {lastRefresh.toLocaleTimeString()} | Auto-refreshes every 60s
          </p>
        </div>

        {/* Status Banner */}
        <div
          className="rounded-xl p-6 mb-8 text-center"
          style={{
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
          }}
        >
          <div className="flex items-center justify-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: cfg.color,
                boxShadow: `0 0 8px ${cfg.color}`,
              }}
            />
            <span className="text-xl font-semibold" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
          {status?.uptimePercent != null && (
            <p className="text-gray-400 text-sm mt-2">
              {status.uptimePercent.toFixed(2)}% uptime over the last 24 hours
              {status.avgResponseMs != null && ` | Avg response: ${status.avgResponseMs}ms`}
            </p>
          )}
        </div>

        {/* Endpoint Status */}
        <div
          className="rounded-xl p-6 mb-8"
          style={{ background: '#0a0a1a', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">Endpoint Status</h2>
          {status?.endpoints && status.endpoints.length > 0 ? (
            <div className="space-y-3">
              {status.endpoints.map((ep) => (
                <div
                  key={ep.name}
                  className="flex items-center justify-between py-3 px-4 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: ep.healthy ? '#00ff88' : '#ff4444',
                        boxShadow: `0 0 6px ${ep.healthy ? '#00ff88' : '#ff4444'}`,
                      }}
                    />
                    <span className="text-gray-300 font-medium">{ep.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500 text-sm">{ep.responseMs}ms</span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{
                        color: ep.healthy ? '#00ff88' : '#ff4444',
                        background: ep.healthy ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
                      }}
                    >
                      {ep.healthy ? 'Operational' : 'Down'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No endpoint data available yet.</p>
          )}
        </div>

        {/* 90-Day Uptime Chart */}
        <div
          className="rounded-xl p-6 mb-8"
          style={{ background: '#0a0a1a', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">90-Day Uptime</h2>
            {history?.daily && history.daily.length > 0 && (
              <span className="text-sm text-gray-500">
                Avg:{' '}
                <span style={{ color: '#00d4ff' }}>
                  {(history.daily.reduce((s, d) => s + d.uptimePercent, 0) / history.daily.length).toFixed(2)}%
                </span>
              </span>
            )}
          </div>

          <div className="flex gap-[2px] items-end" style={{ minHeight: 32 }}>
            {days.map(({ date, data }) => (
              <div
                key={date}
                className="flex-1 rounded-[2px] cursor-pointer group relative"
                style={{
                  height: 28,
                  backgroundColor: getDayColor(data?.uptimePercent),
                  opacity: data ? (data.uptimePercent >= 99.9 ? 0.7 : 1) : 0.15,
                  minWidth: 2,
                }}
                title={
                  data
                    ? `${date}: ${data.uptimePercent}% uptime, ${data.avgResponseMs}ms avg`
                    : `${date}: No data`
                }
              />
            ))}
          </div>

          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-600">90 days ago</span>
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-[1px]" style={{ backgroundColor: '#00ff88' }} />
                {'100%'}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-[1px]" style={{ backgroundColor: '#ffaa00' }} />
                Degraded
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-[1px]" style={{ backgroundColor: '#ff4444' }} />
                Outage
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-[1px]" style={{ backgroundColor: '#1a1a2e' }} />
                No data
              </span>
            </div>
            <span className="text-xs text-gray-600">Today</span>
          </div>
        </div>

        {/* Monthly Reports */}
        {history?.reports && history.reports.length > 0 && (
          <div
            className="rounded-xl p-6 mb-8"
            style={{ background: '#0a0a1a', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h2 className="text-lg font-semibold text-white mb-4">Monthly Reports</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-left">
                    <th className="pb-3 pr-4 font-medium">Period</th>
                    <th className="pb-3 pr-4 font-medium">Uptime</th>
                    <th className="pb-3 pr-4 font-medium">Avg Response</th>
                    <th className="pb-3 pr-4 font-medium">P95</th>
                    <th className="pb-3 pr-4 font-medium">P99</th>
                    <th className="pb-3 font-medium">Incidents</th>
                  </tr>
                </thead>
                <tbody>
                  {history.reports.map((report) => (
                    <tr key={report.period} className="border-t border-white/5">
                      <td className="py-3 pr-4 text-gray-300">{report.period}</td>
                      <td className="py-3 pr-4">
                        <span style={{ color: getUptimeColor(report.uptimePercent) }}>
                          {report.uptimePercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-400">{report.avgResponseMs}ms</td>
                      <td className="py-3 pr-4 text-gray-400">{report.p95ResponseMs}ms</td>
                      <td className="py-3 pr-4 text-gray-400">{report.p99ResponseMs}ms</td>
                      <td className="py-3">
                        {report.incidentCount === 0 ? (
                          <span className="text-gray-600">None</span>
                        ) : (
                          <span style={{ color: '#ff4444' }}>{report.incidentCount}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Incident History */}
        <div
          className="rounded-xl p-6"
          style={{ background: '#0a0a1a', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">Incident History</h2>
          {incidents.length === 0 ? (
            <div className="text-center py-8">
              <div
                className="w-3 h-3 rounded-full mx-auto mb-3"
                style={{ backgroundColor: '#00ff88', boxShadow: '0 0 8px #00ff88' }}
              />
              <p className="text-gray-400">No incidents in the last 90 days</p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((incident, i) => (
                <div
                  key={i}
                  className="py-4 px-4 rounded-lg"
                  style={{ background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.1)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-gray-300 font-medium text-sm">
                        {formatDate(incident.startTime)}
                      </span>
                      {!incident.endTime && (
                        <span
                          className="ml-2 text-xs font-medium px-2 py-0.5 rounded"
                          style={{ color: '#ff4444', background: 'rgba(255,68,68,0.15)' }}
                        >
                          Ongoing
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 text-sm">
                      Duration: {formatDuration(incident.durationMs)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-2">
                    {incident.affectedEndpoints.map((ep) => (
                      <span
                        key={ep}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ color: '#ffaa00', background: 'rgba(255,170,0,0.1)' }}
                      >
                        {ep}
                      </span>
                    ))}
                  </div>

                  {incident.errors.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {incident.errors.slice(0, 3).map((err, j) => (
                        <div key={j} className="truncate">{err}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-10 text-gray-600 text-xs">
          Powered by HelixMind SLA Monitoring
        </div>
      </div>
    </div>
  );
}
