# /sovereign-audit — Full Codebase Audit

Triggered by: `/sovereign-audit`

Execute the following phases in strict sequence.
Print a checkpoint summary after each phase before proceeding.
Never skip a phase. Never merge phases.

---

## ── PHASE 0: CODEBASE MAPPING ──────────────────────────────────────

**Before touching anything else:**

1. List all files, folders, configs, package manifests, env files, README, docs
2. Infer application PURPOSE: what does this do? Who are the users?
3. Map TRUST BOUNDARIES:
   - Where does external data enter? (HTTP endpoints, file uploads, webhooks, env vars, CLI args)
   - Where do privilege levels change? (auth middleware, role checks, admin routes)
   - Where does data leave? (DB writes, external API calls, rendered HTML, file writes)
4. Map DATA FLOWS: for each entry point, trace the path through processing to storage/output
5. Populate the ZONE REGISTRY from CLAUDE.md with actual paths from this codebase
6. Rank zones by risk (CRITICAL / HIGH / MEDIUM / LOW)

**Checkpoint output — Phase 0:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOVEREIGN · PHASE 0 COMPLETE · CODEBASE MAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PLAIN ENGLISH SUMMARY
[What the app does. Who uses it. What the biggest risk areas appear to be at a glance.]

📊 ZONES IDENTIFIED: X  |  HIGH RISK: X  |  ENTRY POINTS: X  |  TRUST BOUNDARIES: X

[Populated Zone Registry]
[Data flow map]

⏭ NEXT STEP: Beginning Phase 1 — Zone-by-zone audit, starting with [highest risk zone]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ── PHASE 1: ZONE-BY-ZONE AUDIT ────────────────────────────────────

Process one zone at a time. Complete each zone fully before moving to the next.
Order: highest risk zone first.

### For each zone, deploy the appropriate specialist agents:

---

#### STANDARD BUG AGENT (all zones)
Find:
- Crashes, race conditions, unhandled edge cases
- Missing error handling, missing input validation
- Memory leaks, N+1 queries, blocking operations that should be async
- Dead code, unused imports, deprecated dependencies

---

#### SECURITY AGENT — REASONING-BASED (AUTH, API, DB, FRONTEND, INFRA, DATA-FLOWS)

This agent DOES NOT use checklists.
It reasons about code behavior the way an attacker would.

**Mandatory reasoning steps:**

STEP 1 — TRACE THE DATA
```
For every user-controlled input in this zone:
→ Where does it enter? (parameter, header, body, file, env)
→ Is it validated at the boundary, or assumed safe downstream?
→ What transformations does it go through?
→ Where does it land? (SQL query, shell exec, HTML render, file path, redirect, API call)
→ At each landing point: is the data escaped, parameterized, or raw?
```

STEP 2 — ANALYZE TRUST BOUNDARIES
```
→ Where does this zone assume a caller is authenticated/authorized without checking?
→ Are there IDOR risks? (user-controlled IDs, can user A reach user B's data?)
→ Are there privilege escalation paths?
→ Are webhooks, callbacks, or async operations validated?
```

STEP 3 — REASON ABOUT BUSINESS LOGIC
```
→ Can the sequence of operations be abused? (skip steps, replay actions, negative values)
→ Are there race conditions in state transitions?
→ Can edge cases in business rules be exploited?
→ Are there second-order effects? (data stored safely, used dangerously later)
```

STEP 4 — FIND WHAT PATTERN SCANNERS MISS
```
Specifically look for:
- Broken access control in multi-tenant logic
- Auth bypass via parameter pollution or HTTP verb override
- SSRF through indirect URL handling
- Insecure deserialization through seemingly innocent endpoints
- TOCTOU races in file operations or state checks
- Cryptographic misuse (correct primitives, wrong composition)
- DNS rebinding vulnerabilities in local server logic
- Supply chain risks in how dependencies are used (not just what versions)
```

---

#### FUNCTIONALITY AGENT (BUSINESS-LOGIC, UX-FLOWS, FEATURES)
Find:
- Features described/implied in the UI but not implemented end-to-end
- Half-finished routes (handler exists, logic missing)
- Broken user flows (submit button → nothing happens)
- Silent failures (error occurs, user sees nothing)
- Missing edge case handling (empty state, 0 results, max limit, null data)
- Missing loading/pending states

---

#### MISSING FEATURES AGENT (FEATURES zone)
Think like a senior PM:
- What would any real user expect that isn't here?
- What security-adjacent features are absent? (rate limiting, email verification, session expiry)
- What operational features are missing? (logging, audit trail, admin panel, data export)
- What would block a real production deployment?

---

#### SUBOPTIMAL IMPLEMENTATION AGENT (ARCHITECTURE zone)
Find things that work but shouldn't ship as-is:
- Logic that solves the right problem the wrong way
- Hardcoded values that belong in config/env
- Copy-pasted blocks that should be abstracted
- Wrong data structure for the use case
- API design choices that will cause breaking changes
- State management that won't scale
- Missing pagination, caching, or debouncing where obviously needed

---

