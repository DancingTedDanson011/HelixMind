/**
 * Custom Next.js server with integrated WebSocket relay.
 *
 * Two sub-paths:
 *   /api/relay/cli — CLI instances connect here (API-Key auth)
 *   /api/relay/web — Browsers connect here (cookie auth via NextAuth)
 *
 * Messages are bridged between paired CLI/Browser connections
 * based on matching userId.
 */
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { validateApiKey, validateSessionCookie } from './src/lib/relay-auth';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ---------------------------------------------------------------------------
// Relay state
// ---------------------------------------------------------------------------

interface CliConnection {
  ws: WebSocket;
  userId: string;
  instanceId: string;
  meta?: Record<string, unknown>;
}

interface WebConnection {
  ws: WebSocket;
  userId: string;
  targetInstanceId?: string;
}

// userId → Map<instanceId, CliConnection>
const cliSockets = new Map<string, Map<string, CliConnection>>();
// WebSocket → WebConnection metadata
const webSockets = new Map<WebSocket, WebConnection>();

// Rate limiting: message count per ws per second
const messageCounters = new Map<WebSocket, { count: number; resetAt: number }>();
const MAX_MESSAGES_PER_SECOND = 100;

function checkRateLimit(ws: WebSocket): boolean {
  const now = Date.now();
  let counter = messageCounters.get(ws);
  if (!counter || now > counter.resetAt) {
    counter = { count: 0, resetAt: now + 1000 };
    messageCounters.set(ws, counter);
  }
  counter.count++;
  return counter.count <= MAX_MESSAGES_PER_SECOND;
}

// ---------------------------------------------------------------------------
// Message forwarding
// ---------------------------------------------------------------------------

/** Forward a message from browser to the target CLI instance */
function forwardToCliInstance(
  userId: string,
  instanceId: string | undefined,
  message: string,
): boolean {
  const instances = cliSockets.get(userId);
  if (!instances || instances.size === 0) return false;

  if (instanceId) {
    const conn = instances.get(instanceId);
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(message);
      return true;
    }
    return false;
  }

  // No specific instance — send to first available
  for (const conn of instances.values()) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(message);
      return true;
    }
  }
  return false;
}

/** Forward a message from CLI to all connected browsers for that user */
function forwardToBrowsers(userId: string, message: string): void {
  for (const [ws, conn] of webSockets) {
    if (conn.userId === userId && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    handle(req, res, parsedUrl);
  });

  // CLI relay WebSocket server
  const wssCliRelay = new WebSocketServer({ noServer: true });
  // Browser relay WebSocket server
  const wssWebRelay = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade for WebSocket
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '/', true);

    if (pathname === '/api/relay/cli') {
      wssCliRelay.handleUpgrade(req, socket, head, (ws) => {
        wssCliRelay.emit('connection', ws, req);
      });
    } else if (pathname === '/api/relay/web') {
      wssWebRelay.handleUpgrade(req, socket, head, (ws) => {
        wssWebRelay.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  // --- CLI connections ---
  wssCliRelay.on('connection', (ws, req) => {
    let authenticated = false;
    let userId = '';
    let instanceId = '';

    // 10 second auth timeout
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.send(JSON.stringify({ type: 'cli_auth_fail', reason: 'Auth timeout', timestamp: Date.now() }));
        ws.close(4001, 'Auth timeout');
      }
    }, 10000);

    ws.on('message', async (raw) => {
      if (!checkRateLimit(ws)) return;

      try {
        const msg = JSON.parse(String(raw));

        // Auth handshake
        if (!authenticated && msg.type === 'cli_auth') {
          clearTimeout(authTimeout);
          const result = await validateApiKey(msg.apiKey);
          if (!result) {
            ws.send(JSON.stringify({ type: 'cli_auth_fail', reason: 'Invalid API key', timestamp: Date.now() }));
            ws.close(4001, 'Invalid API key');
            return;
          }

          userId = result.userId;
          instanceId = msg.instanceId || `cli_${Date.now()}`;
          authenticated = true;

          // Register CLI connection
          if (!cliSockets.has(userId)) {
            cliSockets.set(userId, new Map());
          }
          cliSockets.get(userId)!.set(instanceId, { ws, userId, instanceId });

          ws.send(JSON.stringify({
            type: 'cli_auth_ok',
            userId,
            instanceId,
            timestamp: Date.now(),
          }));

          // Notify connected browsers about new CLI instance
          forwardToBrowsers(userId, JSON.stringify({
            type: 'cli_connected',
            instanceId,
            timestamp: Date.now(),
          }));
          return;
        }

        if (!authenticated) return;

        // Store instance meta if provided
        if (msg.type === 'instance_meta' && msg.instance) {
          const instances = cliSockets.get(userId);
          const conn = instances?.get(instanceId);
          if (conn) conn.meta = msg.instance;
        }

        // Forward all messages from CLI to connected browsers
        forwardToBrowsers(userId, String(raw));
      } catch { /* ignore malformed */ }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      messageCounters.delete(ws);

      if (authenticated) {
        const instances = cliSockets.get(userId);
        if (instances) {
          instances.delete(instanceId);
          if (instances.size === 0) cliSockets.delete(userId);
        }

        // Notify browsers
        forwardToBrowsers(userId, JSON.stringify({
          type: 'cli_disconnected',
          instanceId,
          timestamp: Date.now(),
        }));
      }
    });
  });

  // --- Browser connections ---
  wssWebRelay.on('connection', async (ws, req) => {
    // Authenticate via session cookie
    const result = await validateSessionCookie(req.headers.cookie);
    if (!result) {
      ws.send(JSON.stringify({ type: 'auth_fail', reason: 'Invalid session', timestamp: Date.now() }));
      ws.close(4001, 'Invalid session');
      return;
    }

    const userId = result.userId;
    const conn: WebConnection = { ws, userId };
    webSockets.set(ws, conn);

    // Send auth confirmation
    ws.send(JSON.stringify({ type: 'auth_ok', userId, timestamp: Date.now() }));

    // Send list of currently connected CLI instances
    const instances = cliSockets.get(userId);
    if (instances) {
      const instanceList = [...instances.values()].map(c => ({
        instanceId: c.instanceId,
        meta: c.meta || null,
      }));
      ws.send(JSON.stringify({
        type: 'cli_instances',
        instances: instanceList,
        timestamp: Date.now(),
      }));
    }

    ws.on('message', (raw) => {
      if (!checkRateLimit(ws)) return;

      try {
        const msg = JSON.parse(String(raw));

        // Track target instance
        if (msg.type === 'set_target' && msg.instanceId) {
          conn.targetInstanceId = msg.instanceId;
          return;
        }

        // Forward to CLI instance
        forwardToCliInstance(userId, conn.targetInstanceId, String(raw));
      } catch { /* ignore malformed */ }
    });

    ws.on('close', () => {
      webSockets.delete(ws);
      messageCounters.delete(ws);
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket relay: ws://${hostname}:${port}/api/relay/{cli,web}`);
  });
});
