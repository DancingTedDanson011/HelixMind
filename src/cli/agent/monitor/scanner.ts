/**
 * Monitor System — System scanner that uses the LLM + run_command to read system state.
 */
import type { ScanResult, MonitorCallbacks } from './types.js';
import { SCAN_SYSTEM_PROMPT } from './prompts.js';

/**
 * Perform a full system scan by sending the scan prompt to the agent.
 * The agent will use run_command tools to gather system information.
 */
export async function scanSystem(callbacks: MonitorCallbacks): Promise<ScanResult> {
  callbacks.onScanComplete('scan_start');

  const resultText = await callbacks.sendMessage(SCAN_SYSTEM_PROMPT);

  // Parse structured baseline from the LLM response
  const parsed = parseBaselineFromResponse(resultText);

  const result: ScanResult = {
    processes: parsed.processes || '',
    ports: parsed.ports || '',
    sshConfig: parsed.sshConfig || '',
    firewall: parsed.firewall || '',
    crontabs: parsed.crontabs || '',
    packages: parsed.packages || '',
    recentLogins: parsed.recentLogins || '',
    configChanges: parsed.configChanges || '',
    timestamp: Date.now(),
  };

  callbacks.onScanComplete('scan_complete');
  return result;
}

/**
 * Parse the BASELINE_START...BASELINE_END block from the LLM response.
 */
function parseBaselineFromResponse(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Extract the structured block
  const baselineMatch = text.match(/BASELINE_START\s*([\s\S]*?)\s*BASELINE_END/);
  if (baselineMatch) {
    result.rawBaseline = baselineMatch[1].trim();
  }

  // Also extract raw command outputs for backup
  const sections = [
    { key: 'processes', pattern: /ps aux[\s\S]*?(?=\n(?:ss |cat |crontab|iptables|last |find )|$)/i },
    { key: 'ports', pattern: /ss -tlnp[\s\S]*?(?=\n(?:cat |crontab|iptables|last |find )|$)/i },
    { key: 'sshConfig', pattern: /sshd_config[\s\S]*?(?=\n(?:crontab|iptables|last |find )|$)/i },
    { key: 'firewall', pattern: /iptables[\s\S]*?(?=\n(?:last |find )|$)/i },
    { key: 'crontabs', pattern: /crontab[\s\S]*?(?=\n(?:iptables|last |find )|$)/i },
    { key: 'recentLogins', pattern: /last [\s\S]*?(?=\n(?:find )|$)/i },
    { key: 'configChanges', pattern: /find \/etc[\s\S]*/i },
  ];

  for (const { key, pattern } of sections) {
    const match = text.match(pattern);
    if (match) {
      result[key] = match[0].trim();
    }
  }

  return result;
}

/**
 * Perform a quick check (subset of full scan) for the watch loop.
 */
export async function quickScan(callbacks: MonitorCallbacks): Promise<string> {
  const quickPrompt = `Quick security check. Run these commands and report any anomalies:
1. ps aux --sort=-%cpu | head -15
2. ss -tlnp
3. last -3 2>/dev/null

Compare with what you know from the baseline. Report only NEW or CHANGED items.
If everything matches baseline: ALL_CLEAR
If anomaly detected: THREAT: {"severity": "...", "category": "...", "title": "...", "details": "...", "source": "..."}`;

  return callbacks.sendMessage(quickPrompt);
}

/**
 * Perform a medium check (config drift + packages).
 */
export async function mediumScan(callbacks: MonitorCallbacks): Promise<string> {
  const mediumPrompt = `Medium security check. Run these commands:
1. find /etc -newer /etc/hostname -type f -mmin -5 2>/dev/null | head -20
2. ps aux --sort=-%cpu | head -20
3. ss -tlnp
4. dmesg -T 2>/dev/null | tail -10

Look for config changes, new processes, new ports. Report:
ALL_CLEAR or THREAT: {"severity": "...", "category": "...", "title": "...", "details": "...", "source": "..."}`;

  return callbacks.sendMessage(mediumPrompt);
}