### FINDING FORMAT (all agents, every finding):

```
┌─────────────────────────────────────────────────────────────────┐
│ [🔴/🟠/🟡/🔵/⚪] [TYPE] · CLAIM-ID: [ZONE-###]
├─────────────────────────────────────────────────────────────────┤
│ FILE: path/to/file.ts · Line: X–Y
│ CONFIDENCE: [✅/⚠️/❓] (security findings only)
├─────────────────────────────────────────────────────────────────┤
│ PLAIN ENGLISH:
│ [1–2 sentences. What is wrong and why it matters.
│  A non-technical person should understand the risk.]
│
│ TECHNICAL DETAIL:
│ [Exact code reference. Attack path or failure mode traced step by step.]
│
│ WHY SCANNERS MISS THIS: (security only)
│ [Why rule-based tools don't catch this.]
│
│ EVIDENCE:
│ [Exact code snippet from the file proving the issue exists.]
│
│ PROPOSED FIX:
│ [Exact code change or step-by-step instruction.]
├─────────────────────────────────────────────────────────────────┤
│ CLAIM-VERIFICATION-STATUS: UNVERIFIED
│ STATUS: PENDING
└─────────────────────────────────────────────────────────────────┘
```

**Zone checkpoint output after each zone:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOVEREIGN · PHASE 1 CHECKPOINT · ZONE: [name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PLAIN ENGLISH SUMMARY
[What was audited. What was found. Biggest risk in plain language.]

📊 Found: X  |  Critical: X  |  High: X  |  Medium: X  |  Low: X  |  Improvements: X

[All findings for this zone in finding format above]

⏭ NEXT STEP: Moving to next zone — [name] · or · All zones complete — beginning Phase 1.5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ── PHASE 1.5: CLAIM VERIFICATION ──────────────────────────────────

**HARD RULE: No fix is applied until this phase is complete for that finding.**

Deploy the CLAIM VERIFIER AGENT for every finding in the Master Audit Report.

### CLAIM VERIFIER AGENT

For each finding, in order:

```
1. LOCATE: Open exact file + line. Does the code exist exactly as described?
2. REPRODUCE: Trace execution path independently. Does the issue actually manifest?
3. SECURITY FINDINGS: Re-trace the full attack path from scratch.
   - Can user-controlled input actually reach the vulnerable point?
   - Is there a mitigation elsewhere (middleware, wrapper, framework default) the agent missed?
   - Is the confidence rating accurate? Adjust if needed.
4. NON-SECURITY FINDINGS: Confirm the broken/missing behavior is real, not already handled elsewhere.
5. CONFLICT CHECK: Does this contradict another finding? Flag and freeze if so.
```

**Verdict format per claim:**
```
┌─────────────────────────────────────────────────────────────────┐
│ CLAIM VERIFIER · CLAIM-ID: [ZONE-###]
├─────────────────────────────────────────────────────────────────┤
│ VERDICT: [CONFIRMED / CONFIRMED-MODIFIED / FALSE-POSITIVE /
│           CONFLICT / NEEDS-CONTEXT]
│
│ VERIFIER EVIDENCE:
│ [What the verifier found when checking independently.
│  Specific file + line + reasoning.]
│
│ ADJUSTMENTS (if CONFIRMED-MODIFIED):
│ [What changed: severity, confidence, description, scope]
│
│ ADJUSTED CONFIDENCE: [✅/⚠️/❓] (security only)
├─────────────────────────────────────────────────────────────────┤
│ CLAIM-VERIFICATION-STATUS: [final verdict]
└─────────────────────────────────────────────────────────────────┘
```

**Phase 1.5 checkpoint output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOVEREIGN · PHASE 1.5 COMPLETE · CLAIM VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PLAIN ENGLISH SUMMARY
[What was checked. How many claims held up. How many were false alarms.
 What the real risk picture looks like now.]

📊 Total Claims: X  |  Confirmed: X  |  Modified: X  |  False Positives: X
   Conflicts: X     |  Needs Context: X

PROCEEDING TO FIX: [X confirmed findings, ordered by severity]
FALSE POSITIVE LOG:
  [ZONE-###] — [brief reason it was a false positive]
  ...

⏭ NEXT STEP: Beginning Phase 2 — Fix execution, starting with CRITICAL findings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ── PHASE 2: FIX EXECUTION ──────────────────────────────────────────

Process only CONFIRMED or CONFIRMED-MODIFIED findings.
Order: 🔴 CRITICAL → 🟠 HIGH → 🟡 MEDIUM → 🔵 LOW → ⚪ IMPROVEMENT

**Fix format per finding:**
```
┌─────────────────────────────────────────────────────────────────┐
│ FIX APPLIED · CLAIM-ID: [ZONE-###]
├─────────────────────────────────────────────────────────────────┤
│ PLAIN ENGLISH: [What was changed and why, in one sentence.]
│
│ DIFF:
│ --- BEFORE
│ [old code]
│ +++ AFTER
│ [new code]
│
│ SIDE EFFECTS: [Any cross-zone impact? Any new dependencies introduced?]
│ CROSS-ZONE WARNING: [if applicable]
├─────────────────────────────────────────────────────────────────┤
│ STATUS: FIXED — PENDING VERIFIER SIGN-OFF
└─────────────────────────────────────────────────────────────────┘
```

**Immediately after each fix, Claim Verifier checks:**
```
FIX VERIFICATION · CLAIM-ID: [ZONE-###]
→ Fix applied correctly? [YES / NO]
→ Issue fully resolved? [YES / PARTIAL — reason]
→ New issues introduced? [NONE / YES — description]
→ FIX-VERIFICATION: [FIX-COMPLETE / FIX-PARTIAL / FIX-INTRODUCED-NEW-ISSUE]
```

**Phase 2 checkpoint output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOVEREIGN · PHASE 2 COMPLETE · FIXES APPLIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PLAIN ENGLISH SUMMARY
[What was fixed. Any complications. What still needs attention.]

📊 Fixed: X  |  Partial: X  |  Introduced New Issues: X  |  Deferred: X

⏭ NEXT STEP: Beginning Phase 3 — Re-audit to confirm clean state
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ── PHASE 3: RE-AUDIT LOOP ──────────────────────────────────────────

After all fixes:

1. Re-run all zone agents on all zones
2. Re-run Claim Verifier on all NEW findings
3. Security Agent: re-trace all previously fixed attack paths from scratch
   — did the fix close the path or just mask it?
4. Check if any fix introduced new issues in adjacent zones
5. If new CONFIRMED findings exist → return to Phase 1.5 → Phase 2
6. Loop until clean pass

**LOOP LIMIT:** 3 passes maximum.
After 3 passes with unresolved issues → escalate as MANUAL REVIEW REQUIRED.

**Re-audit checkpoint output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOVEREIGN · PHASE 3 · RE-AUDIT PASS [N of 3]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PLAIN ENGLISH SUMMARY
[What was re-checked. What was found. Are we clean or not?]

📊 Previously Fixed (confirmed closed): X
   New Issues Found This Pass: X
   Partial Fixes Still Open: X
   Escalated to Manual Review: X

[If new issues found: list them in finding format]

⏭ NEXT STEP: [Another pass required — reason] OR [Clean — proceeding to certification]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ── PHASE 4: CERTIFICATION ──────────────────────────────────────────

Issued ONLY when all of the following are true:
- [ ] Zero 🔴 CRITICAL or 🟠 HIGH confirmed findings remain
- [ ] No broken user flows affecting core functionality
- [ ] No half-implemented features in the critical path
- [ ] All FALSE POSITIVE findings documented with explanation
- [ ] All CONFLICTS resolved or explicitly deferred with justification
- [ ] Security Agent confirms no open attack paths at HIGH or MEDIUM confidence
- [ ] Claim Verifier signed off on all applied fixes as FIX-COMPLETE

**Certification output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOVEREIGN AUDIT CERTIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 EXECUTIVE SUMMARY
[5–8 sentences. Written for a non-technical founder, investor, or PM.
 What was audited. What was found and fixed. What the remaining risk is.
 Whether this is ready to ship.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Codebase:            [Project Name]
  Date:                [Date]
  Audit Passes:        [N]

  ─── SECURITY ───────────────────────────────────────
  Attack Paths Traced: [X]
  Vulnerabilities Found / Fixed: [X] / [X]
  False Positives:     [X]
  Open Attack Paths:   [X at LOW confidence — details below]

  ─── QUALITY ────────────────────────────────────────
  Bugs Fixed:          [X]
  Features Added:      [X]
  Flows Repaired:      [X]
  Improvements:        [X applied] / [X deferred]

  ─── CLAIMS ─────────────────────────────────────────
  Total Claims:        [X]
  Confirmed:           [X]
  False Positives:     [X]
  Manual Review Flags: [X]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  RESULT:  ✅ CERTIFIED FOR RELEASE
           ❌ NOT CERTIFIED — [N] BLOCKERS REMAIN
           ⚠️  CONDITIONAL — [N] items deferred, see backlog

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEFERRED BACKLOG (recommended next sprint):
  [P1] CLAIM-ID · description · owner
  [P2] CLAIM-ID · description · owner
  ...

MANUAL REVIEW REQUIRED:
  [CLAIM-ID] · reason it could not be resolved autonomously
  ...

FALSE POSITIVE LOG:
  [CLAIM-ID] · why it was not a real issue
  ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Signed: SOVEREIGN AUDITOR v4.0 — Reasoning-Based Edition
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## HARD RULES

- Reason, never pattern-match. Every security finding traces a real path.
- No fix without Claim Verifier confirmation.
- No certification without Claim Verifier sign-off on all fixes.
- Plain English Summary is mandatory in every phase output.
- Security findings without a traced attack path are LOW confidence by default.
- Partial fixes are not complete. FIX-PARTIAL findings stay in the queue.
- A finding is only DONE at FIX-COMPLETE.
- Certification is mandatory. Every audit ends with PASS, FAIL, or CONDITIONAL.
