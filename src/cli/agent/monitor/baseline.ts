/**
 * Monitor System — Builds and compares security baselines.
 */
import type {
  MonitorBaseline,
  ScanResult,
  Drift,
  ProcessInfo,
  PortInfo,
  ConfigSnapshot,
  UserInfo,
  CronEntry,
} from './types.js';

/**
 * Build a MonitorBaseline from a scan result.
 * Parses the structured BASELINE_START block or raw command outputs.
 */
export function buildBaseline(scan: ScanResult): MonitorBaseline {
  let processes: ProcessInfo[] = [];
  let ports: PortInfo[] = [];
  let configs: ConfigSnapshot[] = [];
  let users: UserInfo[] = [];
  let crons: CronEntry[] = [];

  // Try to parse from the raw baseline JSON first
  const rawBaseline = (scan as unknown as Record<string, string>).rawBaseline;
  if (rawBaseline) {
    try {
      const parsed = JSON.parse(rawBaseline);
      if (Array.isArray(parsed.processes)) processes = parsed.processes;
      if (Array.isArray(parsed.ports)) ports = parsed.ports;
      if (Array.isArray(parsed.configs)) configs = parsed.configs;
      if (Array.isArray(parsed.users)) users = parsed.users;
      if (Array.isArray(parsed.crons)) crons = parsed.crons;
    } catch {
      // Fall back to parsing raw text
    }
  }

  // Fallback: parse processes from ps aux output
  if (processes.length === 0 && scan.processes) {
    processes = parseProcesses(scan.processes);
  }

  // Fallback: parse ports from ss output
  if (ports.length === 0 && scan.ports) {
    ports = parsePorts(scan.ports);
  }

  return {
    processes,
    ports,
    configs,
    packages: [],
    users,
    crons,
    timestamp: scan.timestamp,
  };
}

/**
 * Compare current scan against baseline and detect drift.
 */
export function diffBaseline(current: ScanResult, baseline: MonitorBaseline): Drift[] {
  const drifts: Drift[] = [];

  // Parse current state
  const currentProcesses = parseProcesses(current.processes);
  const currentPorts = parsePorts(current.ports);

  // Check for new processes
  const baselineCommands = new Set(baseline.processes.map(p => p.command));
  for (const proc of currentProcesses) {
    if (!baselineCommands.has(proc.command)) {
      drifts.push({
        category: 'process',
        description: `New process: ${proc.command} (PID: ${proc.pid}, user: ${proc.user})`,
        severity: proc.user === 'root' ? 'high' : 'medium',
        details: `CPU: ${proc.cpu}%, MEM: ${proc.mem}%`,
      });
    }
  }

  // Check for disappeared processes (might indicate killed service)
  const currentCommands = new Set(currentProcesses.map(p => p.command));
  for (const proc of baseline.processes) {
    if (!currentCommands.has(proc.command) && isImportantProcess(proc.command)) {
      drifts.push({
        category: 'process',
        description: `Missing process: ${proc.command} (was running as ${proc.user})`,
        severity: 'high',
        details: 'Expected process is no longer running',
      });
    }
  }

  // Check for new ports
  const baselinePorts = new Set(baseline.ports.map(p => `${p.port}/${p.protocol}`));
  for (const port of currentPorts) {
    if (!baselinePorts.has(`${port.port}/${port.protocol}`)) {
      drifts.push({
        category: 'port',
        description: `New listening port: ${port.port}/${port.protocol} (${port.process})`,
        severity: port.port < 1024 ? 'high' : 'medium',
        details: `Address: ${port.address}`,
      });
    }
  }

  // Check for closed ports
  const currentPortSet = new Set(currentPorts.map(p => `${p.port}/${p.protocol}`));
  for (const port of baseline.ports) {
    if (!currentPortSet.has(`${port.port}/${port.protocol}`)) {
      drifts.push({
        category: 'port',
        description: `Closed port: ${port.port}/${port.protocol} (was ${port.process})`,
        severity: 'medium',
        details: 'Previously open port is no longer listening',
      });
    }
  }

  return drifts;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseProcesses(raw: string): ProcessInfo[] {
  const processes: ProcessInfo[] = [];
  const lines = raw.split('\n').filter(l => l.trim());

  for (const line of lines) {
    // Skip header
    if (line.includes('USER') && line.includes('PID')) continue;
    if (line.startsWith('---')) continue;

    const parts = line.trim().split(/\s+/);
    if (parts.length >= 11) {
      processes.push({
        user: parts[0],
        pid: parseInt(parts[1], 10) || 0,
        cpu: parseFloat(parts[2]) || 0,
        mem: parseFloat(parts[3]) || 0,
        command: parts.slice(10).join(' '),
      });
    }
  }

  return processes;
}

function parsePorts(raw: string): PortInfo[] {
  const ports: PortInfo[] = [];
  const lines = raw.split('\n').filter(l => l.trim());

  for (const line of lines) {
    // Skip header
    if (line.includes('State') && line.includes('Local')) continue;

    // Parse ss -tlnp output: State  Recv-Q  Send-Q  Local Address:Port  ...
    const match = line.match(/([\d.*:]+):(\d+)\s/);
    if (match) {
      const processMatch = line.match(/users:\(\("([^"]+)"/);
      ports.push({
        address: match[1],
        port: parseInt(match[2], 10),
        protocol: line.includes('udp') ? 'udp' : 'tcp',
        process: processMatch?.[1] || 'unknown',
      });
    }
  }

  return ports;
}

function isImportantProcess(command: string): boolean {
  const important = ['sshd', 'nginx', 'apache', 'postgres', 'mysql', 'redis', 'docker', 'systemd'];
  return important.some(name => command.toLowerCase().includes(name));
}
