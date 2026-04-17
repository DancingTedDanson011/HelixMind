# Changelog

All notable changes to HelixMind will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Source of truth:** This CHANGELOG plus `git log` reflect the actual state
> of the codebase. Standalone audit documents in the repo root (`bug-report.md`,
> `AUDIT-cli-web-integration.md`, `AGENT-RESEARCH.md`, etc.) are historical
> snapshots and may be out of date — treat them as archive, not current state.

## [0.7.0] - 2026-04-17

Largest security & correctness release to date. 11-agent UltraThink audit swarm
surfaced 160 findings across the codebase; ~72 were fixed in this version.
1129/1129 tests pass, 0 TSC errors.

### Security (Critical)
- **Web SaaS**: SAML JIT-provisioning no longer takes over pre-existing
  password/OAuth accounts by email match. `allowedDomains` is now required;
  email-matched users must already be team members or have no credentials.
- **Web SaaS**: Admin plan grants now require a linked `stripeCustomerId` or
  explicit `ALLOW_COMP_PLANS=true` env; every grant writes to a new `AuditLog`.
- **Brain WebSocket**: Web-chat origin cannot invoke auto-allowed shell
  commands anymore. `PermissionManager` now tracks origin (`'local'` vs
  `'web-chat'`) and forces `run_command`/`write_file`/`edit_file`/`git_commit`
  to `'ask'` level for any non-local caller. Fixes remote file exfiltration via
  `cat ~/.ssh/id_rsa` style prompts.
- **Brain WebSocket**: Remote permission auto-approval is disabled by default.
  Opt-in only, never allowed for web-chat origins.
- **Brain WebSocket**: `verifyClient` on WS upgrade validates Origin against
  loopback; `/api/token` capped at 3 serves per server lifetime; timing-safe
  token comparison (`crypto.timingSafeEqual`).
- **Brain WebSocket**: `stdout-capture` now redacts secrets
  (`sk-`, `sk-ant-`, `ghp_`, `Bearer`, `AKIA`, PEM private keys, JWTs, Slack
  tokens) before pushing captured terminal output to web clients.
- **Brain WebSocket**: Destructive remote actions (`switch_model`,
  code-affecting `revert_to_checkpoint`) refused by default.
- **Brain WebSocket**: `register_project` / `create_brain` path validation
  rejects relative paths, UNC paths, and system directories
  (`C:\Windows`, `/etc`, `/usr/`, `/bin/`, ...).
- **Jarvis Autonomy**: `AutonomyManager.setLevel()` validates integer range
  + L4+ requires ≥20 proposals + ≥90% approval rate.
- **Jarvis Autonomy**: Daemon no longer auto-enables `yolo`/`skipPermissions`
  based on autonomy level. Permission prompts fire regardless of level; only
  explicit CLI flags (`--yolo`, `--skip-permissions`) propagate.
- **Jarvis Autonomy**: LLM-generated skills cannot be dynamically imported
  until the user explicitly approves them. Static validation rejects
  `child_process`, `eval`, `new Function`, absolute-path writes.
- **Jarvis Autonomy**: Self-modify path matching is now POSIX-suffix-normalized
  against a hardened allowlist; `run_command` strings are scanned for
  self-modify paths too.
- **Jarvis Autonomy**: Notifier webhooks validate URL (https only, no
  localhost/RFC1918/link-local). Notification config added to blocked-files.
- **Jarvis Autonomy**: Ethics audit log persists to
  `~/.helixmind/jarvis/audit.jsonl` (append-only).
- **Spiral**: Secrets in chat messages are redacted before being persisted to
  the spiral brain via `saveState()`. Covers API keys, OAuth tokens, PEM keys,
  JWTs, AWS keys.

### Performance
- **Anthropic Prompt Caching**: `cache_control: ephemeral` markers on
  system prompt + tool list + last user message. Typical 5-10× cost reduction
  on long coding sessions. `TokenUsage` extended with
  `cache_creation_input_tokens` / `cache_read_input_tokens`.
- **Provider**: `stream()` now accepts `AbortSignal` — ESC during streaming
  actually aborts the HTTPS connection instead of letting it drain.
- **Provider**: Retry ownership collapsed — provider owns rate-limit retries,
  agent loop no longer retries on top (eliminated up-to-30 calls-per-turn
  amplifier). All retry sleeps are signal-aware.
- **Provider**: Rate limiter is now per-provider (class-based). Background
  `/security` + `/auto` sessions no longer cross-contaminate backoff state.
- **Provider**: Real `retry-after-ms` / `retry-after` headers used before
  regex fallback. 120s cap on wait time.
