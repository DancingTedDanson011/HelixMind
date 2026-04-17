> **⚠️ ARCHIVED — 2026-03-04 SNAPSHOT.** Many integration issues described
> here were resolved in 0.5.x–0.7.0. For the current state, see `CHANGELOG.md`
> and `git log`. Do not treat this file as a description of the current codebase.

# HelixMind CLI-Web Integration Layer -- Production Readiness Audit

**Audit Date:** 2026-03-04
**Scope:** CLI-Web WebSocket integration (local + relay modes)
**Auditor:** Claude Opus 4.6 (automated static analysis)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Inventory](#2-file-inventory)
3. [Critical Findings (P0)](#3-critical-findings-p0)
4. [High-Severity Findings (P1)](#4-high-severity-findings-p1)
5. [Medium-Severity Findings (P2)](#5-medium-severity-findings-p2)
6. [Low-Severity / Hardening (P3)](#6-low-severity--hardening-p3)
7. [Positive Observations](#7-positive-observations)
8. [Summary Matrix](#8-summary-matrix)

---

## 1. Architecture Overview

The integration layer connects CLI agent instances to a web dashboard via two modes:

**Local Mode:** Browser connects directly to CLI's HTTP+WS server on `127.0.0.1:9420-9440`. Authentication is via a per-session UUID token. The browser discovers instances by probing ports, fetches the token via HTTP, then opens a WebSocket with the token.

**Relay Mode:** CLI connects outbound to the web server (`wss://.../api/relay/cli`) using an API key (hm_xxx). Browser connects to `wss://.../api/relay/web` using session cookies. The relay bridges messages between matched userId pairs.

**Protocol:** JSON-over-WebSocket with `{ type, requestId?, timestamp }` envelope. ~60 control request types, ~40 event types.

---

## 2. File Inventory

| File | Purpose | Lines |
|------|---------|-------|
| `src/cli/brain/server.ts` | Local HTTP+WS server, token auth, brain visualization, Ollama proxy | ~868 |
| `src/cli/brain/control-protocol.ts` | Protocol types, message type registry, serializers | ~485 |
| `src/cli/brain/relay-client.ts` | Outbound WS client to relay, auto-reconnect | ~525 |
| `src/cli/brain/generator.ts` | Brain coordinator, event forwarding, singleton management | ~626 |
| `web/server.ts` | Custom Next.js server with WS relay, rate limiting | ~327 |
| `web/src/lib/relay-auth.ts` | API key hash validation, session cookie decode | ~87 |
| `web/src/lib/cli-types.ts` | Shared type definitions (web-only types) | ~182 |
| `web/src/lib/cli-ws-registry.ts` | WebSocket instance registry for hook coordination | ~25 |
| `web/src/hooks/use-cli-discovery.ts` | Port scanning for local instances | ~138 |
| `web/src/hooks/use-cli-connection.ts` | WebSocket connection management | ~1179 |
| `web/src/hooks/use-cli-output.ts` | Output streaming with ring buffer | ~166 |
| `web/src/components/cli/CliManager.tsx` | Main CLI dashboard component | ~282 |
| `web/src/components/cli/TokenDialog.tsx` | Token input dialog | ~187 |

---

## 3. Critical Findings (P0)

### P0-1: Unauthenticated Command Execution via `start_ollama`

**File:** `src/cli/brain/server.ts:757-763`

```typescript
if (msg.type === 'start_ollama') {
  try {
    const child = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore', shell: true });
    child.unref();
    sendTo(ws, { type: 'ollama_starting', timestamp: Date.now() });
  } catch { /* ignore spawn errors */ }
}
```

**Issue:** The `start_ollama` message is processed in the legacy message block (lines 747-763), which runs for ANY connected client -- including unauthenticated "brain clients" that connected without a token. Any WebSocket connection to ports 9420-9440 on localhost can trigger a `spawn()` call.

While the command itself is hardcoded (`ollama serve`), the `shell: true` flag means the shell interprets the command. Additionally, the pattern of executing processes from unauthenticated messages is architecturally dangerous. If any future legacy message adds user-controllable arguments to a spawn call, it becomes RCE.

**Impact:** Process execution from unauthenticated WebSocket connections. Currently limited to `ollama serve` but sets a dangerous precedent.

**Fix:**
```typescript
// Move start_ollama inside the authenticated block
if (authenticated && msg.type === 'start_ollama') {
  try {
    const child = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
    // Remove shell: true -- not needed for simple binary execution
    child.unref();
    sendTo(ws, { type: 'ollama_starting', timestamp: Date.now() });
  } catch { /* ignore spawn errors */ }
}
```

---

### P0-2: Token Exposure via Unauthenticated HTTP Endpoint

**File:** `src/cli/brain/server.ts:196-199`

```typescript
} else if (url === '/api/token') {
  // Full token -- safe because server only listens on 127.0.0.1
  res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify({ token: connectionToken }));
```

**Issue:** The `/api/token` endpoint returns the full authentication token with `Access-Control-Allow-Origin: *` CORS headers. The justification ("safe because server only listens on 127.0.0.1") is incomplete.

**Attack scenario:** Any website the user visits can make a fetch request to `http://127.0.0.1:9420/api/token` from JavaScript (the wildcard CORS policy permits cross-origin reads). Once the token is obtained, the attacker can open a WebSocket to `ws://127.0.0.1:9420`, authenticate, and issue control commands -- including `send_chat` (inject AI prompts), `start_auto` (run arbitrary agent tasks), `revert_to_checkpoint` (destroy work), `register_project` (path traversal), and all Jarvis/Swarm commands.

This is a classic DNS rebinding / localhost CORS attack vector. The `Access-Control-Allow-Origin: *` header makes it trivially exploitable by any malicious or compromised website.

**Impact:** CRITICAL. Full remote takeover of the CLI agent from any web page the user visits.

**Fix:**
```typescript
// Option A: Remove the /api/token endpoint entirely, require token from CLI terminal output
// Option B: Restrict CORS to only the known web dashboard origin
} else if (url === '/api/token') {
  const origin = req.headers.origin || '';
  const allowedOrigins = ['http://127.0.0.1', 'http://localhost'];
  const isAllowed = allowedOrigins.some(o => origin.startsWith(o));

  if (!isAllowed) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
  });
  res.end(JSON.stringify({ token: connectionToken }));
```

Additionally, ALL CORS headers throughout the file should be restricted. The wildcard `Access-Control-Allow-Origin: *` on lines 79, 97, 166, 193, 203 should be replaced with validated origin checks.

---

### P0-3: Voice Input Injection from Unauthenticated Clients

**File:** `src/cli/brain/server.ts:748-749`

```typescript
if (msg.type === 'voice_input' && typeof msg.text === 'string' && voiceHandler) {
  voiceHandler(msg.text);
}
```

**Issue:** The `voice_input` handler runs for ALL connected WebSocket clients, including unauthenticated brain clients. The voice handler injects text directly into the CLI agent's chat loop.

Combined with P0-2 (token-free WebSocket access after the 5-second timeout), any process on localhost -- or any web page exploiting the CORS vulnerability -- can inject arbitrary prompts into the AI agent. This is prompt injection via the WebSocket channel.

**Impact:** Full prompt injection into the AI agent from unauthenticated connections.

**Fix:**
```typescript
// Move voice, scope, and model handlers inside the authenticated check
if (authenticated) {
  if (msg.type === 'voice_input' && typeof msg.text === 'string' && voiceHandler) {
    voiceHandler(msg.text);
  }
  if (msg.type === 'scope_switch' && ...) { ... }
  if (msg.type === 'activate_model' && ...) { ... }
}
```

---

## 4. High-Severity Findings (P1)

### P1-1: No Message Size Limits on WebSocket or HTTP Body

**File:** `src/cli/brain/server.ts:140-146`

```typescript
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
  });
}
```

**Issue:** The `readBody` function accumulates the entire HTTP request body in memory with no size limit. A malicious client can send a multi-gigabyte POST body to `/api/ollama/pull` or `/api/ollama/delete` and exhaust the process's memory.

Similarly, the WebSocket `message` handler on line 706 has no size check on incoming messages. The `ws` library will buffer the entire message before delivering it.

**Impact:** Denial of service via memory exhaustion.

**Fix:**
```typescript
const MAX_BODY_SIZE = 1024 * 64; // 64 KB

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Body too large'));
        return;
      }
      data += chunk.toString();
    });
    req.on('end', () => resolve(data));
  });
}
```

For WebSocket, configure `maxPayload` on the WebSocketServer:
```typescript
const wss = new WebSocketServer({ server: httpServer, maxPayload: 1024 * 256 }); // 256 KB
```

---

### P1-2: No Rate Limiting on Local Brain Server

**File:** `src/cli/brain/server.ts:706`

**Issue:** The local WebSocket server has no rate limiting. Any client can flood it with messages. The relay server in `web/server.ts:49-61` has rate limiting (100 msg/sec), but the CLI-side server does not.

**Impact:** A malicious local process or exploiting web page can flood the server with control messages, causing excessive CPU and memory usage, and potentially overwhelming the agent loop.

**Fix:** Add rate limiting similar to the relay server:
```typescript
const clientMessageCounters = new Map<WebSocket, { count: number; resetAt: number }>();
const LOCAL_MAX_MESSAGES_PER_SECOND = 50;

// Inside ws.on('message'):
const now = Date.now();
let counter = clientMessageCounters.get(ws);
if (!counter || now > counter.resetAt) {
  counter = { count: 0, resetAt: now + 1000 };
  clientMessageCounters.set(ws, counter);
}
counter.count++;
if (counter.count > LOCAL_MAX_MESSAGES_PER_SECOND) return;
```

---

### P1-3: Auth Timeout Auto-Promotes to Brain Client

**File:** `src/cli/brain/server.ts:690-695`

```typescript
authTimeout = setTimeout(() => {
  if (!authenticated) {
    brainClients.add(ws);
    ws.send(JSON.stringify({ type: 'full_sync', data: latestData }));
  }
}, AUTH_TIMEOUT_MS);
```

**Issue:** If a WebSocket connects and sends no auth message within 5 seconds, it is silently promoted to a brain client. Brain clients receive all brain events (including `full_sync` with full spiral data) and can send legacy messages (`voice_input`, `start_ollama`, `scope_switch`, `activate_model`) without authentication.

This means any process on localhost that opens a WebSocket and waits 5 seconds gets read access to all brain data and write access to legacy commands.

**Impact:** Information disclosure of brain/spiral data and unauthorized command execution.

**Fix:** Either require authentication for all clients, or create a truly read-only mode for unauthenticated clients that only receives visualization data and accepts no inbound messages:
```typescript
authTimeout = setTimeout(() => {
  if (!authenticated) {
    brainClients.add(ws);
    ws.send(JSON.stringify({ type: 'full_sync', data: latestData }));
    // Mark as read-only -- block all inbound messages
    ws.readOnlyMode = true;
  }
}, AUTH_TIMEOUT_MS);

// In message handler:
if (ws.readOnlyMode) return; // Drop all messages from unauthenticated clients
```

---

### P1-4: API Key Sent as JSON Payload Instead of Header

**File:** `src/cli/brain/relay-client.ts:57-63`

```typescript
ws.on('open', () => {
  backoff = INITIAL_BACKOFF_MS;
  ws!.send(JSON.stringify({
    type: 'cli_auth',
    apiKey,
    timestamp: Date.now(),
  }));
});
```

**Issue:** The API key is transmitted as a JSON message payload over the WebSocket connection. While the relay client refuses non-TLS remote connections (line 26-28, good), the API key still traverses any TLS-terminating proxy or load balancer as plaintext in the WebSocket frame. The key is also serializable and could appear in debug logs.

Better practice would be to send the API key as a header during the HTTP upgrade handshake, where it benefits from standard HTTP security tooling (header scrubbing in logs, etc.).

**Impact:** API key exposure risk in intermediary logs.

**Fix:** Send as a header during the WebSocket upgrade:
```typescript
ws = new WebSocket(url, {
  headers: { 'Authorization': `Bearer ${apiKey}` },
});
```

Then on the server side, validate during the `upgrade` event before accepting the connection.

---

### P1-5: Relay Forwards Raw CLI Messages Without Validation

**File:** `web/server.ts:201-202`

```typescript
// Forward all messages from CLI to connected browsers
forwardToBrowsers(userId, String(raw));
```

**Issue:** The relay server forwards raw, unvalidated messages from CLI to all connected browsers. There is no schema validation, no message type whitelist, and no payload sanitization. A compromised or malicious CLI instance could send crafted messages that exploit browser-side parsing bugs, or inject unexpected message types that trigger unintended behavior in the web dashboard.

**Impact:** A compromised CLI could attack all browser clients of the same user. Potential for stored-XSS if any browser component renders message content without sanitization.

**Fix:** Add message type validation:
```typescript
const ALLOWED_CLI_MESSAGE_TYPES = new Set([
  'sessions_list', 'session_updated', 'session_created', 'session_removed',
  'output_line', 'instance_meta', 'findings_list', 'bug_created', 'bug_updated',
  // ... whitelist all valid CLI -> Browser message types
]);

// Before forwarding:
const msg = JSON.parse(String(raw));
if (!ALLOWED_CLI_MESSAGE_TYPES.has(msg.type)) return;
forwardToBrowsers(userId, String(raw));
```

---

### P1-6: Session Cookie Salt is Empty String

**File:** `web/src/lib/relay-auth.ts:70`

```typescript
const token = await decode({ token: sessionToken, secret, salt: '' });
```

**Issue:** The JWT decode call uses an empty string as the salt parameter. While next-auth typically handles salt internally, passing an empty string explicitly may weaken the JWT derivation or cause it to accept tokens that should be rejected by a different salt configuration.

**Impact:** Potential authentication bypass if next-auth's internal salt behavior differs from what is expected with an explicit empty string.

**Fix:** Use the default salt by not passing the parameter, or use the correct salt value:
```typescript
const token = await decode({ token: sessionToken, secret });
// Or use the proper cookie-based salt:
const token = await decode({
  token: sessionToken,
  secret,
  salt: sessionToken.startsWith('__Secure-')
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'
});
```

---

## 5. Medium-Severity Findings (P2)

### P2-1: Excessive Use of `(msg as any)` Bypasses Type Safety

**Files:** `src/cli/brain/server.ts:359-670`, `src/cli/brain/relay-client.ts:171-478`

**Issue:** Over 70 instances of `(msg as any).fieldName` pattern throughout the control message handlers. Example:

```typescript
case 'delete_bug': {
  const success = await controlHandlers.deleteBug((msg as any).bugId);
  sendTo(ws, { type: 'bug_deleted', success, bugId: (msg as any).bugId, ... });
  break;
}
```

This completely bypasses TypeScript's type checking. If a client sends a message without the expected field, it will be `undefined`, which can cause runtime errors in handler functions or produce unexpected behavior (e.g., deleting with `undefined` as an ID).

**Impact:** Runtime errors, potential logic bugs, and missing field validation.

**Fix:** Use proper type narrowing or create a validated accessor:
```typescript
case 'delete_bug': {
  const deleteMsg = msg as DeleteBugRequest;
  if (typeof deleteMsg.bugId !== 'number') {
    sendTo(ws, { type: 'error', message: 'Missing bugId', requestId, timestamp: Date.now() });
    break;
  }
  const success = await controlHandlers.deleteBug(deleteMsg.bugId);
  sendTo(ws, { type: 'bug_deleted', success, bugId: deleteMsg.bugId, requestId, timestamp: Date.now() });
  break;
}
```

---

### P2-2: Duplicate Control Message Handler Logic

**Files:** `src/cli/brain/server.ts:287-682` and `src/cli/brain/relay-client.ts:115-479`

**Issue:** The entire control message dispatch is duplicated between the local server and the relay client. Both files contain nearly identical switch statements with ~40+ cases each. This violates DRY and creates a maintenance burden where adding a new message type requires changes in both locations that must be kept in sync.

**Impact:** Divergence risk (already observed: the local server handles `plan_mode` and some brain management messages in `CONTROL_REQUEST_TYPES` but neither handler has cases for `get_active_plan`, `approve_plan`, `reject_plan`, `set_plan_mode` -- they fall through silently).

**Fix:** Extract the handler dispatch into a shared function:
```typescript
// shared-handler.ts
export async function dispatchControlMessage(
  msg: ControlRequest,
  handlers: ControlHandlers,
  send: (response: Record<string, unknown>) => void,
): Promise<void> {
  const requestId = msg.requestId;
  switch (msg.type) {
    // ... single implementation
  }
}
```

---

### P2-3: Missing Cases in Switch Statements (Silent Message Drops)

**Files:** `src/cli/brain/server.ts:295-681`, `src/cli/brain/relay-client.ts:118-479`

**Issue:** The `CONTROL_REQUEST_TYPES` set (control-protocol.ts:250-269) includes types like `get_active_plan`, `approve_plan`, `reject_plan`, `set_plan_mode` but neither the local server nor the relay client has handler cases for these. Messages of these types will match `isControlRequest()`, enter the handler, but fall through the switch without any response. The client will time out waiting for a response that never comes.

**Impact:** Silent failures for plan mode operations. Clients experience 10-second timeouts for valid request types.

**Fix:** Add handler cases for all registered request types, or add a `default` case:
```typescript
default:
  sendTo(ws, {
    type: 'error',
    message: `Unknown request type: ${msg.type}`,
    requestId,
    timestamp: Date.now()
  });
  break;
```

---

### P2-4: Memory Leak in Client State Arrays (use-cli-connection.ts)

**File:** `web/src/hooks/use-cli-connection.ts:421-435`

```typescript
if (msg.type === 'threat_detected') {
  const threat = msg.threat as ThreatEvent;
  if (mountedRef.current) {
    setThreats((prev) => [...prev, threat]);
  }
  return;
}

if (msg.type === 'defense_activated') {
  const defense = msg.defense as DefenseRecord;
  if (mountedRef.current) {
    setDefenses((prev) => [...prev, defense]);
  }
  return;
}
```

**Issue:** Several state arrays (`threats`, `defenses`, `approvals`, `workers`) grow unboundedly. They only append, never trim. In a long-running session, these arrays can grow indefinitely, consuming memory and causing React re-renders to slow down.

The `thinkingUpdates` and `consciousnessEvents` arrays do have caps (`.slice(-99)`), showing awareness of this pattern, but it was not applied consistently.

**Impact:** Memory leak and UI performance degradation in long-running dashboard sessions.

**Fix:** Apply the same ring buffer pattern used for thinking updates:
```typescript
setThreats((prev) => [...prev.slice(-499), threat]);
setDefenses((prev) => [...prev.slice(-499), defense]);
```

---

### P2-5: Output Subscription Leak Across Relay Mode

**File:** `src/cli/brain/relay-client.ts:147-149`

```typescript
case 'subscribe_output':
case 'unsubscribe_output':
  // Output subscriptions are handled locally by the brain server, not relayed
  break;
```

**Issue:** Output subscriptions are silently dropped in relay mode. A browser connected via relay that tries to subscribe to session output will never receive `output_line` events. The subscription messages are consumed but not forwarded to the brain server, and no error is returned.

**Impact:** Relay-mode users cannot view real-time session output. The UI appears connected but the terminal viewer remains empty.

**Fix:** Either forward output subscriptions to the brain server, or implement output forwarding in the relay:
```typescript
case 'subscribe_output': {
  // Track relay subscriptions and forward output events
  const sessionId = msg.sessionId;
  relayOutputSubscriptions.add(sessionId);
  break;
}
```

---

### P2-6: No Protocol Version Negotiation

**Issue:** There is no protocol version field in any message, and no version negotiation during the handshake. If the CLI and web dashboard are running different versions with incompatible message formats, there is no way to detect or handle the mismatch.

**Impact:** Silent compatibility failures when CLI and web are at different versions. Fields may be missing, renamed, or have different types.

**Fix:** Add protocol version to the auth handshake:
```typescript
// CLI sends:
{ type: 'auth', token: '...', protocolVersion: 2, timestamp: ... }

// Server responds:
{ type: 'auth_ok', protocolVersion: 2, timestamp: ... }
// or
{ type: 'auth_fail', reason: 'Protocol version 1 not supported. Please update.', timestamp: ... }
```

---

### P2-7: Config API Key Partially Exposed Over Relay

**File:** `src/cli/brain/relay-client.ts:393-396`

```typescript
case 'get_config': {
  const cfg = handlers.getConfig();
  sendRelay({ type: 'config_response', provider: cfg.provider, apiKey: cfg.apiKey ? cfg.apiKey.slice(0, 4) + '****' : '', model: cfg.model, requestId, timestamp: Date.now() });
  break;
}
```

**Issue:** The first 4 characters of the API key are sent over the relay WebSocket. While this is masked (4 chars + `****`), those 4 characters leak to the relay server and any network intermediary. For keys with predictable prefixes (like `sk-ant-`, `sk-`, `gsk_`), this reveals the provider and partial key material.

**Impact:** Partial API key exposure over the network.

**Fix:** For relay mode, do not send any portion of the API key:
```typescript
case 'get_config': {
  const cfg = handlers.getConfig();
  // Never send key material over relay
  sendRelay({
    type: 'config_response',
    provider: cfg.provider,
    apiKey: cfg.apiKey ? '********' : '',
    model: cfg.model,
    requestId,
    timestamp: Date.now()
  });
  break;
}
```

---

### P2-8: Ollama Proxy SSRF Vector

**File:** `src/cli/brain/server.ts:60-85`

**Issue:** The Ollama proxy endpoints (`/api/ollama/status`, `/api/ollama/models`, `/api/ollama/running`, `/api/ollama/pull`, `/api/ollama/delete`) make requests to a hardcoded `http://localhost:11434`. While the base URL is not user-controllable, the `name` parameter passed to the pull endpoint is not validated and is sent directly to Ollama.

More importantly, these proxy endpoints have no authentication -- any HTTP request to the brain server port can trigger requests to the Ollama API, including destructive operations like model deletion.

**Impact:** Unauthenticated access to Ollama management API (model pull/delete) from any process on localhost or any web page exploiting the CORS vulnerability.

**Fix:** Add authentication requirement for Ollama management endpoints, or at minimum for destructive operations:
```typescript
// Add auth check for management endpoints
} else if (url === '/api/ollama/delete' && req.method === 'POST') {
  // Require auth token in header for destructive operations
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${connectionToken}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }
  const body = await readBody(req);
  await ollamaProxy('/api/delete', res, 'DELETE', body);
```

---

## 6. Low-Severity / Hardening (P3)

### P3-1: Token Stored in sessionStorage

**File:** `web/src/components/cli/CliManager.tsx:126`

```typescript
sessionStorage.setItem(`hx-token-${pendingInstance.port}`, token);
```

**Issue:** The connection token can be stored in `sessionStorage` when "remember" is checked. While `sessionStorage` is isolated per tab and clears when the tab closes, it is accessible to any JavaScript running on the same origin (including XSS payloads).

**Impact:** Low. Token exposure if the web dashboard has an XSS vulnerability.

**Fix:** Consider using a shorter-lived, HttpOnly cookie set via an API route instead, or accept the risk given the local-only nature of the token.

---

### P3-2: No Maximum Connection Limit

**File:** `src/cli/brain/server.ts:684` (WebSocketServer)

**Issue:** The WebSocket server accepts unlimited connections. A local process could open thousands of connections, each consuming memory for the WebSocket state and eventually exhausting file descriptors.

**Fix:**
```typescript
const MAX_CONNECTIONS = 20;
wss.on('connection', (ws) => {
  if (brainClients.size + controlClients.size >= MAX_CONNECTIONS) {
    ws.close(4003, 'Too many connections');
    return;
  }
  // ... rest of handler
});
```

---

### P3-3: Auth Timeout Not Cleared on Close

**File:** `src/cli/brain/server.ts:686-703`

```typescript
let authTimeout: ReturnType<typeof setTimeout> | null = null;
authTimeout = setTimeout(() => { ... }, AUTH_TIMEOUT_MS);

ws.on('close', () => {
  brainClients.delete(ws);
  controlClients.delete(ws);
  // authTimeout is NOT cleared here
});
```

**Issue:** If a client connects and disconnects within the 5-second auth window, the timeout callback will still fire and try to add the (now closed) WebSocket to `brainClients`. While this is mostly harmless (the closed socket will be cleaned up elsewhere), it is a resource leak.

**Fix:**
```typescript
ws.on('close', () => {
  if (authTimeout) { clearTimeout(authTimeout); authTimeout = null; }
  brainClients.delete(ws);
  controlClients.delete(ws);
  for (const subs of outputSubscriptions.values()) {
    subs.delete(ws);
  }
});
```

---

### P3-4: Relay Client Does Not Unsubscribe from Brain Server on Close

**File:** `src/cli/brain/relay-client.ts:512-519`

```typescript
return {
  close() {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pingTimer) clearInterval(pingTimer);
    ws?.close();
    // Missing: brainServer.off('event', forwardEvent);
    // Missing: brainServer.off('control', forwardEvent);
  },
};
```

**Issue:** When the relay client closes, it does not unsubscribe the `forwardEvent` handlers from the brain server. The brain server will continue to call the forwarding functions, which will silently fail (since the WS is closed). This is a minor memory/reference leak.

**Fix:**
```typescript
close() {
  closed = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pingTimer) clearInterval(pingTimer);
  if (brainServer) {
    brainServer.off('event', forwardEvent);
    brainServer.off('control', forwardEvent);
  }
  ws?.close();
},
```

---

### P3-5: Reconnect Attempt Counter Never Resets in Web Client

**File:** `web/src/hooks/use-cli-connection.ts:265-280`

```typescript
const scheduleReconnect = useCallback(() => {
  // ...
  const delay = Math.min(
    1000 * Math.pow(2, reconnectAttemptRef.current),
    RECONNECT_MAX_MS,
  );
  reconnectAttemptRef.current += 1;
  // ...
}, []);
```

**Issue:** The reconnect attempt counter increments indefinitely. While the delay is capped at `RECONNECT_MAX_MS` (15 seconds), the counter itself grows unboundedly. After `Math.log2(15000) ~= 14` attempts, it stabilizes at 15s, but the counter keeps incrementing. This is cosmetic but could overflow if left running for extremely long periods.

**Fix:** Cap the counter:
```typescript
if (reconnectAttemptRef.current < 20) {
  reconnectAttemptRef.current += 1;
}
```

---

### P3-6: Missing Error Handling in sendChat (CLI-side)

**File:** `src/cli/brain/server.ts:341`

```typescript
case 'send_chat': {
  controlHandlers.sendChat(msg.text, msg.chatId, msg.mode, msg.files as any);
  sendTo(ws, { type: 'chat_received', requestId, timestamp: Date.now() });
  break;
}
```

**Issue:** `sendChat` is called but if it throws, the error is caught by the outer try/catch which silently ignores it (`catch { /* ignore malformed */ }`). The client receives no error response and the request appears to succeed.

**Fix:** Wrap in try/catch with error response:
```typescript
case 'send_chat': {
  try {
    controlHandlers.sendChat(msg.text, msg.chatId, msg.mode, msg.files as any);
    sendTo(ws, { type: 'chat_received', requestId, timestamp: Date.now() });
  } catch (err) {
    sendTo(ws, { type: 'error', message: 'Chat failed', requestId, timestamp: Date.now() });
  }
  break;
}
```

---

### P3-7: Discovery Hook Fetches Token from Every Port in Parallel

**File:** `web/src/hooks/use-cli-discovery.ts:27-67`

**Issue:** The discovery hook probes ports 9420-9440 (21 ports) in parallel every 10 seconds, and for each successful probe, also fetches `/api/token`. This creates 42 HTTP requests every 10 seconds to localhost. While not harmful, it is noisy and could trigger security monitoring alerts.

**Fix:** Consider a two-phase approach: probe first, then only fetch tokens for newly discovered instances. Also consider using a longer scan interval (30s) with an immediate rescan button.

---

### P3-8: Relay Client Does Not Validate `cli_auth_ok` Response

**File:** `src/cli/brain/relay-client.ts:70-88`

```typescript
if (msg.type === 'cli_auth_ok') {
  authenticated = true;
  // Immediately trusts the response
```

**Issue:** The relay client does not validate that the `cli_auth_ok` response contains expected fields (`userId`, `instanceId`). A malicious relay could send a fake `cli_auth_ok` to make the client believe it is authenticated.

**Impact:** Low, since the relay URL must be explicitly configured by the user.

---

## 7. Positive Observations

The following security practices are already well-implemented:

1. **Local-only binding:** The brain server binds to `127.0.0.1` only (line 262), preventing direct remote access.

2. **Token generation:** Uses `crypto.randomUUID()` which provides cryptographically secure tokens.

3. **API key hashing:** The relay auth (`relay-auth.ts:18`) stores SHA256 hashes of API keys, not plaintext. Keys are validated against hashes.

4. **TLS enforcement for relay:** The relay client (`relay-client.ts:26-28`) refuses non-TLS connections to remote servers.

5. **Auth timeout on relay server:** The relay server (`server.ts:143-148`) has a 10-second auth timeout that disconnects unauthenticated clients.

6. **Rate limiting on relay:** The relay server (`server.ts:49-61`) implements per-connection rate limiting at 100 msg/sec.

7. **API key scope validation:** The relay auth (`relay-auth.ts:32`) checks that API keys have the `relay` or `read` scope.

8. **API key expiry and revocation:** The relay auth checks `expiresAt` and `revokedAt` fields.

9. **Graceful shutdown:** The relay server (`server.ts:291-326`) has proper shutdown handling with connection cleanup.

10. **Reconnection backoff:** Both the relay client (CLI-side) and web client use exponential backoff with jitter.

11. **Ring buffer for output lines:** The output hook (`use-cli-output.ts:139`) limits stored lines to 500.

12. **Config key masking:** API keys in config responses are partially masked (first 4 chars + `****`).

---

## 8. Summary Matrix

| ID | Severity | Category | File | Summary |
|----|----------|----------|------|---------|
| P0-1 | CRITICAL | Auth | server.ts:757 | Unauthenticated process execution via `start_ollama` |
| P0-2 | CRITICAL | Auth/CORS | server.ts:196 | Token exposed via CORS `*` on `/api/token` |
| P0-3 | CRITICAL | Auth | server.ts:748 | Voice input injection from unauthenticated clients |
| P1-1 | HIGH | DoS | server.ts:140 | No HTTP body or WS message size limits |
| P1-2 | HIGH | DoS | server.ts:706 | No rate limiting on local WS server |
| P1-3 | HIGH | Auth | server.ts:690 | Auth timeout auto-promotes to brain client |
| P1-4 | HIGH | Credentials | relay-client.ts:59 | API key sent as JSON payload, not header |
| P1-5 | HIGH | Validation | web/server.ts:202 | Relay forwards raw CLI messages without validation |
| P1-6 | HIGH | Auth | relay-auth.ts:70 | JWT decode with empty string salt |
| P2-1 | MEDIUM | Type Safety | server.ts, relay-client.ts | 70+ `(msg as any)` casts bypass type checking |
| P2-2 | MEDIUM | Maintainability | server.ts, relay-client.ts | Entire handler dispatch duplicated |
| P2-3 | MEDIUM | Logic | server.ts, relay-client.ts | Missing switch cases for plan mode messages |
| P2-4 | MEDIUM | Memory | use-cli-connection.ts:421 | Unbounded growth of state arrays |
| P2-5 | MEDIUM | Logic | relay-client.ts:147 | Output subscriptions silently dropped in relay mode |
| P2-6 | MEDIUM | Compat | (multiple) | No protocol version negotiation |
| P2-7 | MEDIUM | Credentials | relay-client.ts:395 | Partial API key leaked over relay |
| P2-8 | MEDIUM | Security | server.ts:60 | Unauthenticated Ollama proxy (pull/delete) |
| P3-1 | LOW | Storage | CliManager.tsx:126 | Token in sessionStorage |
| P3-2 | LOW | DoS | server.ts:684 | No maximum connection limit |
| P3-3 | LOW | Resource | server.ts:686 | Auth timeout not cleared on close |
| P3-4 | LOW | Resource | relay-client.ts:512 | Event listeners not cleaned up on close |
| P3-5 | LOW | Logic | use-cli-connection.ts:265 | Reconnect counter grows unbounded |
| P3-6 | LOW | Error handling | server.ts:341 | sendChat errors silently swallowed |
| P3-7 | LOW | Performance | use-cli-discovery.ts:99 | Aggressive port scanning frequency |
| P3-8 | LOW | Validation | relay-client.ts:70 | Auth response not validated |

---

**Recommended Priority:**

1. **Immediate (before any public deployment):** P0-1, P0-2, P0-3 -- these allow remote exploitation from any website the user visits.
2. **Before production release:** P1-1 through P1-6 -- these are exploitable by local attackers or represent significant security weaknesses.
3. **Next sprint:** P2-1 through P2-8 -- these improve robustness and prevent subtle bugs.
4. **Backlog:** P3-1 through P3-8 -- hardening and cleanup.

**Total findings: 24** (3 Critical, 6 High, 8 Medium, 8 Low)
