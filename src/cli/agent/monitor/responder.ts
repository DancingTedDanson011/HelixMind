/**
 * Monitor System — Executes defense actions (defensive/active mode only).
 */
import { randomUUID } from 'node:crypto';
import type { DefenseAction, DefenseRecord } from './types.js';

type SendFn = (prompt: string) => Promise<string>;

/**
 * Execute a defense action using the agent's run_command tool.
 */
export async function executeDefense(
  action: DefenseAction | string,
  target: string,
  sendMessage: SendFn,
): Promise<DefenseRecord> {
  const defensePrompts: Record<string, string> = {
    block_ip: `Block the IP address ${target} using iptables. Run:
iptables -A INPUT -s ${target} -j DROP
Then verify with: iptables -L -n | grep ${target}`,

    kill_process: `Kill the suspicious process: ${target}. Run:
kill -9 ${target}
Then verify it's gone with: ps aux | grep ${target}`,

    close_port: `Close port ${target} using iptables. Run:
iptables -A INPUT --dport ${target} -j DROP
Then verify with: ss -tlnp | grep ${target}`,

    rotate_secret: `Rotate the compromised secret for: ${target}
Generate a new secure random key and update the relevant config file.`,

    isolate_service: `Isolate the service: ${target}
Stop the service and block its network access:
systemctl stop ${target} 2>/dev/null
iptables -A OUTPUT -m owner --uid-owner $(id -u ${target}) -j DROP 2>/dev/null`,

    deploy_honeypot: `Deploy a honeypot for: ${target}
Start a fake service that logs all connection attempts.
Use: ncat -l -k -p ${target} -c 'echo "SSH-2.0-OpenSSH_8.2p1"; cat >> /tmp/honeypot.log' &`,
  };

  const prompt = defensePrompts[action] || `Execute defense action "${action}" against target "${target}".`;

  await sendMessage(prompt);

  return {
    id: randomUUID().slice(0, 8),
    action: action as DefenseAction,
    target,
    reason: `Auto-response to detected threat`,
    autoApproved: true,
    reversible: action === 'block_ip' || action === 'close_port',
    timestamp: Date.now(),
  };
}

/**
 * Undo a reversible defense action.
 */
export async function undoDefense(
  defense: DefenseRecord,
  sendMessage: SendFn,
): Promise<boolean> {
  if (!defense.reversible) return false;

  const undoPrompts: Record<string, string> = {
    block_ip: `Unblock IP address ${defense.target}. Run:
iptables -D INPUT -s ${defense.target} -j DROP`,

    close_port: `Re-open port ${defense.target}. Run:
iptables -D INPUT --dport ${defense.target} -j DROP`,
  };

  const prompt = undoPrompts[defense.action];
  if (!prompt) return false;

  await sendMessage(prompt);
  return true;
}