- **Provider**: Per-model `max_tokens` via new `getMaxOutputTokens()`.
  Registered `claude-opus-4-7` + `claude-opus-4-7-1m` +
  `claude-sonnet-4-6-1m`.

### Bug Fixes
- **CLI**: Double-ESC root cause resolved. Previously 3 competing ESC
  detectors raced on every keystroke (`chat.ts` 800ms, `input.ts` 300ms,
  readline keypress) — none consumed the event. Consolidated to single owner.
- **CLI**: Paste-cancel keypress listener no longer leaks on re-entry (was
  prepended forever, stacked on every chat session).
- **CLI**: Dead `panelJustClosed` flag removed — it was never set to true, so
  ESC-to-close-panel also aborted the running agent. Replaced with live
  `inputMgr.isSuggestionOpen` check.
- **CLI**: Double-ESC with agent running now aborts agent AND opens Rewind
  (previously silently refused).
- **CLI**: Full-screen browser listener save/restore wrapped in try/finally —
  no more frozen stdin if the Rewind browser throws. Rewind errors now
  surfaced via `renderError` instead of silently swallowed.
- **CLI**: `/stop` now also interrupts the main agent (previously only
  background sessions).
- **CLI**: Assistant replies are now persisted to `saveState()` — previously
  only user messages were saved, so conversation resume lost half the history.
- **CLI**: Error classification uses real regex instead of
  `errMsg.includes('invalid.*key')` (which took `.*` literally).
- **Checkpoints**: Binary files (images, archives, wasm, compiled artifacts)
  survive revert. Null-byte detection classifies binary; snapshots store
  base64; revert decodes without UTF-8.
- **Checkpoints**: Reverting now deletes files that were newly created after
  the checkpoint, instead of silently leaving them on disk while claiming
  success.
- **Spiral**: Engine `store()` / archive `importNode()` dedup now unified on
  SHA-256. Archive import validates `type`, clamps `level` to [1,5], defaults
  relevance score, truncates oversized content.
- **Spiral**: Fallback vector search guards against dimension mismatches;
  fallback `embeddings` table now has `ON DELETE CASCADE` to nodes;
  v4→v5 schema migration cleans up orphan rows.
- **Spiral**: Concurrent `store()` calls are transaction-safe (race-free
  dedup + create).
- **Spiral**: Web-enricher content enters the spiral at L2 (Active) instead
  of L1 (Focus), and is prefixed with `[web:<domain>]` for injection
  transparency.
- **Spiral**: Summaries slice on code-point boundaries (multibyte-safe);
  token counts update after summarization.
- **Spiral/Web-Enricher**: HTML parsers capped at 200 KB to prevent ReDoS.
- **Jarvis**: Instance lock now atomic (O_EXCL + temp+rename).
- **Jarvis**: Cron scheduler computes real next-fire times instead of
  approximating `now + 60 000ms`.
- **Jarvis**: Trigger pattern validation + action whitelist (propose/notify
  only; execute requires explicit gating).
- **Jarvis**: Queue age-based priority promotion prevents starvation of
  low-priority tasks.
- **Jarvis**: Learning normalizer preserves basename — no longer collapses
  distinct path errors into one class.
- **Jarvis**: Sentiment analyzer requires 3-of-5 rolling window before
  adjusting persona traits.
- **Web SaaS**: Brainstorm SSE error payloads are generic now; real errors
  logged server-side (was leaking Anthropic error objects).
- **Web SaaS**: Brainstorm persists BOTH user and assistant messages in a
  single transaction (was saving assistant-only).
- **Web SaaS**: `/api/health` no longer exposes raw Prisma/Postgres errors
  (DATABASE_URL fragments, SSL errors, schema names).
- **Web SaaS**: Stripe webhook idempotency marker now written OUTSIDE the
  transaction — unknown price IDs no longer roll back the marker and trigger
  the 3-day retry-loop state drift.
- **Web SaaS**: Team invite tokens use `crypto.randomBytes(32)` instead of
  cuid; accept endpoint collapses all failure modes to generic 400 to prevent
  enumeration.
- **Web SaaS**: CSP dropped `'unsafe-eval'`; `connect-src` restricted
  (was `wss: ws: https:` blanket allow).

### Housekeeping
- **Deps**: Removed unused `cli-highlight` from dependencies.
- **Deps**: Added `node-notifier` to `optionalDependencies` (was
  dynamic-imported but never declared — `case 'system'` notification branch
  was structurally unreachable).
- **Repo**: Deleted 8 stale root-level files (`concurrently`,
  `filemind@1.0.0`, `hx`, `.trigger`, `files.zip`, `test-input-live.ts`,
  `test_brain_fix.js`, `test_model_activation.js`).

