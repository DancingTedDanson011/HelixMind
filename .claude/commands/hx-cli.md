# /hx-cli — HelixMind CLI Architecture Audit & Optimizer

Triggered by: `/hx-cli`
Optional: `/hx-cli [layer]` — e.g. `/hx-cli input` · `/hx-cli rendering` · `/hx-cli undo`

---

## FIRST ACTION — MANDATORY BEFORE ANYTHING ELSE

Before starting the audit, read ALL of these files in order:

```
.claude/claude-code-architecture/00-OVERVIEW.md
.claude/claude-code-architecture/01-INPUT-SYSTEM.md
.claude/claude-code-architecture/02-PASTE-HANDLING.md
.claude/claude-code-architecture/03-TEXT-INPUT.md
.claude/claude-code-architecture/04-RENDERING.md
.claude/claude-code-architecture/05-UNDO-REWIND.md
.claude/claude-code-architecture/06-KEYBINDINGS.md
.claude/claude-code-architecture/07-SPINNER-ANIMATION.md
.claude/claude-code-architecture/08-HISTORY-AUTOCOMPLETE.md
.claude/claude-code-architecture/09-THEMING.md
.claude/claude-code-architecture/10-TAKEAWAYS.md
```

Do not begin auditing until all 11 files are read.
These files are your ground truth — every finding must reference a specific
pattern from these documents.

After reading, confirm:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HX-CLI · ARCHITECTURE DOCS LOADED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Read: 00-OVERVIEW.md
✅ Read: 01-INPUT-SYSTEM.md
✅ Read: 02-PASTE-HANDLING.md
✅ Read: 03-TEXT-INPUT.md
✅ Read: 04-RENDERING.md
✅ Read: 05-UNDO-REWIND.md
✅ Read: 06-KEYBINDINGS.md
✅ Read: 07-SPINNER-ANIMATION.md
✅ Read: 08-HISTORY-AUTOCOMPLETE.md
✅ Read: 09-THEMING.md
✅ Read: 10-TAKEAWAYS.md

Reference standard loaded. Beginning audit of HelixMind CLI.
⏭ NEXT: Phase 0 — Locate CLI source files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## PHASE 0 — CLI SOURCE MAPPING

After reading the architecture docs, locate all HelixMind CLI source files:

```
CLI SOURCE MAP
→ Find all files under src/cli/**
→ Find entry point (index.ts / cli.ts / main.ts)
→ Find input handling files
→ Find rendering files
→ Find history/storage files
→ Find keybinding files
→ Find animation/spinner files
→ Find theming files
→ Find undo/rewind files
```

Output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HX-CLI · PHASE 0 · CLI SOURCE MAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PLAIN ENGLISH
[What HelixMind's CLI currently consists of. How it's structured.
 First impression of what's implemented vs what's likely missing.]

📊 Files Found: X  |  Layers Covered: X / 9  |  Obvious Gaps: X

[File map]

⏭ NEXT: Layer-by-layer audit starting with Layer 1 — Input Pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## OUTPUT STANDARD (every response)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HX-CLI · [LAYER NAME] · [STATUS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PLAIN ENGLISH
[What this layer does. What HelixMind has. What's missing.
 What a user experiences without it.]

📊 Checks: X  |  Gaps: X  |  Fixed: X  |  Already Good: X

[Findings below]

⏭ NEXT: [next layer or action]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## FINDING FORMAT

```
┌─────────────────────────────────────────────────────────┐
│ [🔴/🟠/🟡/🔵/⚡/✅] · HX-CLI-[LAYER]-###
├─────────────────────────────────────────────────────────┤
│ LAYER: [which of the 9 layers]
│ TYPE: MISSING / WRONG / SUBOPTIMAL / ALREADY-CORRECT
├─────────────────────────────────────────────────────────┤
│ PLAIN ENGLISH:
│ [What the user experiences because of this gap.]
│
│ CLAUDE CODE REFERENCE:
│ [Exact pattern from .claude/claude-code-architecture/
│  that should be implemented. File + section.]
│
│ HELIX CURRENT:
│ [What HelixMind's CLI currently does — file + line,
│  or "not implemented".]
│
│ FIX:
│ [Complete production-ready implementation. No stubs.]
│
│ PERFORMANCE IMPACT: [if applicable]
│ TRADEOFF: [NONE / MINOR / describe]
├─────────────────────────────────────────────────────────┤
│ STATUS: PENDING
└─────────────────────────────────────────────────────────┘
```

---

## ══ LAYER 1: INPUT PIPELINE ══════════════════════════════

Reference: `.claude/claude-code-architecture/01-INPUT-SYSTEM.md`

Audit the 5-layer pipeline from that document against HelixMind's stdin handling:

