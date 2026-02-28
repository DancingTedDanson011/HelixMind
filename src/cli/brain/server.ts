import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { BrainExport } from './exporter.js';
import { generateBrainHTML } from './template.js';

export type VoiceInputHandler = (text: string) => void;
export type ScopeSwitchHandler = (scope: 'project' | 'global') => void;
export type ModelActivateHandler = (model: string) => void;

export interface BrainServer {
  port: number;
  url: string;
  /** Push incremental update to all connected browsers */
  pushUpdate(data: BrainExport): void;
  /** Push an arbitrary event to all connected browsers */
  pushEvent(event: Record<string, unknown>): void;
  /** Register handler for voice input from browser */
  onVoiceInput(handler: VoiceInputHandler): void;
  /** Register handler for scope switch from browser */
  onScopeSwitch(handler: ScopeSwitchHandler): void;
  /** Register handler for model activation from browser */
  onModelActivate(handler: ModelActivateHandler): void;
  /** Shut down server */
  close(): void;
}

const OLLAMA_BASE = 'http://localhost:11434';

/** Proxy a request to the Ollama API and return the response */
async function ollamaProxy(
  path: string,
  res: ServerResponse,
  method = 'GET',
  body?: string,
): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const opts: RequestInit = { method, signal: controller.signal };
    if (body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = body;
    }
    const upstream = await fetch(`${OLLAMA_BASE}${path}`, opts);
    clearTimeout(timer);
    res.writeHead(upstream.ok ? 200 : upstream.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(await upstream.text());
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ollama not reachable' }));
  }
}

/** Stream an Ollama pull to the browser via SSE */
async function ollamaPullStream(
  modelName: string,
  res: ServerResponse,
): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  let hadError = false;
  try {
    const upstream = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });
    if (!upstream.ok || !upstream.body) {
      res.write(`data: ${JSON.stringify({ error: `Pull failed (HTTP ${upstream.status}). Model "${modelName}" may not exist in Ollama registry.` })}\n\n`);
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        // Check if Ollama returned an error in the stream
        try {
          const parsed = JSON.parse(line);
          if (parsed.error) hadError = true;
        } catch { /* not JSON, relay as-is */ }
        res.write(`data: ${line}\n\n`);
      }
    }
    // Only send success if no error occurred in the stream
    if (!hadError) {
      res.write(`data: ${JSON.stringify({ status: 'success' })}\n\n`);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: `Connection to Ollama failed: ${err instanceof Error ? err.message : String(err)}` })}\n\n`);
  }
  res.end();
}

/** Read body from an incoming request */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
  });
}

/**
 * Start an HTTP + WebSocket server that serves the brain visualization
 * and pushes live updates to all connected browsers.
 */
export function startBrainServer(initialData: BrainExport): Promise<BrainServer> {
  let latestData = initialData;
  let html = generateBrainHTML(initialData);

  const httpServer = createServer(async (req, res) => {
    const url = req.url || '/';

    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else if (url === '/api/data') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(latestData));

    // --- Ollama proxy endpoints ---
    } else if (url === '/api/ollama/status') {
      await ollamaProxy('/api/version', res);
    } else if (url === '/api/ollama/models') {
      await ollamaProxy('/api/tags', res);
    } else if (url === '/api/ollama/running') {
      await ollamaProxy('/api/ps', res);
    } else if (url === '/api/ollama/pull' && req.method === 'POST') {
      const body = await readBody(req);
      try {
        const { name } = JSON.parse(body) as { name: string };
        await ollamaPullStream(name, res);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    } else if (url === '/api/ollama/delete' && req.method === 'POST') {
      const body = await readBody(req);
      await ollamaProxy('/api/delete', res, 'DELETE', body);
    } else if (url === '/api/cloud/models') {
      // Return cloud models from known providers
      const cloudModels = [
        { name: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', size: 'cloud' },
        { name: 'anthropic/claude-opus-4-6', provider: 'anthropic', size: 'cloud' },
        { name: 'openai/gpt-4o', provider: 'openai', size: 'cloud' },
        { name: 'openai/gpt-4o-mini', provider: 'openai', size: 'cloud' },
        { name: 'deepseek/deepseek-chat', provider: 'deepseek', size: 'cloud' },
        { name: 'deepseek/deepseek-reasoner', provider: 'deepseek', size: 'cloud' },
        { name: 'groq/llama-3.3-70b-versatile', provider: 'groq', size: 'cloud' },
        { name: 'together/meta-llama/Llama-3.3-70B-Instruct-Turbo', provider: 'together', size: 'cloud' },
      ];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: cloudModels }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve, reject) => {
    // Find a free port starting from 9420 (try up to 20 ports)
    let port = 9420;
    const maxPort = 9440;

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && port < maxPort) {
        port++;
        httpServer.listen(port, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    httpServer.listen(port, '127.0.0.1', () => {
      // Create WebSocket server AFTER HTTP server is successfully listening
      const wss = new WebSocketServer({ server: httpServer });
      const clients = new Set<WebSocket>();
      let voiceHandler: VoiceInputHandler | null = null;
      let scopeSwitchHandler: ScopeSwitchHandler | null = null;
      let modelActivateHandler: ModelActivateHandler | null = null;

      wss.on('connection', (ws) => {
        clients.add(ws);
        ws.send(JSON.stringify({ type: 'full_sync', data: latestData }));
        ws.on('close', () => clients.delete(ws));

        // Listen for messages from browser (voice input, scope switch)
        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(String(raw));
            if (msg.type === 'voice_input' && typeof msg.text === 'string' && voiceHandler) {
              voiceHandler(msg.text);
            }
            if (msg.type === 'scope_switch' && (msg.scope === 'project' || msg.scope === 'global') && scopeSwitchHandler) {
              scopeSwitchHandler(msg.scope);
            }
            if (msg.type === 'activate_model' && typeof msg.model === 'string' && modelActivateHandler) {
              modelActivateHandler(msg.model);
            }
          } catch { /* ignore malformed */ }
        });
      });

      const addr = httpServer.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;

      resolve({
        port: actualPort,
        url: `http://127.0.0.1:${actualPort}`,
        pushUpdate(data: BrainExport) {
          latestData = data;
          html = generateBrainHTML(data);
          const msg = JSON.stringify({ type: 'full_sync', data });
          for (const ws of clients) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(msg);
            }
          }
        },
        pushEvent(event: Record<string, unknown>) {
          const msg = JSON.stringify(event);
          for (const ws of clients) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(msg);
            }
          }
        },
        onVoiceInput(handler: VoiceInputHandler) {
          voiceHandler = handler;
        },
        onScopeSwitch(handler: ScopeSwitchHandler) {
          scopeSwitchHandler = handler;
        },
        onModelActivate(handler: ModelActivateHandler) {
          modelActivateHandler = handler;
        },
        close() {
          voiceHandler = null;
          scopeSwitchHandler = null;
          modelActivateHandler = null;
          for (const ws of clients) ws.close();
          wss.close();
          httpServer.close();
        },
      });
    });
  });
}