### Known Open Issues (Deferred)
- `JARVIS-CRITICAL-1`: `assertCanExecute()` is not yet invoked from the
  per-tool dispatch in `src/cli/agent/tools/registry.ts`. Partial
  safeguards are in place (JARVIS-CRITICAL-2 removes auto-YOLO; JARVIS-HIGH-2
  blocks self-modify paths). Full wiring requires a dedicated refactor.
- `chat.ts` is 6452 lines — extraction into `chat/repl.ts` +
  `chat/slash-commands/` + `chat/state.ts` recommended but not in 0.7.0.
- Session tab switching (Ctrl+PgUp/PgDn) does not replay the target
  session's output — cosmetic-only switch remains.
- 22 UI-rendering polish items (flicker, emoji/CJK cursor alignment,
  narrow-terminal `.repeat(negative)` crash) deferred to follow-up release.
- Repo-size bloat (`brain-versions/` 450 MB, `remotion_videos/` 666 MB,
  `..helixmind/` 15 MB) not yet removed — requires user confirmation.

## [0.6.5] - 2026-04-10

- Add glm-5.1 to Z.AI model list as default.

## [0.6.4] - 2026-04-10

- Publish with custom model registration fix.

## [0.6.3] - 2026-04-10

- Custom model registration, worktree support, shell hardening, topology docs.

## [0.5.27] - 2026-03

- Fix double-ESC conflict + cursor jump from ESC hint.

## [0.5.26] - 2026-03

- Fix Jarvis startup banner not rendering until next input.

## [0.5.25] - 2026-03

- Fix ESC handling — Jarvis/special modes need deliberate double-ESC.

## [0.5.24] - 2026-03

- Fix cursor jump — don't call showPrompt() while user is typing.

## [0.5.23] - 2026-03

- Fix cursor jump when background session output arrives.

## [0.5.22] - 2026-03

- Performance — lazy embeddings + parallel startup.

## [0.5.21] - 2026-03

- Smart tab collapse — show summary when sessions overflow.

## [0.5.20] - 2026-03

- Fix `/model` provider switching — show all providers, fix stdin race.

## [0.5.19] - 2026-03

- Auto-migrate provider base URLs on config load.

## [0.5.18] - 2026-03

- Jarvis autonomy L3-L5 previously bypassed permission prompts (see 0.7.0 — reverted for safety).

## [0.5.17] - 2026-03

- Fix Z.AI base URL — use coding endpoint.

## [0.5.16] - 2026-03

- ESC/double-ESC cancels every interactive prompt.

## [0.5.15] - 2026-03

- Fix `/keys` — show API key prompt, remove duplicate provider list.

## [0.5.14] - 2026-03

- Fix `/keys` always selecting Anthropic + autonomy menu flickering.

## [0.5.13] - 2026-03

- Fix cursor position in input frame during agent work.

## [0.5.12] - 2026-03

- Paste always shows badge, never auto-queues.

## [0.5.11] - 2026-03

- Cursor always visible in input frame, even during agent work.

## [0.5.10] - 2026-03

- Hide cursor during agent work — was blinking above input frame.

## [0.5.9] - 2026-03

- Fix cursor reset to 0 after paste — `rl.prompt()` was resetting cursor.

## [0.5.8] - 2026-03

- Fix cursor position jumping to start on paste.

## [0.5.7] - 2026-03

- Fix cursor jumping, paste badge rendering, add missing core sources.

## [0.5.6] - 2026-03

- Fix raw stdout/stderr leak from `run_command` tool.

## [0.5.5] - 2026-03

- Fix permission menu rendering, YOLO always available.

## [0.5.0] - 2026-03

- Fix sub-menu rendering, inline paste badges, permission cycling.

## [0.3.96] - 2026-03

### Performance
- Add embedding LRU cache — eliminates redundant ONNX inference calls.
- Batch edge queries in injection engine — 60 SQL queries → 1 per spiral query.
- Reuse spiral context for validation — eliminates duplicate spiral query per turn.
- Cache systemTokens + skip redundant first trim in agent loop.
- Optimize context trimmer from O(N²) to O(N).
- Debounce tool-call spiral stores — N embeddings → 1 batch summary per loop.

## [0.1.2] - 2025-06

### Added
- 🔐 **Authentication System**
  - OAuth browser flow with local callback server.
  - API key authentication (`--api-key`).
  - Feature gating based on subscription tier.
  - `login`, `logout`, `whoami` commands.
- 🔬 **Validation Matrix**
  - Static code quality checks (21KB analyzer).
  - Dynamic runtime behavior checks.
  - Spiral consistency checks.
  - Automatic issue classification and autofix.
