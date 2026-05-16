---
description: Diff .env.example vs local env files vs Vercel env. Catches missing, undocumented, leaked, or production-only env vars. Reads keys only — never prints values.
allowed-tools: [Bash, Read]
argument-hint: "[--vercel] [--env preview|production|development|all]  (default --env all when --vercel)"
---

# pb-env-check

Compare environment-variable surfaces:

- **example** — `.env.example` (or `env.example` / `.env.sample`) — the documented contract.
- **local** — `.env.local` / `.env.development.local` / `.env` — what your machine actually uses.
- **vercel** (with `--vercel`) — what production reads.

Output is a drift report. Keys only, never values. Leaks in `.env.example` are flagged separately as the headline.

## Steps

### 1. Locate files

```bash
EXAMPLE=""
for f in .env.example env.example .env.sample; do [ -f "$f" ] && EXAMPLE="$f" && break; done
LOCAL=""
for f in .env.local .env.development.local .env; do [ -f "$f" ] && LOCAL="$f" && break; done
```

Missing `$EXAMPLE` is itself a finding. Suggest creating one and stop further drift checks — there's nothing to diff against.

### 2. Extract keys

```bash
keys() { grep -E '^[A-Z][A-Z0-9_]*=' "$1" 2>/dev/null | cut -d= -f1 | sort -u; }
EX_KEYS=$(keys "$EXAMPLE")
LOC_KEYS=$([ -n "$LOCAL" ] && keys "$LOCAL" || echo "")
```

The `^[A-Z]` anchor skips comments and blanks. Quoted multi-line values are out of scope — flag them as a finding rather than parsing them.

### 3. Vercel keys (`--vercel` only)

```bash
command -v vercel >/dev/null || { echo "pb-env-check: vercel CLI not installed"; exit 1; }
[ -d .vercel ] || { echo "pb-env-check: repo not linked. Run 'vercel link' first."; exit 1; }

vercel_keys() {
  vercel env ls "$1" 2>/dev/null | awk 'NR>2 && $1 ~ /^[A-Z][A-Z0-9_]*$/ {print $1}' | sort -u
}
PROD_KEYS=$(vercel_keys production)
PREV_KEYS=$(vercel_keys preview)
DEV_KEYS=$(vercel_keys development)
```

Honor `--env <name>` to limit which environment is queried. `--env all` is default when `--vercel` is on.

### 4. Diff

Compute each set with `comm`:

- `missing-locally`     — in example, not in local. Will break dev.
- `undocumented-local`  — in local, not in example. Add to example or remove from local.
- `missing-in-prod`     — in example, not in Vercel prod. Will break deploy.
- `missing-in-preview`  — in example, not in Vercel preview. Preview builds will break.
- `prod-only`           — in Vercel prod, not in example, not in local. Possibly dead, possibly stealth.
- `local-not-prod`      — in local, not in Vercel prod. Works in dev, breaks live.

```bash
comm -23 <(echo "$EX_KEYS") <(echo "$LOC_KEYS")   # missing-locally
comm -13 <(echo "$EX_KEYS") <(echo "$LOC_KEYS")   # undocumented-local
```

### 5. Leak scan on example

`.env.example` should hold placeholders, not real secrets. Scan:

```bash
grep -nE 'sk_live_[A-Za-z0-9]+|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|whsec_[A-Za-z0-9]{20,}|xox[bps]-[A-Za-z0-9-]{20,}|-----BEGIN.+PRIVATE KEY' "$EXAMPLE" 2>/dev/null
```

Any match is a finding. Print `path:line  KEY=<redacted>` — never the literal value.

### 6. Report

```
pb-env-check: <repo>
  example: <path>     (N keys)
  local:   <path|none>(M keys)
  vercel:  prod=K  preview=K  dev=K  (or "not checked")

Drift:
  missing-locally:        K1, K2, ...
  undocumented-local:     K3, K4, ...
  missing-in-prod:        K5, ...
  missing-in-preview:     ...
  prod-only:              ...
  local-not-prod:         ...

Leaks in example:
  <path:line>  <KEY>=<redacted>

Status: <clean | N findings>
```

Empty drift categories: omit the line. If only leaks: that's the headline regardless of drift.

Do not auto-fix. Adding or removing env vars is a deliberate decision per environment; pb-env-check reports, the human decides.

## Out of scope (v1)

- Multi-framework conventions beyond Next.js (`.env.local`). If your project uses `.env.development`, pass `--env-file <path>` (not yet implemented — out for v1).
- Value-level checks (does the URL parse, does the key reach the right service). That's pb-deploy-verify territory.
- Cross-platform secret managers (Doppler, 1Password). Add when the workflow demands it.
