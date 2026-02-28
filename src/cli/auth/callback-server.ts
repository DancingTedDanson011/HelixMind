/**
 * Temporary localhost HTTP server for CLI login callback.
 * Receives the API key from the webapp after user authorization.
 */
import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { URL } from 'node:url';

export interface CallbackResult {
  apiKey: string;
  state: string;
  userId?: string;
  email?: string;
  plan?: string;
}

export interface CallbackServer {
  port: number;
  state: string;
  waitForCallback(): Promise<CallbackResult>;
  close(): void;
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HelixMind CLI — Authorized</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #050510;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      text-align: center;
      padding: 3rem;
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 16px;
      background: rgba(0, 212, 255, 0.03);
      max-width: 420px;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { color: #00d4ff; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #888; font-size: 0.95rem; line-height: 1.5; }
    .hint { margin-top: 1.5rem; font-size: 0.8rem; color: #555; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#x2713;</div>
    <h1>CLI Authorized</h1>
    <p>HelixMind CLI has been connected to your account.<br>You can close this tab and return to your terminal.</p>
    <p class="hint">This tab will close automatically in 3 seconds.</p>
  </div>
  <script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`;

const CANCEL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>HelixMind CLI — Cancelled</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #050510; color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; align-items: center; justify-content: center; min-height: 100vh;
    }
    .card { text-align: center; padding: 3rem; border: 1px solid rgba(255,100,100,0.2); border-radius: 16px; max-width: 420px; }
    h1 { color: #ff6464; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #888; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorization Cancelled</h1>
    <p>You can close this tab.</p>
  </div>
  <script>setTimeout(() => window.close(), 2000);</script>
</body>
</html>`;

export function startCallbackServer(timeoutMs = 120_000): Promise<CallbackServer> {
  return new Promise((resolveServer, rejectServer) => {
    const state = randomBytes(32).toString('hex');
    let callbackResolve: ((result: CallbackResult) => void) | null = null;
    let callbackReject: ((err: Error) => void) | null = null;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const server: Server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1`);
      const pathname = url.pathname;

      // CORS headers for localhost
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      if (pathname === '/callback' && req.method === 'GET') {
        const returnedState = url.searchParams.get('state');
        const key = url.searchParams.get('key');

        if (returnedState !== state) {
          res.writeHead(403);
          res.end('<h1>Invalid state — possible CSRF attack</h1>');
          return;
        }

        if (!key) {
          res.writeHead(400);
          res.end('<h1>Missing API key</h1>');
          return;
        }

        res.writeHead(200);
        res.end(SUCCESS_HTML);

        if (!settled && callbackResolve) {
          settled = true;
          if (timer) clearTimeout(timer);
          callbackResolve({
            apiKey: key,
            state: returnedState,
            userId: url.searchParams.get('userId') ?? undefined,
            email: url.searchParams.get('email') ?? undefined,
            plan: url.searchParams.get('plan') ?? undefined,
          });
          // Close server after a short delay to finish sending the response
          setTimeout(() => server.close(), 500);
        }
        return;
      }

      if (pathname === '/cancel' && req.method === 'GET') {
        res.writeHead(200);
        res.end(CANCEL_HTML);

        if (!settled && callbackReject) {
          settled = true;
          if (timer) clearTimeout(timer);
          callbackReject(new Error('Authorization cancelled by user'));
          setTimeout(() => server.close(), 500);
        }
        return;
      }

      // Any other request
      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        rejectServer(new Error('Failed to start callback server'));
        return;
      }

      resolveServer({
        port: addr.port,
        state,
        waitForCallback() {
          return new Promise<CallbackResult>((resolve, reject) => {
            callbackResolve = resolve;
            callbackReject = reject;

            timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                server.close();
                reject(new Error(`Authorization timed out after ${timeoutMs / 1000}s`));
              }
            }, timeoutMs);
          });
        },
        close() {
          if (timer) clearTimeout(timer);
          server.close();
        },
      });
    });

    server.on('error', (err) => {
      rejectServer(err);
    });
  });
}