```
EXPECTED (Claude Code standard):
stdin (raw TTY)
  ↓ setRawMode + readable event (NOT data event)
  ↓ ANSI Tokenizer State Machine (handles incomplete sequences + 50ms timeout)
  ↓ Key Parser → { name, ctrl, meta, shift, fn, sequence, raw, isPasted }
  ↓ React Reconciler discreteUpdates batch
  ↓ useInput Hook

CHECK:
→ stdin.setRawMode(true) used?
→ readable event used (not data event)?
→ ANSI State Machine with timeout (50ms)?
→ Structured key event objects?
  { name, ctrl, meta, shift, fn, sequence, raw, isPasted }
→ rawModeEnabledCount reference counting?
→ Focus events enabled?
→ Cleanup on exit (rawMode off + Bracketed Paste off)?
→ Key name mapping complete?
  arrows / function keys / home / end / insert / delete / pageup / pagedown
```

---

## ══ LAYER 2: PASTE HANDLING ══════════════════════════════

Reference: `.claude/claude-code-architecture/02-PASTE-HANDLING.md`

```
CHECK:
→ stdout.write("\x1b[?2004h") on startup?
→ stdout.write("\x1b[?2004l") on exit?
→ State machine: PASTE_START (\x1b[200~) / PASTE_END (\x1b[201~)?
→ NORMAL_TIMEOUT = 50ms / PASTE_TIMEOUT = 500ms?
→ 100ms aggregation timer for chunked large pastes?
→ Enter keys inside paste NOT triggering submit?
→ Image paste detection?
  darwin:  osascript clipboard check
  win32:   powershell Get-Clipboard -Format Image
```

Missing Bracketed Paste → always 🔴 CRITICAL.

---

## ══ LAYER 3: TEXT INPUT ══════════════════════════════════

Reference: `.claude/claude-code-architecture/03-TEXT-INPUT.md`

```
CHECK:
→ CursorState is IMMUTABLE?
  Every method returns new object — never mutates in place
→ Intl.Segmenter for grapheme clusters?
  Without: "👨‍👩‍👧‍👦" backspace breaks, CJK columns wrong
→ Display-width mapping? (CJK/emoji = 2 cols)
→ Word wrap from terminal width?
→ All movement ops?
  left/right/up/down/startOfLine/endOfLine
  prevWord/nextWord/startOfLogicalLine/endOfLogicalLine
→ All edit ops?
  insert/backspace/del/deleteWordBefore/deleteWordAfter
  deleteToLineEnd/deleteToLineStart
→ Emacs keybindings?
  Ctrl+A/E/K/U/W/Y + Meta+B/F/D
→ Kill Ring?
  Array of killed text, max 10 entries, yank + rotate
→ Enter logic?
  Backslash+Enter → newline
  Shift/Meta+Enter → newline
  Plain Enter → submit
```

Missing Intl.Segmenter → always 🟠 HIGH minimum.

---

## ══ LAYER 4: RENDERING ═══════════════════════════════════

Reference: `.claude/claude-code-architecture/04-RENDERING.md`

```
CHECK:
→ Double-buffer implemented?
  Previous frame stored, diff computed, only changed lines rewritten
→ All output in ONE stdout.write() call?
→ Cursor hidden during render (\x1b[?25l), shown after (\x1b[?25h)?
→ Render throttling (leading+trailing)?
→ Terminal width change handled (SIGWINCH)?
→ ANSI codes excluded from width calculation?
→ Object pools for GC pressure reduction?
```

Missing double-buffer → always 🟠 HIGH.
Multiple stdout.write() per frame → always 🟡 MEDIUM.

---

## ══ LAYER 5: UNDO / REWIND ═══════════════════════════════

Reference: `.claude/claude-code-architecture/05-UNDO-REWIND.md`

```
CHECK — INPUT UNDO:
→ Ctrl+_ and Ctrl+Shift+- mapped?
→ Debounce 1000ms?
→ maxBufferSize 50?
→ Buffer cleared on submit?

CHECK — FILE HISTORY REWIND:
→ File tracked BEFORE edit (backup = original state)?
→ SHA256 hash for backup filenames?
→ ~/.helix/file-history/{sessionId}/ storage?
→ null backup for new files?
→ Snapshots grouped by messageId?
→ Snapshots persisted to transcript?
→ /rewind command implemented?
→ Dry-run preview before actual rewind?
→ Max snapshots cap?
```

---

## ══ LAYER 6: KEYBINDINGS ═════════════════════════════════

Reference: `.claude/claude-code-architecture/06-KEYBINDINGS.md`

```
CHECK:
→ Context-aware system?
  global / chat / autocomplete / confirm / historySearch
→ Same key = different action per context?
→ User config: ~/.helix/keybindings.json?

REQUIRED BINDINGS:
Global:        Ctrl+C (interrupt) / Ctrl+D (exit)
Chat:          Enter (submit) / Shift+Enter (newline)
               Ctrl+_ (undo) / Ctrl+R (history) / Ctrl+S (stash)
               Ctrl+G ($EDITOR) / Up/Down (history nav)
Autocomplete:  Tab (accept) / Escape (dismiss) / Up/Down (navigate)
Confirm:       Y+Enter (yes) / N+Escape (no)
HistorySearch: Ctrl+R (next) / Enter (execute) / Tab (accept)
```

