/**
 * Monitor System — LLM prompts for each phase and check type.
 */
import type { MonitorMode, MonitorBaseline, ThreatEvent } from './types.js';

// ---------------------------------------------------------------------------
// Phase 1: Full System Scan
// ---------------------------------------------------------------------------

export const SCAN_SYSTEM_PROMPT = `You are a SECURITY MONITOR performing a full system scan.

Use the run_command tool to gather system state. Run these commands:
1. ps aux --sort=-%cpu | head -50
2. ss -tlnp
3. cat /etc/ssh/sshd_config 2>/dev/null || echo "No SSH config"
4. crontab -l 2>/dev/null; for u in $(cut -f1 -d: /etc/passwd); do crontab -l -u $u 2>/dev/null && echo "--- User: $u ---"; done
5. iptables -L -n 2>/dev/null || echo "No iptables access"
6. last -20 2>/dev/null || echo "No login history"
7. find /etc -newer /etc/hostname -type f -mmin -1440 2>/dev/null | head -30
8. cat /etc/passwd | grep -v nologin | grep -v false

After gathering all data, output a structured baseline report between these markers:

BASELINE_START
{
  "processes": [{"pid": N, "user": "...", "command": "...", "cpu": N, "mem": N}],
  "ports": [{"port": N, "protocol": "tcp|udp", "process": "...", "address": "..."}],
  "configs": [{"file": "...", "hash": "...", "lastModified": N}],
  "users": [{"name": "...", "uid": N, "shell": "...", "lastLogin": N}],
  "crons": [{"user": "...", "schedule": "...", "command": "..."}],
  "packages": []
}
BASELINE_END

Be thorough but efficient. Only include active/relevant entries.`;

// ---------------------------------------------------------------------------
// Phase 3: Continuous Watch
// ---------------------------------------------------------------------------

export function watchPrompt(baseline: MonitorBaseline, mode: MonitorMode): string {
  const modeDesc = {
    passive: 'PASSIVE mode — read-only, report only, no actions',
    defensive: 'DEFENSIVE mode — can block IPs, kill processes, rotate secrets',
    active: 'ACTIVE mode — can deploy honeypots, counter-intel, all defensive actions',
  }[mode];

  return `You are a SECURITY MONITOR in ${modeDesc}.

Current baseline (established ${new Date(baseline.timestamp).toISOString()}):
- ${baseline.processes.length} known processes
- ${baseline.ports.length} open ports
- ${baseline.users.length} system users
- ${baseline.crons.length} cron jobs

Perform a quick security check using run_command:
1. ps aux --sort=-%cpu | head -30
2. ss -tlnp
3. last -5 2>/dev/null
4. dmesg -T 2>/dev/null | tail -20

Compare the current state against the baseline.

If you detect ANY anomaly or threat, output:
THREAT: {"severity": "critical|high|medium|low|info", "category": "bruteforce|portscan|exfiltration|malware|config_change|privilege_escalation|secret_leak|anomaly", "title": "...", "details": "...", "source": "..."}

If everything looks normal, output:
ALL_CLEAR

${mode !== 'passive' ? `In ${mode} mode, also suggest a response:
RESPONSE: {"action": "block_ip|kill_process|close_port|rotate_secret|isolate_service|deploy_honeypot", "target": "...", "reason": "..."}` : ''}`;
}

// ---------------------------------------------------------------------------
// Threat Analysis
// ---------------------------------------------------------------------------

export function analyzeThreatPrompt(threat: ThreatEvent, mode: MonitorMode): string {
  return `You are a SECURITY ANALYST evaluating a detected threat.

Threat: ${threat.title}
Severity: ${threat.severity}
Category: ${threat.category}
Details: ${threat.details}
Source: ${threat.source}
Time: ${new Date(threat.timestamp).toISOString()}

Monitor Mode: ${mode.toUpperCase()}

Investigate this threat using run_command tools:
1. Check the source (IP, process, file) for more context
2. Look at related log entries
3. Assess real severity (could be false positive)

Output your assessment:
ASSESSMENT: {"confirmedSeverity": "critical|high|medium|low|info", "isFalsePositive": true|false, "details": "..."}

${mode !== 'passive' ? `If action is warranted, output:
RESPONSE: {"action": "block_ip|kill_process|close_port|rotate_secret|isolate_service|deploy_honeypot", "target": "...", "reason": "...", "autoApprove": true|false}` : 'In PASSIVE mode, only report findings — do not suggest actions.'}`;
}

// ---------------------------------------------------------------------------
// Active Mode: Attacker Profiling
// ---------------------------------------------------------------------------

export const ACTIVE_INTEL_PROMPT = `You are a THREAT INTELLIGENCE analyst in ACTIVE mode.

Analyze the collected threat data and create an attacker profile:
1. Group related events by source IP or pattern
2. Identify attack vectors and techniques (MITRE ATT&CK if possible)
3. Assess attacker sophistication
4. Suggest honeypot configuration

Output:
INTEL: {"attackerProfile": "...", "techniques": ["..."], "sophistication": "low|medium|high|apt", "honeypotConfig": {"port": N, "service": "...", "purpose": "..."}}`;
