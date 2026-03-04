# /sovereign-status — Current Audit State

Triggered by: `/sovereign-status`

Print the current state of all findings in a clean dashboard.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOVEREIGN · AUDIT STATUS DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROJECT: [name]   PHASE: [current phase]   PASS: [N of 3]

OPEN FINDINGS
  🔴 CRITICAL  [X]  ──────────────────────────
  [ZONE-###] · file.ts:42 · SQL injection in user search
  [ZONE-###] · auth.ts:18 · Auth bypass via header override

  🟠 HIGH  [X]  ──────────────────────────────
  [ZONE-###] · api.ts:91 · IDOR on /api/orders/:id

  🟡 MEDIUM  [X]  ────────────────────────────
  ...

  🔵 LOW + ⚪ IMPROVEMENT  [X]  ───────────────
  ...

PENDING VERIFICATION  [X findings]
  [CLAIM-IDs listed]

IN PROGRESS  [X findings]
  [CLAIM-IDs listed]

COMPLETED THIS SESSION
  ✅ Fixed:         [X]
  ❎ False Positive: [X]
  ⚠️  Partial:       [X]
  🚩 Manual Review: [X]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT RECOMMENDED ACTION: [specific command or action]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

# /sovereign-fix — Apply Fix for Specific Finding

Triggered by: `/sovereign-fix [CLAIM-ID]`
Example: `/sovereign-fix AUTH-003`

1. Load the finding for [CLAIM-ID] from the audit report
2. Confirm it has CLAIM-VERIFICATION-STATUS: CONFIRMED or CONFIRMED-MODIFIED
   If not confirmed: refuse and explain that verification must happen first
3. Apply the proposed fix exactly as specified
4. Run Claim Verifier check on the applied fix
5. Output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOVEREIGN · FIX APPLIED · [CLAIM-ID]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PLAIN ENGLISH
[One sentence: what was wrong, what was done to fix it.]

DIFF:
--- BEFORE
[old code]
+++ AFTER
[new code]

SIDE EFFECTS: [none / description]
FIX-VERIFICATION: [FIX-COMPLETE / FIX-PARTIAL / FIX-INTRODUCED-NEW-ISSUE]

⏭ NEXT: [next open finding to fix, or run /sovereign-status]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

# /sovereign-zone — Audit a Single Zone

Triggered by: `/sovereign-zone [zone-name]`
Example: `/sovereign-zone AUTH`

Runs the full Phase 1 audit (all agents) on the specified zone only.
Follows the same finding format, claim verification, and checkpoint output
as the full `/sovereign-audit` — scoped to this zone alone.

Useful for:
- Auditing a zone after significant changes
- Spot-checking before a PR merge
- Investigating a specific suspected area
