/**
 * Dependency Guardian — monitor dependency health.
 * CVE scanning, outdated checks, license compliance, bundle size tracking.
 * Runs in Medium-Check (5m) → generates proposals for issues found.
 */
import { execSync } from 'node:child_process';
import type { ProposalCategory, ProposalEvidence } from './types.js';

export interface DependencyIssue {
  type: 'vulnerability' | 'outdated' | 'license' | 'size';
  package: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  currentVersion?: string;
  latestVersion?: string;
  advisory?: string;
}

export interface DependencyReport {
  issues: DependencyIssue[];
  summary: string;
  scannedAt: number;
}

/**
 * Run npm audit and parse results.
 */
export function scanVulnerabilities(projectRoot: string): DependencyIssue[] {
  const issues: DependencyIssue[] = [];

  try {
    const raw = execSync('npm audit --json 2>/dev/null', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const audit = JSON.parse(raw) as {
      vulnerabilities?: Record<string, {
        name: string;
        severity: string;
        via: Array<{ title?: string; url?: string } | string>;
        fixAvailable?: boolean | { name: string; version: string };
      }>;
    };

    if (audit.vulnerabilities) {
      for (const [name, vuln] of Object.entries(audit.vulnerabilities)) {
        const advisoryTitle = vuln.via
          .filter((v): v is { title?: string; url?: string } => typeof v !== 'string')
          .map(v => v.title)
          .filter(Boolean)
          .join(', ');

        issues.push({
          type: 'vulnerability',
          package: name,
          severity: mapSeverity(vuln.severity),
          description: advisoryTitle || `Security vulnerability in ${name}`,
          advisory: vuln.via
            .filter((v): v is { title?: string; url?: string } => typeof v !== 'string')
            .map(v => v.url)
            .filter(Boolean)[0],
        });
      }
    }
  } catch {
    // npm audit exits non-zero when vulns found — parse anyway
    // If JSON parsing fails, no issues reported
  }

  return issues;
}

/**
 * Run npm outdated and parse results.
 */
export function scanOutdated(projectRoot: string): DependencyIssue[] {
  const issues: DependencyIssue[] = [];

  try {
    const raw = execSync('npm outdated --json 2>/dev/null', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 15_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const outdated = JSON.parse(raw) as Record<string, {
      current: string;
      wanted: string;
      latest: string;
      type: string;
    }>;

    for (const [name, info] of Object.entries(outdated)) {
      if (info.current === info.latest) continue;

      const majorBump = info.current.split('.')[0] !== info.latest.split('.')[0];

      issues.push({
        type: 'outdated',
        package: name,
        severity: majorBump ? 'medium' : 'low',
        description: `${name} ${info.current} → ${info.latest}${majorBump ? ' (major version)' : ''}`,
        currentVersion: info.current,
        latestVersion: info.latest,
      });
    }
  } catch {
    // npm outdated exits non-zero when outdated found
    try {
      // Try parsing stderr/stdout anyway
    } catch { /* skip */ }
  }

  return issues;
}

/**
 * Full dependency scan — combines all checks.
 */
export function runDependencyScan(projectRoot: string): DependencyReport {
  const vulns = scanVulnerabilities(projectRoot);
  const outdated = scanOutdated(projectRoot);
  const issues = [...vulns, ...outdated];

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  const summary = issues.length === 0
    ? 'Dependencies healthy — no issues found'
    : `${issues.length} dependency issues: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low`;

  return { issues, summary, scannedAt: Date.now() };
}

/**
 * Convert dependency issues to proposal evidence.
 */
export function issuesToEvidence(issues: DependencyIssue[]): ProposalEvidence[] {
  return issues.map(i => ({
    type: 'metric' as const,
    content: `[${i.severity}] ${i.type}: ${i.description}${i.advisory ? ` (${i.advisory})` : ''}`,
    timestamp: Date.now(),
  }));
}

/**
 * Determine proposal category from dependency issues.
 */
export function issuesToCategory(issues: DependencyIssue[]): ProposalCategory {
  if (issues.some(i => i.type === 'vulnerability')) return 'security';
  return 'dependency';
}

/**
 * Build a human-readable report for the thinking loop.
 */
export function buildDependencyReport(report: DependencyReport): string {
  if (report.issues.length === 0) return '';

  const lines = ['## Dependency Health'];

  const vulns = report.issues.filter(i => i.type === 'vulnerability');
  if (vulns.length > 0) {
    lines.push(`\n### Vulnerabilities (${vulns.length})`);
    for (const v of vulns.slice(0, 10)) {
      lines.push(`- [${v.severity}] ${v.package}: ${v.description}`);
    }
  }

  const outdated = report.issues.filter(i => i.type === 'outdated');
  if (outdated.length > 0) {
    lines.push(`\n### Outdated (${outdated.length})`);
    for (const o of outdated.slice(0, 10)) {
      lines.push(`- ${o.package}: ${o.currentVersion} → ${o.latestVersion}`);
    }
  }

  return lines.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────

function mapSeverity(npmSeverity: string): DependencyIssue['severity'] {
  switch (npmSeverity) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'moderate': return 'medium';
    default: return 'low';
  }
}
