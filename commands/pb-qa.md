---
description: Runtime QA — visit routes via headless Chromium, capture console errors, network failures, broken images. Per-route screenshots. Read-only, no code edits.
allowed-tools: [Bash, Read]
argument-hint: "<baseUrl> [--routes a,b,c] [--max N] [--full-page-screenshots] [--no-screenshots] [--storage-state path]"
---

# pb-qa

Runtime QA. Open a real browser against a running URL — localhost dev server, Vercel preview, or production — visit key routes, and capture what breaks. Console errors, page exceptions, HTTP failures, broken images. Per-route screenshots for visual evidence.

Does not edit code. For root cause: `pb-investigate`. For pre-merge gate: `pb-review` + `pb-ship`.

## Steps

### 1. Resolve target

Get the base URL from `$ARGUMENTS`. If none: stop and ask. Do not guess `localhost:3000` — different projects use different ports.

If the URL is unreachable, surface that and stop. Do not pretend to QA an offline target.

**Protected Vercel previews.** A preview URL behind Deployment Protection redirects to a Vercel login and every route reads as the login page (or a 401/307). To QA through it, set the project's Protection Bypass for Automation secret in the env before running — `qa.ts` sends it as the `x-vercel-protection-bypass` header (never in the URL, so it stays out of logs):

```bash
export VERCEL_AUTOMATION_BYPASS_SECRET=$(security find-generic-password -s cil-pixelbrew -a vercel-bypass-<project> -w)
```

The secret lives in the macOS Keychain (service `cil-pixelbrew`, account `vercel-bypass-<project>`), created once in Vercel → Project Settings → Deployment Protection → Protection Bypass for Automation. Without it, a protected preview yields only login pages, not real QA. This bypass clears the Vercel wall only; an app's own login (Supabase, etc.) still needs `--storage-state`.

**Anchor navs vs routes.** When discovery finds few routes, do not guess route paths from nav labels and treat their 404s as bugs — single-page navs link to on-page anchors (`#pricing`), not routes (`/pricing`), so guessed paths 404 for a benign reason. Extract the actual hydrated `<a href>` set first (or use `--routes` only with paths you have confirmed exist).

### 2. Resolve the script

```bash
source "$HOME/.claude/commands/pb-bootstrap.sh"
PB_SCRIPT="$PB_SUITE/scripts/qa.ts"
[ -f "$PB_SCRIPT" ] || { echo "pb-qa: script not found, run $PB_SUITE/install"; exit 1; }
```

### 3. Run

```bash
bun "$PB_SCRIPT" $ARGUMENTS
```

The script:
- Visits the base URL, auto-discovers internal `<a href>` routes (up to `--max`, default 10)
- For each route: `goto` with `networkidle`, attaches console + pageerror listeners, captures broken images, screenshots
- Returns JSON: `{ baseUrl, routesChecked, totals: {blocker, important, nit}, routes: [...] }`

Override discovery with `--routes /a,/b,/c` if you know which routes matter. Useful when nav is JS-only and discovery returns nothing.

For auth-gated apps: `--storage-state /path/to/state.json` (Playwright's storageState format — same as e2e-from-pr uses). Without it, you only see public routes.

### 4. Severity rules (already applied in the script)

- **BLOCKER** — page-error (uncaught exception), hydration error, 5xx HTTP, `cannot read` / `undefined is not` console errors
- **IMPORTANT** — console errors (non-blocker), broken images on visible content, 4xx HTTP (except 401/403 on auth-gated routes)
- **NIT** — console warnings, 401/403 (expected on protected routes when unauthenticated), favicon/sourcemap 404s

The classifier is in `scripts/qa.ts`. Edit there if your project has noise that should be downgraded.

### 5. Report

Parse the JSON and present:

```
pb-qa: <baseUrl>
Routes checked: N
Findings: X BLOCKER, Y IMPORTANT, Z NIT

[BLOCKER]
  /forecast  — uncaught TypeError: Cannot read properties of undefined (reading 'wind')
    evidence: .pb-qa/<host>-<ts>/_forecast.png

[IMPORTANT]
  /spots/zeebrugge  — 4 broken images (data-source thumbnails)
    evidence: .pb-qa/<host>-<ts>/_spots_zeebrugge.png

[NIT]
  /api/feature-flags  — 401 (expected, auth-gated)
```

For each BLOCKER include the route, the error summary, and the screenshot path. Bundle similar findings across routes (e.g. "5 routes show the same hydration error" → one entry, list the routes).

End with: which BLOCKER to investigate first? Suggest `pb-investigate <symptom>` for the top one.

### 6. Limits

- No interaction — pb-qa doesn't click, fill forms, or scroll. It visits and observes. For multi-step flows, write a Playwright spec via `e2e-from-pr`.
- No auto-fix — by design. Findings are evidence, not edits.
- Discovery is shallow — only follows `<a href>` on the first page. SPAs with route-based code-splitting may need explicit `--routes`.
- Screenshots can be heavy — `--no-screenshots` for a fast scan, `--full-page-screenshots` for the full body of each route (default is viewport only).
