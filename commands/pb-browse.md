---
description: Fetch a URL via headless Chromium and return its main content as clean markdown. Self-contained Playwright script in pb-suite — no MCP, no WebFetch dependency. Optional screenshot.
allowed-tools: [Bash, Read]
argument-hint: "<url> [-s|--screenshot [path]] [--raw] [--full] [--timeout secs]"
---

# pb-browse

Read a URL via headless Chromium and return clean markdown. Backed by `pb-suite/scripts/browse.ts` — Bun + Playwright + Turndown, fully under your control. No MCP plugin needed, no WebFetch prompt-tax.

Replaces gstack's heavyweight `/browse` for the routine "lees deze URL" case. Use the gstack version when you need long-lived daemon state, anti-bot routing, headed-mode interaction, CAPTCHA handoff, or file downloads behind auth.

## Steps

### 1. Resolve the script path

Resolve through the symlink so it works regardless of where pb-suite lives:

```bash
PB_CMD="$HOME/.claude/commands/pb-browse.md"
PB_TARGET=$(readlink "$PB_CMD" 2>/dev/null || echo "$PB_CMD")
PB_SUITE=$(dirname "$(dirname "$PB_TARGET")")
PB_SCRIPT="$PB_SUITE/scripts/browse.ts"

if [ ! -f "$PB_SCRIPT" ]; then
  echo "pb-browse: script not found at $PB_SCRIPT — run $PB_SUITE/install"
  exit 1
fi
```

### 2. Run the script

Pass `$ARGUMENTS` straight through. The script handles `--screenshot`, `--raw`, `--full`, `--timeout`, plus the URL positional.

```bash
bun "$PB_SCRIPT" $ARGUMENTS
```

Capture the JSON output. If non-zero exit: surface the stderr message and stop.

### 3. Present the result

Parse the JSON. The relevant fields are `url`, `title`, `content`, `length`, `truncated`, `screenshot`, `elapsed_ms`.

Output to the user in this format:

```
URL:        <final URL after redirects>
Title:      <page title>
Length:     N chars (truncated: yes/no)
Screenshot: <path | none>
Took:       Xms

---

<content>
```

Don't summarize the content unless asked — the user has it and can read it. Your job is faithful extraction, not editorialization. If the page is in a language other than the project's working language, return the original; translation is a separate step.

If truncated, mention `--full` as the way to see the full body.

### 4. Failure modes

- **Network timeout** — script exits non-zero with a Playwright timeout. Stop, report what URL was tried.
- **Auth wall / paywall / CAPTCHA** — the script does not bypass these. The returned content will be the auth-page itself. Surface that honestly rather than pretending the requested page was reached.
- **404 / 410 / 5xx** — the script still extracts content (the error page). Note the status in your report if it's evident from the title or body.
- **Chromium missing** — script fails on first run if `install` has not bootstrapped deps. Tell the user to run `$PB_SUITE/install`.

This command does not handle interactive flows (login, multi-step forms, MFA). For that, escalate to gstack `/browse` with its handoff pattern.
