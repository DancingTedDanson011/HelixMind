# HelixMind CLI Bug Report -- Production Readiness Audit

> **⚠️ ARCHIVED — 2026-03-08 SNAPSHOT.** This document describes the codebase
> as it stood on **2026-03-08**. Many findings were resolved in releases
> **0.5.5 through 0.7.0**. For the current state, see `CHANGELOG.md` and
> `git log`. Do not treat this file as a description of the current codebase.

**Date:** 2026-03-08
**Scope:** Input handling, terminal rendering, state management, anti-patterns
**Files analyzed:** 18 source files, ~9,500 lines of code
**Verdict (as of 2026-03-08):** NOT production ready -- 34 issues found (6 critical, 11 high, 12 medium, 5 low)

---

## Table of Contents

1. [CRITICAL: Input Handling Issues](#1-input-handling-issues)
2. [CRITICAL: Terminal Rendering Bugs](#2-terminal-rendering-bugs)
3. [HIGH: State Management Issues](#3-state-management-issues)
4. [HIGH/MEDIUM: Anti-Patterns](#4-anti-patterns)
5. [Summary Matrix](#5-summary-matrix)

---

## 1. Input Handling Issues

### BUG-001: Dual stdin listener removal in Rewind browser creates double-removal conflict
**File:** `src/cli/commands/chat.ts` lines 2637-2638 AND `src/cli/checkpoints/browser.ts` lines 133-136
**Severity:** CRITICAL

Both the caller (chat.ts openRewindBrowser) and the callee (browser.ts runCheckpointBrowser) independently remove ALL stdin data listeners and save them for later restoration. chat.ts at line 2638 calls `process.stdin.removeAllListeners('data')` and saves a snapshot. Then browser.ts at lines 133-136 does the SAME thing -- but at this point, the listeners are already gone. When browser.ts cleanup runs (line 290-295), it restores an empty list. Then chat.ts (line 2666-2668) tries to restore from its snapshot, but those listeners may already have been re-added in a different state.

**Why it causes problems:** If the browser throws an unexpected error or the order of cleanup changes, stdin data listeners can be lost permanently, leaving readline unable to receive input. Even in the happy path, the double save/restore is fragile -- any change to either component's listener management breaks the other.

---

### BUG-002: gateCheck creates a second readline interface while the main one exists
**File:** `src/cli/commands/chat.ts` lines 4438-4444
**Severity:** CRITICAL

```typescript
const gateRl = readline.createInterface({ input: process.stdin, output: process.stdout });
```

This creates a SECOND readline interface attached to the same stdin/stdout while the main `rl` is only paused (not closed). Node.js readline interfaces each register their own keypress and data listeners on stdin. Even though the main rl is paused, readline's internal `emitKeypressEvents` data handler is still attached. Two readline interfaces competing for the same stdin causes:

- Phantom keypress events leaking between interfaces
- The main rl's internal line buffer accumulating characters typed during the gate prompt
- Potential raw mode conflicts (the gate rl may change raw mode state)

**Why it causes problems:** After gateRl.close() and rl.resume(), the main readline may have buffered ghost input, and the internal emitKeypressEvents handler can end up registered multiple times (Node.js readline only adds it once, but does not track removal by the second interface).

---

### BUG-003: selectMenu does not save/restore keypress listeners
**File:** `src/cli/ui/select-menu.ts` lines 112-207
**Severity:** HIGH

selectMenu sets raw mode (line 115) and adds its own `data` listener (line 196), but it does NOT remove/save the existing keypress listeners that are attached by readline's `emitKeypressEvents`. This means that while the select menu is active:

- readline's keypress converter continues to fire on every raw byte
- The main chat.ts keypress handlers (ESC detection at line 2448, type-ahead preview at line 3884, paste-cancel at line 3870) continue processing keystrokes
- Arrow key navigation in the select menu simultaneously triggers the suggestion panel logic and ESC detection

The cleanup at line 149 only removes its own `data` listener -- it does not undo the side effects of keypress events that fired during menu interaction.

---

### BUG-004: Race condition between remote and local permission prompts
**File:** `src/cli/agent/permissions.ts` lines 290-322
**Severity:** HIGH

```typescript
const result = await Promise.race([
  localPromise.then(...),
  remotePromise.then(...),
]);
```

When remote wins the race (line 313-314 comment: "If remote won, readline is still waiting but that's okay -- it'll just be ignored"), the local selectMenu prompt is left dangling. The select menu's raw data listener is still attached to stdin. Its raw mode change was never cleaned up. The comment acknowledges this but dismisses it as harmless -- it is not. The orphaned data listener continues to intercept keystrokes until the user happens to press a key that triggers the selectMenu's cleanup path.

---

### BUG-005: Bracketed paste raw data listener returns before readline can process
**File:** `src/cli/commands/chat.ts` lines 2551-2617
**Severity:** MEDIUM

The raw data listener is added via `prependListener` (line 2551), which means it fires BEFORE readline's internal data handler. When a bracketed paste is detected, the listener returns early (line 2573: `return; // Suppress -- don't let readline see paste markers`). However, prependListener does NOT prevent other listeners from firing -- it only controls order. The `return` statement exits this one callback, but readline's data handler (and the emitKeypressEvents handler) still receive the same chunk. The paste start marker bytes flow into readline's line buffer.

**Why it causes problems:** The paste marker escape sequence `\x1b[200~` is interpreted by readline as a partial escape sequence, potentially corrupting the line buffer or triggering unintended keypress events.

**Note:** This may be mitigated if readline's internal handler is the one that strips bracketed paste markers (Node.js 18+ does this natively). If the target Node.js version handles this, the custom paste detection layer creates a double-processing scenario where both the custom handler and readline's built-in handler try to handle the same paste.

---

### BUG-006: Double-ESC detection fires openRewindBrowser as async without proper error boundary
**File:** `src/cli/commands/chat.ts` lines 2596-2612
**Severity:** MEDIUM

The raw data listener is an async function (line 2551: `async (chunk: Buffer) => {`). When double-ESC is detected, it calls `await openRewindBrowser()` (lines 2599, 2608). If openRewindBrowser throws, the Promise rejection propagates to Node.js's unhandled rejection handler because there is no `.catch()` on the prependListener callback. The `data` event emitter does not catch Promise rejections from async listeners.

---

### BUG-007: Paste-cancel keypress handler never cleaned up
**File:** `src/cli/commands/chat.ts` lines 3866-3878
**Severity:** MEDIUM

A keypress listener is prepended to stdin (line 3870) that handles ESC to discard paste buffers. This listener:
1. Is never removed -- it persists for the entire session lifetime
2. Captures a snapshot of existing keypress listeners at line 3868 (`const origKeypress = ...`) but never uses it
3. Does not coordinate with the other ESC handlers (the main keypress handler at line 2491 and the raw data listener at line 2596)

The unused `origKeypress` variable suggests the original intent was to save/restore listeners, but this was never implemented.

---

### BUG-008: Type-ahead preview keypress handler fires unconditionally on every keystroke
**File:** `src/cli/commands/chat.ts` lines 3884-3901
**Severity:** LOW

This keypress handler is added via `process.stdin.on('keypress', ...)` -- it is a permanent listener that fires on EVERY keypress for the entire session. While it has early-return guards (line 3885, 3888), the setImmediate callback at line 3887 creates a microtask queue entry for every single keystroke during agent work. Under rapid typing, this generates a backlog of setImmediate callbacks that each check state and potentially write to the prompt row, causing flickering.

---

## 2. Terminal Rendering Bugs

### BUG-009: Two independent stdout hooks can be active simultaneously
**File:** `src/cli/ui/bottom-chrome.ts` lines 342-379 AND `src/cli/ui/input-window.ts` lines 464-483
**Severity:** CRITICAL

BottomChrome._hookStdout() (line 342) monkey-patches `process.stdout.write`. InputWindow._hookStdout() (line 464) ALSO monkey-patches `process.stdout.write`. If both are activated:

- The second hook overwrites the first hook's reference
- Only the second hook's `_originalWrite` correctly points to the real stdout.write
- The first hook's `_originalWrite` is now the SECOND hook's wrapper
- Calling `_unhookStdout()` on either one partially restores the chain, but the other is left pointing at a dead reference

Even if the code currently never activates both simultaneously, there is no guard preventing it. InputWindow is fully implemented and exported -- any future usage creates an immediate stdout corruption bug.

---

### BUG-010: InputWindow uses cursor save/restore (DECSC/DECRC) that statusbar explicitly avoids
**File:** `src/cli/ui/input-window.ts` lines 291, 299, 313, 337, 357, 384, 398, 407, 421, 439
**Severity:** HIGH

InputWindow uses `\x1b[s` (save cursor) and `\x1b[u` (restore cursor) throughout its drawing methods. Meanwhile, statusbar.ts at line 176-178 has an explicit NOTE:

```
// NOTE: We avoid \x1b[s / \x1b[u (DECSC/DECRC) because Windows Terminal
// / ConPTY handles cursor save/restore unreliably during rapid output
```

And bottom-chrome.ts at lines 223-226 repeats the same warning. InputWindow contradicts this platform constraint, meaning any activation of InputWindow on Windows Terminal will produce cursor corruption and status bar fragments bleeding into the scroll area.

---

### BUG-011: BottomChrome stdout hook setTimeout creates ghost redraws after deactivation
**File:** `src/cli/ui/bottom-chrome.ts` lines 360-373
**Severity:** HIGH

The stdout hook schedules a redraw via `setTimeout(..., 16)` (line 362-373). If `deactivate()` is called during that 16ms window:
1. deactivate() sets `_active = false` (line 121)
2. deactivate() calls `_unhookStdout()` (line 125) -- restores original stdout.write
3. The pending setTimeout fires, checks `self._active` (line 364) -- it's false, so it skips
4. BUT: `_redrawScheduled` was set to true and was never reset back

If `activate()` is called again after this sequence, the `_redrawScheduled` flag is still `true`, so the FIRST newline write after reactivation will not schedule a redraw (the guard at line 355 checks `!self._redrawScheduled`). This causes the chrome to miss its first redraw after reactivation.

**Partial mitigation:** `_redrawScheduled` is reset in `_unhookStdout()` at line 386. However, the race exists if the setTimeout fires AFTER unhookStdout resets the flag but BEFORE the next activate call (unlikely but possible with event loop scheduling).

---

### BUG-012: Activity indicator writes "Done" line to stdout while mute callback may be active
**File:** `src/cli/ui/activity.ts` lines 145-178
**Severity:** HIGH

`stop()` calls `this._onUnmute?.()` at line 154 (which sets `rl.output = process.stdout`), then writes the "Done" line at line 173 via `process.stdout.write()`. However, if `stop()` is called while readline output is already unmuted (e.g., during tool execution when pauseAnimation already called onUnmute), the second unmute call is redundant but harmless. The real issue: the "Done" line write at line 173 goes through the BottomChrome stdout hook, which may schedule a chrome redraw that conflicts with the activity stop sequence.

Additionally, `stop()` restores hints on chrome row 1 (line 157-159) BEFORE writing the "Done" line (line 173). This means the chrome redraw triggered by the "Done" line write sees the restored hints and redraws them -- creating a brief visual flash where the hints appear, then the "Done" line scrolls content, then the chrome redraws again.

---

### BUG-013: Footer timer and activity animation can write to chrome rows concurrently
**File:** `src/cli/commands/chat.ts` lines 2857-2866 AND `src/cli/ui/activity.ts` line 92-96
**Severity:** MEDIUM

The footer timer runs every 500ms (line 2863) and calls `updateStatusBar()` which writes to chrome rows 2+3. The activity animation runs every 80ms (activity.ts line 93) and writes to chrome row 0. While they target different rows, both use `chrome.setRow()` which calls `_drawChromeRow()` which writes cursor-positioning escape sequences:

```
\x1b[?25l + \x1b[ROW;1H + content + \x1b[PROMPT;1H + \x1b[?25h
```

If both fire within the same event loop tick (possible when setInterval callbacks queue up), the interleaved escape sequences can leave the cursor at the wrong position. Neither writer uses a lock or batching mechanism.

---

### BUG-014: renderToolCall uses \r\x1b[K which conflicts with BottomChrome scroll region
**File:** `src/cli/ui/tool-output.ts` line 80
**Severity:** MEDIUM

```typescript
process.stdout.write(`\r\x1b[K  ...`);
```

The `\r` (carriage return) moves to column 0 of the CURRENT cursor row. `\x1b[K` erases from cursor to end of line. When BottomChrome is active with a scroll region, the "current cursor row" may not be where the code expects -- it could be at the prompt row (after a chrome redraw moved the cursor there) or at a chrome row. This causes tool output to overwrite chrome content or appear at incorrect positions.

---

### BUG-015: Scroll region off-by-one -- scroll region end equals prompt row
**File:** `src/cli/ui/bottom-chrome.ts` lines 315-326
**Severity:** MEDIUM

```typescript
const regionEnd = rows - total;
this._rawWrite(`\x1b[1;${regionEnd}r`);
```

DECSTBM `\x1b[1;N r` sets the scroll region to rows 1 through N (inclusive). `promptRow` is calculated as `rows - total` (line 68). So the prompt row IS the last row of the scroll region. Content written at the prompt row that overflows (wraps) will scroll WITHIN the scroll region, pushing earlier content up -- but the prompt itself sits at the scroll boundary. If the user types a line longer than the terminal width, the wrapped text pushes into the scroll area rather than staying at a fixed position.

---

### BUG-016: InputWindow._setScrollRegion uses 0-based row (off-by-one)
**File:** `src/cli/ui/input-window.ts` lines 445-451
**Severity:** MEDIUM

```typescript
const scrollEnd = rows - INPUT_WINDOW_HEIGHT - 1;
if (scrollEnd > 0) {
  process.stdout.write(`\x1b[0;${scrollEnd}r`);
}
```

DECSTBM uses 1-based row numbers. `\x1b[0;N r` is technically invalid -- row 0 does not exist. Most terminals treat row 0 as row 1, but this is implementation-dependent. The correct sequence should be `\x1b[1;${scrollEnd}r`.

---

### BUG-017: writeStatusBar bypasses BottomChrome -- direct absolute cursor positioning
**File:** `src/cli/ui/statusbar.ts` lines 169-191
**Severity:** MEDIUM

`writeStatusBar()` writes directly to `process.stdout.write()` with absolute cursor positioning (`\x1b[ROW;1H`). It calculates its own prompt row (line 179: `rows - 2`) which does NOT account for BottomChrome's extra rows (suggestion panel). When BottomChrome has extra rows (suggestion panel open), writeStatusBar positions its content at the wrong rows, overlapping with suggestion rows or the prompt.

However, looking at the code flow: writeStatusBar is used for inline mode (when chrome is inactive). If chrome IS active, updateStatusBar uses chrome.setRow() instead. This bug only manifests if writeStatusBar is called while chrome is active -- which would be a caller bug. Still, the function has no guard against this misuse.

---

## 3. State Management Issues

### BUG-018: AgentController.resume() clears _aborted flag -- allows zombie resumption
**File:** `src/cli/agent/loop.ts` line 595
**Severity:** CRITICAL

```typescript
resume(): void {
  this._paused = false;
  this._aborted = false;  // <-- This is the bug
  ...
}
```

After `abort()` is called (which sets `_aborted = true` and fires AbortController.abort()), calling `resume()` clears the `_aborted` flag. However, the AbortController's signal is PERMANENTLY aborted -- AbortController.abort() is irreversible. The `signal` getter (line 586) still returns the aborted signal. Any subsequent HTTP request using this signal will fail immediately with AbortError, even though `isAborted` returns `false`.

The `reset()` method (line 633) correctly creates a fresh AbortController. But `resume()` creates an inconsistent state: `_aborted === false` but `signal.aborted === true`.

---

### BUG-019: Global mutable state in tool-output.ts shared across sessions
**File:** `src/cli/ui/tool-output.ts` lines 25-26
**Severity:** CRITICAL

```typescript
let toolCallCount = 0;
let toolBlockOpen = false;
```

These module-level variables are shared across ALL sessions. When background sessions (security scan, auto mode) run their agent loops, they call `renderToolCall()` which increments the SAME `toolCallCount`. The main session and background sessions stomp on each other's counter, producing misleading `[N]` step numbers. `toolBlockOpen` causes visual corruption when one session opens a block and another tries to render within it.

`resetToolCounter()` (line 29) is called at agent start, but which agent? If the main session resets while a background session is mid-block, the background session's rendering becomes inconsistent.

---

### BUG-020: Session.capture() sends stale index after splice
**File:** `src/cli/sessions/session.ts` lines 100-108
**Severity:** HIGH

```typescript
capture(line: string): void {
  this.output.push(line);
  const index = this.output.length - 1;
  if (this.output.length > 500) {
    this.output.splice(0, this.output.length - 500);
  }
  this.onCapture?.(line, index);
}
```

The `index` is captured BEFORE the splice. If the output array was at 500 items, after push it's 501, so `index = 500`. Then splice removes 1 element from the front, making the array 500 items. Now `index` (500) is out of bounds -- the valid range is 0-499. The onCapture callback receives an index that does not correspond to any valid position in the output array.

---

### BUG-021: SessionManager.autoCloseTimers never call unref()
**File:** `src/cli/sessions/manager.ts` lines 170-184
**Severity:** HIGH

```typescript
const timer = setTimeout(() => {
  // auto-close logic
}, SessionManager.AUTO_CLOSE_DELAY_MS);
this.autoCloseTimers.set(id, timer);
```

These setTimeout handles are NOT unref'd. As long as any auto-close timer is pending, Node.js will not exit gracefully. If the user presses Ctrl+C to exit while a session is pending auto-close, the process hangs until the timer fires (up to AUTO_CLOSE_DELAY_MS). Compare with the footer timer at chat.ts line 2866 which correctly calls `footerTimer.unref()`.

---

### BUG-022: SessionManager.completionListeners array never cleaned up
**File:** `src/cli/sessions/manager.ts` line 208-209
**Severity:** MEDIUM

```typescript
onComplete(listener: (session: Session) => void): void {
  this.completionListeners.push(listener);
}
```

Listeners are added but never removed. Every call to `onComplete()` adds a closure that holds references to its enclosing scope. Over a long-running session with many background tasks being created, this accumulates closures (potential memory leak). There is no `offComplete()` or `removeCompletionListener()` method.

---

### BUG-023: gitCache and gitCacheTime are module-level globals without invalidation on cwd change
**File:** `src/cli/ui/statusbar.ts` lines 220-221
**Severity:** MEDIUM

```typescript
let gitCache: { branch: string; uncommitted: number } | null = null;
let gitCacheTime = 0;
```

The cache stores git info from `getGitInfo(projectRoot)`, but the cache key is purely time-based (10s TTL). If the user changes the working directory (e.g., via a tool call), the cache returns stale data from the PREVIOUS directory until the TTL expires. The `invalidateGitCache()` function exists but is not called on directory changes -- only after explicit git operations.

---

### BUG-024: lastAnswerStartRow is a module-level global with cross-session implications
**File:** `src/cli/ui/chat-view.ts` (referenced from summary -- global state at line 160)
**Severity:** LOW

The `lastAnswerStartRow` variable is shared across all code that uses chat-view rendering. If background sessions render assistant output, they update this shared row counter, affecting the main session's diff rendering.

---

## 4. Anti-Patterns

### BUG-025: process.stdout.write mixed with console.log across the codebase
**File:** Multiple files
**Severity:** MEDIUM

The codebase exclusively uses `process.stdout.write()` for output, which is correct for terminal UI management. However, chalk-styled strings written via `process.stdout.write()` go through the BottomChrome stdout hook (which monitors for newlines to trigger redraws). Any third-party dependency that uses `console.log()` would bypass this -- and console.log adds a newline that the hook does not see coming from the expected code path. The lack of stderr separation for diagnostic messages means all output competes with the UI rendering.

---

### BUG-026: Raw mode toggling without centralized state tracking
**File:** Multiple files
**Severity:** HIGH

Raw mode is toggled by multiple independent components without centralized coordination:

| Component | Sets raw mode | File:Line |
|---|---|---|
| Chat startup | `setRawMode(true)` | chat.ts:2078 |
| Checkpoint browser | `setRawMode(true)`, restores `wasRaw` | browser.ts:300-302 |
| Select menu | `setRawMode(true)`, restores `wasRaw` | select-menu.ts:115 |
| Multi-select menu | `setRawMode(true)`, restores `wasRaw` | select-menu.ts:281 |
| Permission prompt | calls selectMenu (which toggles raw mode) | permissions.ts:374 |

Each component saves `wasRaw` locally and restores it on cleanup. If TWO components nest (e.g., permission prompt opens selectMenu while another selectMenu is somehow active), the inner component's cleanup restores raw mode to the state BEFORE the outer component set it -- turning off raw mode while the outer component still needs it.

The chat startup sets raw mode to true and NEVER restores it. If the process exits abnormally (crash, SIGKILL), the terminal is left in raw mode (no echo, no line editing). The cleanup in `rl.on('close')` at line 3903 calls `process.exit(0)` without restoring raw mode -- Node.js does restore terminal settings on clean exit, but not on all exit paths.

---

### BUG-027: Cursor manipulation without position tracking
**File:** `src/cli/ui/bottom-chrome.ts`, `src/cli/ui/statusbar.ts`, `src/cli/ui/activity.ts`
**Severity:** MEDIUM

All cursor positioning uses absolute row/column numbers calculated from `process.stdout.rows`. None of the components track the ACTUAL cursor position. If any write operation causes unexpected scrolling (e.g., a long tool output that triggers terminal scroll), all absolute position calculations become wrong because `process.stdout.rows` reports the terminal SIZE, not the current viewport position.

The BottomChrome stdout hook (line 355-373) partially addresses this by scheduling redraws after newline writes, but it cannot detect scrolling caused by content wrapping (text wider than terminal width that wraps to the next line without an explicit `\n`).

---

### BUG-028: Missing error handling on stdin/stdout operations
**File:** Multiple files
**Severity:** MEDIUM

Throughout the codebase, `process.stdout.write()` calls are never checked for errors. While stdout.write rarely fails in normal operation, it can fail if:
- The output is piped and the pipe breaks (EPIPE)
- The terminal is disconnected (ENXIO)
- Stdout backpressure builds up (write returns false)

Similarly, `process.stdin.setRawMode()` can throw if stdin is not a TTY (even though there are `isTTY` guards, race conditions with terminal disconnection can cause the guard to pass but the call to fail).

---

### BUG-029: Prompt history file locking is not truly atomic
**File:** `src/cli/ui/prompt-history.ts` lines 118-167
**Severity:** MEDIUM

The "withLock" implementation at line 118 attempts file-based locking, but has multiple issues:

1. **Line 128:** When a stale lock is detected, it overwrites the lock file with a regular `writeFileSync` -- NOT with the exclusive `wx` flag. If two processes both detect a stale lock simultaneously, both overwrite and both think they have the lock.

2. **Line 140-148:** `writeFileSync` with `wx` flag is attempted, but on failure, the catch block at lines 143-144 falls through to a regular `writeFileSync` (overwrite mode). This defeats the purpose of exclusive creation.

3. **Line 166:** After all retries fail, the function executes `fn()` WITHOUT the lock. This "best effort" approach means concurrent HelixMind instances can corrupt the history file.

---

### BUG-030: visibleLength function duplicated across files
**File:** `src/cli/ui/statusbar.ts` line 391-394 AND `src/cli/ui/input-window.ts` lines 499-502
**Severity:** LOW

The exact same `visibleLength()` function is copy-pasted in two files:

```typescript
function visibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\].*?\x07/g, '').length;
}
```

statusbar.ts exports it (line 391: `export function`), but input-window.ts defines its own private copy instead of importing. The regex also has a limitation: it does not handle `\x1b[38;2;R;G;Bm` (24-bit color) correctly in all cases, and does not account for wide characters (CJK, emoji) which occupy 2 terminal columns but have string length 1-2.

---

### BUG-031: Bracketed Paste Mode never disabled on exit
**File:** `src/cli/commands/chat.ts` line 2082
**Severity:** MEDIUM

```typescript
process.stdout.write('\x1b[?2004h'); // Enable Bracketed Paste Mode
```

Bracketed Paste Mode is enabled at startup but NEVER disabled. The `rl.on('close')` handler (lines 3903-3940) does not write `\x1b[?2004l`. If HelixMind exits while bracketed paste mode is enabled, the terminal inherits this mode. Most modern terminals reset on process exit, but some terminal multiplexers (tmux, screen) and SSH sessions do not. This leaves the user's terminal in a state where pasting is wrapped in escape sequences, potentially confusing other applications.

---

### BUG-032: Mouse tracking disabled but never re-enabled in select-menu
**File:** `src/cli/ui/select-menu.ts` lines 28-29, 120
**Severity:** LOW

```typescript
const MOUSE_OFF = '\x1b[?1000l\x1b[?1003l\x1b[?1006l';
const MOUSE_ON  = '\x1b[?1000h\x1b[?1003h\x1b[?1006h';
```

`MOUSE_OFF` is written when the menu opens (line 120), but `MOUSE_ON` is defined and never used. If any application running in the same terminal session had mouse tracking enabled (e.g., a mouse-enabled terminal app), selectMenu permanently disables it. The cleanup function (line 144) does not restore mouse tracking state.

---

### BUG-033: Activity animation setInterval not unref'd
**File:** `src/cli/ui/activity.ts` line 92-95
**Severity:** LOW

```typescript
this.interval = setInterval(() => {
  this.frame++;
  this.render();
}, 80);
```

The 80ms animation interval is not `.unref()`'d. While the activity indicator is running (during agent work), this interval prevents Node.js from exiting if all other work completes. Combined with BUG-021 (autoCloseTimers not unref'd), the process has multiple handles preventing graceful exit.

The footer timer correctly calls `.unref()` (chat.ts line 2866), but the activity indicator does not follow the same pattern. Since activity.stop() is always called when agent work ends, this rarely manifests as a hang -- but if stop() is missed due to an exception, the process cannot exit.

---

### BUG-034: chat-view renderAssistantEnd uses \r\x1b[K for stream line clearing
**File:** `src/cli/ui/chat-view.ts` line 233
**Severity:** LOW

`renderAssistantEnd()` writes `\r\x1b[K` to clear the streaming cursor line. Like BUG-014, this assumes the cursor is on the expected row. During BottomChrome active mode, the cursor may have been moved to the prompt row by a recent chrome redraw, causing the clear operation to erase the prompt instead of the stream line.

---

## 5. Summary Matrix

| ID | Severity | Category | File | Core Issue |
|---|---|---|---|---|
| BUG-001 | CRITICAL | Input | chat.ts, browser.ts | Double stdin listener save/restore conflict |
| BUG-002 | CRITICAL | Input | chat.ts:4438 | Second readline interface on shared stdin |
| BUG-009 | CRITICAL | Rendering | bottom-chrome.ts, input-window.ts | Two stdout hooks can corrupt write chain |
| BUG-018 | CRITICAL | State | loop.ts:595 | resume() clears abort but signal stays aborted |
| BUG-019 | CRITICAL | State | tool-output.ts:25-26 | Global mutable state shared across sessions |
| BUG-020 | CRITICAL -> HIGH | State | session.ts:100-108 | Stale index after output splice |
| BUG-003 | HIGH | Input | select-menu.ts | No keypress listener save/restore |
| BUG-004 | HIGH | Input | permissions.ts:290-322 | Orphaned selectMenu after remote wins race |
| BUG-010 | HIGH | Rendering | input-window.ts | Uses DECSC/DECRC despite Windows Terminal bug |
| BUG-011 | HIGH | Rendering | bottom-chrome.ts:360-373 | Ghost redraws after deactivation timing |
| BUG-012 | HIGH | Rendering | activity.ts:145-178 | "Done" write conflicts with chrome redraw |
| BUG-020 | HIGH | State | session.ts:100-108 | Capture sends stale index to subscribers |
| BUG-021 | HIGH | State | manager.ts:170-184 | autoCloseTimers prevent graceful exit |
| BUG-026 | HIGH | Anti-pattern | Multiple | Raw mode toggled without central tracking |
| BUG-005 | MEDIUM | Input | chat.ts:2551-2573 | Paste marker not truly suppressed from readline |
| BUG-006 | MEDIUM | Input | chat.ts:2551 | Async data listener without error boundary |
| BUG-007 | MEDIUM | Input | chat.ts:3866-3878 | Paste-cancel listener never removed |
| BUG-013 | MEDIUM | Rendering | chat.ts, activity.ts | Concurrent chrome row writes without lock |
| BUG-014 | MEDIUM | Rendering | tool-output.ts:80 | \r\x1b[K conflicts with scroll region |
| BUG-015 | MEDIUM | Rendering | bottom-chrome.ts:315-326 | Scroll region boundary includes prompt row |
| BUG-016 | MEDIUM | Rendering | input-window.ts:450 | 0-based DECSTBM row number |
| BUG-017 | MEDIUM | Rendering | statusbar.ts:169-191 | writeStatusBar bypasses chrome positioning |
| BUG-022 | MEDIUM | State | manager.ts:208-209 | Completion listeners never cleaned up |
| BUG-023 | MEDIUM | State | statusbar.ts:220-221 | Git cache not invalidated on cwd change |
| BUG-025 | MEDIUM | Anti-pattern | Multiple | No stderr separation for diagnostics |
| BUG-027 | MEDIUM | Anti-pattern | Multiple | Cursor position never tracked, only assumed |
| BUG-028 | MEDIUM | Anti-pattern | Multiple | No error handling on stdin/stdout ops |
| BUG-029 | MEDIUM | Anti-pattern | prompt-history.ts | File locking not actually atomic |
| BUG-031 | MEDIUM | Anti-pattern | chat.ts:2082 | Bracketed paste mode never disabled on exit |
| BUG-008 | LOW | Input | chat.ts:3884-3901 | setImmediate spam from keypress handler |
| BUG-024 | LOW | State | chat-view.ts | lastAnswerStartRow global across sessions |
| BUG-030 | LOW | Anti-pattern | statusbar.ts, input-window.ts | visibleLength duplicated + incomplete |
| BUG-032 | LOW | Anti-pattern | select-menu.ts | Mouse tracking disabled, never restored |
| BUG-033 | LOW | Anti-pattern | activity.ts:92-95 | Animation interval not unref'd |
| BUG-034 | LOW | Anti-pattern | chat-view.ts:233 | \r\x1b[K at wrong cursor position |

---

## Risk Assessment

**Highest risk scenarios:**
1. **Terminal becomes unresponsive** (BUG-001, BUG-002, BUG-003, BUG-026): Multiple paths lead to stdin listeners being lost or multiplied, leaving the user unable to type.
2. **Corrupt terminal output** (BUG-009, BUG-010, BUG-014, BUG-015, BUG-027): The scroll region and cursor positioning logic has multiple edge cases where content appears at wrong positions or overwrites the UI.
3. **Agent state inconsistency** (BUG-018, BUG-019): The controller resume/abort state mismatch and shared global counters can cause agents to run with permanently-aborted signals or display incorrect step numbers.
4. **Process hangs on exit** (BUG-021, BUG-033): Multiple timer handles prevent Node.js from exiting gracefully.

**Root causes:**
- No centralized terminal state manager (each component manages its own stdin/stdout state independently)
- No render queue or batching (multiple components write escape sequences concurrently)
- Module-level mutable globals used where session-scoped state is needed
- Save/restore pattern applied inconsistently (some components save listeners, some don't)
