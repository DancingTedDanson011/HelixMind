# /sovereign-security — Security-Only Deep Dive

Triggered by: `/sovereign-security`
Optional: `/sovereign-security [zone]` to target a specific zone

This command runs the Security Agent in isolation with maximum depth.
No functionality or quality checks. Pure attack surface analysis.

---

## EXECUTION

### Step 1 — Scope Definition

If a zone was specified: focus exclusively on that zone's files.
If no zone specified: run against all zones with a trust boundary or data entry point.

Print scope before starting:
```
SOVEREIGN SECURITY SCAN · SCOPE: [zones / files]
Entry points identified: [list]
Trust boundaries identified: [list]
Starting attack surface analysis...
```

---

### Step 2 — Attack Surface Mapping

Before reasoning about individual vulnerabilities, map the full attack surface:

```
ATTACK SURFACE MAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
External Entry Points:
  [HTTP endpoints, file uploads, webhooks, env inputs, CLI args]

Trust Boundary Crossings:
  [Points where privilege level or trust assumption changes]

Data Sinks (where input lands):
  [SQL, shell, HTML render, file system, external API, redirect]

Inter-Service Communication:
  [Internal API calls, message queues, background jobs]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Step 3 — Reasoning-Based Vulnerability Analysis

For every entry point identified:

**TRACE THE DATA:**
```
Input: [what it is, where it comes from]
→ Validation at boundary? [YES / NO / PARTIAL — describe]
→ Transformations: [list each transformation applied]
→ Final landing point: [SQL / shell / HTML / file / redirect / API]
→ At landing: [escaped / parameterized / sanitized / RAW]
→ Verdict: [SAFE / POTENTIALLY VULNERABLE / VULNERABLE]
```

**ANALYZE TRUST:**
```
→ Auth checked before this operation? [YES / NO / ASSUMED]
→ Authorization checked? [YES / NO / ASSUMED]
→ IDOR possible? [YES / NO — explain]
→ Privilege escalation path? [YES / NO — explain]
```

**REASON ABOUT LOGIC:**
```
→ Can the operation sequence be abused?
→ Race conditions possible?
→ Edge cases exploitable? (negative values, zero, max int, empty string)
→ Second-order effects? (stored safely, used dangerously later)
```

---

### Step 4 — Finding Output

Use the standard finding format from CLAUDE.md.
All security findings require:
- Full attack path traced in TECHNICAL DETAIL
- WHY SCANNERS MISS THIS section
- CONFIDENCE rating with justification

---

### Step 5 — Claim Verification

Every finding goes through the Claim Verifier before the final report.
Re-trace each attack path independently.
Adjust confidence ratings where needed.

---

### Step 6 — Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOVEREIGN · SECURITY SCAN COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PLAIN ENGLISH SUMMARY
[What the attack surface looks like. What was found. Biggest real risk.
 Written so a non-technical founder understands what's at stake.]

📊 Entry Points Scanned: X
   Confirmed Vulnerabilities: X  (Critical: X · High: X · Medium: X · Low: X)
   False Positives Removed: X
   Open Attack Paths: X at HIGH confidence · X at MEDIUM · X at LOW

[All confirmed findings in finding format]

⏭ TO FIX: Run /sovereign-fix [CLAIM-ID] for individual fixes
         or /sovereign-audit to run the full fix + re-audit pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