---

## ══ LAYER 7: SPINNER / ANIMATION ════════════════════════

Reference: `.claude/claude-code-architecture/07-SPINNER-ANIMATION.md`

```
CHECK:
→ Shimmer effect on waiting state?
→ requesting state → 20fps / other states → 10fps?
→ prefersReducedMotion / NO_COLOR respected?
→ Stall detection at 3000ms?
→ Timing display (elapsed + tokens + thinking)?
→ Tool-use sine pulse?
→ Spinner clears cleanly on completion?
```

If shimmer missing, implement using the rgb(215,119,87) orange from
`.claude/claude-code-architecture/07-SPINNER-ANIMATION.md`

---

## ══ LAYER 8: HISTORY / AUTOCOMPLETE ═════════════════════

Reference: `.claude/claude-code-architecture/08-HISTORY-AUTOCOMPLETE.md`

```
CHECK:
→ JSONL format at ~/.helix/history.jsonl?
→ File locking (stale 10s, retries 3)?
→ Large content (>1024 chars) stored by SHA256 hash ref?
→ No duplicate consecutive entries?
→ Up/Down arrow navigation?
→ Index resets on new input?
→ Ctrl+R fuzzy search?
→ Tab completion via compgen?
  Variables ($) → compgen -v
  First token → compgen -c
  Otherwise → compgen -f
→ Stash (Ctrl+S) with notification?
→ sessionId + projectPath in entries?
```

Missing file locking → always 🟠 HIGH (multi-instance corruption risk).

---

## ══ LAYER 9: THEMING ═════════════════════════════════════

Reference: `.claude/claude-code-architecture/09-THEMING.md`

```
CHECK:
→ COLORTERM env var checked (truecolor/24bit)?
→ TERM env var checked (*256color fallback)?
→ NO_COLOR env var respected?
→ ANSI fallback for every TrueColor value?
→ HelixMind brand colors as named constants?
  Not hardcoded hex strings scattered in code
→ Bold / dim / italic / underline ANSI codes available?
→ Every color function resets: \x1b[0m at end?
→ Width calculation strips ANSI escape codes?
```

---

## ══ FIX EXECUTION ═══════════════════════════════════════

After all 9 layers audited:

Order: 🔴 → 🟠 → 🟡 → 🔵 → ⚡ PERFORMANCE

For each fix:
1. Show current code (file + line) or "not present"
2. Show complete replacement — production-ready, no stubs
3. Note cross-layer dependencies
4. Performance fixes: state TRADEOFF explicitly

---

## ══ FINAL REPORT ════════════════════════════════════════

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HX-CLI ARCHITECTURE REPORT · HelixMind CLI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 EXECUTIVE SUMMARY
[What the CLI was before. What was implemented. What it's like now.
 Which layers were already good. Biggest improvements.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  LAYER                  STATUS     GAPS   FIXED
  ─────────────────────────────────────────────────
  1 · Input Pipeline     [✅/⚠️/❌]   [X]    [X]
  2 · Paste Handling     [✅/⚠️/❌]   [X]    [X]
  3 · Text Input         [✅/⚠️/❌]   [X]    [X]
  4 · Rendering          [✅/⚠️/❌]   [X]    [X]
  5 · Undo / Rewind      [✅/⚠️/❌]   [X]    [X]
  6 · Keybindings        [✅/⚠️/❌]   [X]    [X]
  7 · Animation          [✅/⚠️/❌]   [X]    [X]
  8 · History            [✅/⚠️/❌]   [X]    [X]
  9 · Theming            [✅/⚠️/❌]   [X]    [X]
  ─────────────────────────────────────────────────
  TOTAL                             [X]    [X]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  RESULT:  ✅ CLI AT CLAUDE CODE STANDARD
           ⚠️  CONDITIONAL — [N] items deferred
           ❌ GAPS REMAIN — [N] critical layers incomplete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEFERRED / NEXT SPRINT:
  [P1] item · layer
  [P2] item · layer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Signed: HX-CLI — Claude Code Architecture Edition
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## HARD RULES

- Read all 11 files in .claude/claude-code-architecture/ BEFORE auditing
- Every finding references exact file + section from those docs
- No fix applied without complete production-ready implementation
- Bracketed Paste missing → always 🔴 CRITICAL
- Double-Buffer missing → always 🟠 HIGH
- File locking on history → always 🟠 HIGH
- Intl.Segmenter missing → always 🟠 HIGH
- Performance fixes: TRADEOFF must be NONE or MINOR
- Result is always ✅ / ⚠️ / ❌ — never "mostly done"
