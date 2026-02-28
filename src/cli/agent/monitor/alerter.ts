/**
 * Monitor System — Alert routing to Brain/Relay/Web.
 */
import { randomUUID } from 'node:crypto';
import type { ThreatEvent, DefenseRecord, ThreatSeverity, DefenseAction, ApprovalRequest } from './types.js';
import {
  pushControlEvent as pushRawControlEvent,
  pushAgentFinding,
} from '../../brain/generator.js';

// ---------------------------------------------------------------------------
// Pending approval requests
// ---------------------------------------------------------------------------

const pendingApprovals = new Map<string, ApprovalRequest>();

export function getPendingApprovals(): ApprovalRequest[] {
  return Array.from(pendingApprovals.values());
}

export function resolveApproval(requestId: string, approved: boolean): ApprovalRequest | undefined {
  const req = pendingApprovals.get(requestId);
  if (req) {
    pendingApprovals.delete(requestId);
  }
  return req;
}

// ---------------------------------------------------------------------------
// Push functions
// ---------------------------------------------------------------------------

/**
 * Push a threat event to all channels:
 * 1. Brain visualization (as agent_finding)
 * 2. Control protocol (for Web Dashboard)
 */
export function pushThreatEvent(threat: ThreatEvent): void {
  // Brain visualization — shows as finding popup
  pushAgentFinding(
    'Monitor',
    `[${threat.severity.toUpperCase()}] ${threat.title}: ${threat.details}`,
    threat.severity,
    threat.source,
  );

  // Control protocol — for Web Dashboard real-time updates
  pushRawControlEvent({
    type: 'threat_detected',
    threat,
    timestamp: Date.now(),
  });
}

/**
 * Push a defense activation event.
 */
export function pushDefenseEvent(defense: DefenseRecord): void {
  pushAgentFinding(
    'Monitor',
    `Defense: ${defense.action} → ${defense.target} (${defense.reason})`,
    'info',
    defense.target,
  );

  pushRawControlEvent({
    type: 'defense_activated',
    defense,
    timestamp: Date.now(),
  });
}

/**
 * Push a monitor status update.
 */
export function pushMonitorStatus(status: {
  mode: string;
  uptime: number;
  threatCount: number;
  defenseCount: number;
  lastScan: number;
}): void {
  pushRawControlEvent({
    type: 'monitor_status',
    ...status,
    timestamp: Date.now(),
  });
}

/**
 * Request approval from the Web Dashboard for a defense action.
 * Stores the request and pushes it to the web client.
 */
export function requestApproval(
  action: DefenseAction | string,
  reason: string,
  severity: ThreatSeverity,
): void {
  const request: ApprovalRequest = {
    id: randomUUID().slice(0, 8),
    action: action as DefenseAction,
    target: reason,
    reason,
    severity,
    timestamp: Date.now(),
    expiresAt: Date.now() + 300_000, // 5 min expiry
  };

  pendingApprovals.set(request.id, request);

  pushRawControlEvent({
    type: 'approval_request',
    request,
    timestamp: Date.now(),
  });
}
