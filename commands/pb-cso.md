---
description: Pre-launch security audit. OWASP Top 10 + STRIDE walkthrough tailored to the detected stack. High confidence gate, concrete exploit scenarios, no noise.
allowed-tools: [Bash, Read, Edit, Grep, Glob]
argument-hint: "[--diff]  scope to current diff vs origin/main; omit for full-repo audit"
---

# pb-cso

Pre-launch security audit. The goal is exploitable findings, not lint output. Every BLOCKER must include a concrete attack path — if you cannot describe how an attacker uses it, downgrade or drop it.

Same severity model as the rest of the suite: BLOCKER / IMPORTANT / NIT. BLOCKER fixes are listed; do not auto-edit security-critical paths without the user's explicit go-ahead.

## Steps

### 1. Stack detection

Read enough to know what this app actually does:

- `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` for stack
- Framework (Next.js, Django, Rails, FastAPI, etc.)
- Auth model (Supabase, Clerk, Auth.js, custom, none)
- Database (Postgres, SQLite, none)
- Hosting (Vercel, Fly, self-hosted)
- External integrations (Stripe, OpenAI, S3, webhooks)

Skip categories that don't apply. A pure CLI tool doesn't need an XSS pass.

### 2. Determine scope

Default: full-repo audit. With `--diff`, scope to the diff:

```bash
if [ "$ARGUMENTS" = "--diff" ]; then
  source "$HOME/.claude/commands/pb-bootstrap.sh"
  source "$PB_SUITE/scripts/lib/scope.sh"
  echo "SCOPE: diff vs $BASE"
else
  echo "SCOPE: full repo"
fi
```

### 3. Attack surface census

Map entry points:

- HTTP routes — list every endpoint, note auth requirement and input shape
- Server actions / RPCs / GraphQL resolvers
- Webhooks (Stripe, GitHub, etc.) — each is an unauthenticated public endpoint
- File uploads, signed URLs
- CLI/script entry points run with elevated privileges
- Cron / scheduled functions
- Public-by-default surfaces — middleware bypass paths, `/_health`, `/api/internal/*`

For each, note: who can reach it, what input it accepts, what it returns.

### 4. Secrets hygiene

```bash
# History scan (whole repo audit only)
git log --all --pretty=format: --name-only --diff-filter=A 2>/dev/null | grep -E '\.env(\..+)?$|secrets\.|credentials\.' | sort -u
# Live tree
git ls-files | grep -E '\.env(\..+)?$' | xargs -I{} grep -l -E 'sk_live|sk_test|whsec_|AKIA|ghp_|github_pat_' {} 2>/dev/null
grep -rEn 'sk_live_[A-Za-z0-9]+|ghp_[A-Za-z0-9]+|AKIA[A-Z0-9]{16}|whsec_[A-Za-z0-9]+|-----BEGIN.+PRIVATE KEY' --include='*.{ts,tsx,js,jsx,py,go,rb,env,yml,yaml,json,md}' . 2>/dev/null | head -50
```

Also check: are example envs committed (`.env.example` good, `.env.local` bad)? Are secrets logged in error paths?

### 5. Dependency audit

Run the stack's own auditor:

```bash
[ -f package-lock.json ] && npm audit --omit=dev 2>&1 | tail -20
[ -f bun.lock ] && bun audit 2>&1 | tail -20
[ -f pnpm-lock.yaml ] && pnpm audit 2>&1 | tail -20
[ -f requirements.txt ] && pip-audit 2>&1 | tail -20 || true
[ -f Cargo.lock ] && cargo audit 2>&1 | tail -20 || true
```

Filter to high/critical with a known exploit path. A transitive CVE in a dev-only test runner is not a BLOCKER for a pre-launch web app.

### 6. OWASP Top 10 walkthrough

Tailor to the detected stack. Skip categories that don't apply.

- **A01 Broken Access Control** — every authenticated route enforces auth (middleware, decorator, or in-handler check)? Are user-id-bearing inputs verified against the session subject (no `req.body.userId` trust)? IDOR on REST collections (`/users/:id`)?
- **A02 Cryptographic Failures** — passwords hashed (bcrypt/argon2, not md5/sha1)? TLS enforced everywhere? Sensitive data at rest encrypted?
- **A03 Injection** — SQL parameterized everywhere (no string concat into `query()`)? NoSQL operator injection (`$gt`, `$ne` from user input)? Command injection in shell calls? Template injection? LDAP/XPath/header injection where applicable?
- **A04 Insecure Design** — rate limiting on auth and payment endpoints? Account-enumeration via login error messages or password-reset response timing? Idempotency on payment webhooks?
- **A05 Security Misconfiguration** — verbose stack traces in production? Default credentials? CORS too permissive (`*` with credentials)? Missing security headers (CSP, HSTS, X-Frame-Options)?
- **A06 Vulnerable Components** — already done in step 5; here, flag dependencies whose CVE matches a path that is actually reachable.
- **A07 Auth Failures** — session fixation, missing rotation on privilege change, predictable session IDs, unsalted password reset tokens? MFA missing on sensitive operations?
- **A08 Integrity Failures** — webhook signatures verified before any side effect? Unsigned binary downloads in CI? Server-side input integrity (replay, tampering)?
- **A09 Logging Failures** — auth failures logged? PII in logs (BAD)? Webhook failures alerted?
- **A10 SSRF** — any code that fetches a URL the user controls? `fetch(req.body.url)`, image-proxy, webhook callback registration without allowlisting?

### 7. STRIDE on critical assets

For each critical asset (auth store, payment flow, primary database, file storage):

- **Spoofing** — can someone impersonate a legitimate principal?
- **Tampering** — can someone modify data in transit or at rest?
- **Repudiation** — can someone deny an action without evidence?
- **Information disclosure** — what leaks? (timing, error messages, side channels)
- **Denial of service** — what runs unbounded? (regex, file size, recursion, query)
- **Elevation of privilege** — what path moves a low-privilege actor up?

One sentence per asset per category, only where it bites. Three assets × six categories is enough. Don't fill the matrix for completeness.

### 8. Filter and categorize

Confidence gate: a finding stays only if you can describe how an attacker exploits it in two sentences. If you cannot, downgrade.

- **BLOCKER** — exploitable, clear path to compromise (RCE, auth bypass, credential leak, SQLi reaching production data, payment bypass, SSRF reaching internal IPs). Must include a concrete exploit scenario.
- **IMPORTANT** — likely issue requiring context: missing rate limit on a sensitive endpoint, weak crypto on a non-critical asset, dependency CVE on a reachable path with no exploit yet seen in the wild.
- **NIT** — defense in depth, hardening: missing security header on an internal route, verbose logging that could leak in some configurations, low-impact misconfiguration.

Never auto-fix in this command. Security fixes need explicit user approval and often a follow-up review.

### 9. Report

```
pb-cso: N findings — X BLOCKER, Y IMPORTANT, Z NIT
Stack: <one line>
Scope: <full repo | diff vs <base>>
Attack surface: <route count, webhook count, public endpoints>

Findings:

[BLOCKER] <Title>
  Where:    <file:line or path>
  Issue:    <one sentence>
  Exploit:  <how an attacker uses this — concrete>
  Fix:      <what to change, no code unless trivial>

[IMPORTANT] ...
[NIT] ...

Open questions: <anything you couldn't verify without the user>
```

End with: which BLOCKERS to fix now? `pb-investigate` is a good follow-up if root cause is unclear; `pb-review` for the diff that lands the fix.
