---
description: Fetch a URL and return its main content as clean markdown. Static pages via WebFetch (fast), SPAs via Playwright (when WebFetch returns thin content). Optional screenshot.
allowed-tools: [WebFetch, Bash, Read, mcp__plugin_playwright_playwright__browser_navigate, mcp__plugin_playwright_playwright__browser_snapshot, mcp__plugin_playwright_playwright__browser_take_screenshot, mcp__plugin_playwright_playwright__browser_close]
argument-hint: "<url> [-s|--screenshot] [--raw] [--full]"
---

# pb-browse

Read a URL and return its main content as clean markdown. Static pages go through `WebFetch` (fast, no browser). Single-page apps fall back to Playwright when the fetch returns thin content. Screenshot is opt-in.

Replaces gstack's heavyweight `/browse` for the routine URL-to-markdown case. Use the gstack version when you need full Chrome connectivity, anti-bot handling, or headed-mode interaction — that is not this command's job.

## Steps

### 1. Parse arguments

```
URL          = first non-flag token in $ARGUMENTS
SCREENSHOT   = --screenshot or -s present
RAW          = --raw present (skip cleaning, return as fetched)
FULL         = --full present (skip output truncation)
```

If no URL: stop and ask for one. Do not fabricate.

### 2. Fast path — WebFetch

Use the `WebFetch` tool on the URL with a prompt like:

> "Return the main article or content of this page as markdown. Strip nav, header, footer, cookie banners, ads, related-article rails, and comment sections. Preserve headings, lists, code blocks, and inline links."

Expect either useful markdown, or a near-empty result (page renders content via JS).

**Heuristics for "thin"** — fall back to Playwright if any of:

- Content length under 500 chars and the URL is not obviously a redirect/error page
- Content is dominated by `<script>`-source mentions or boilerplate ("you need JavaScript", "loading...")
- Page is a known SPA framework signature in the response (`__next_data__`, `data-reactroot`, `data-svelte-h`, Vue mount nodes) and the rendered text is sparse

If WebFetch succeeded and content looks complete: skip step 3.

### 3. Slow path — Playwright

Trigger only when WebFetch returned thin content. Use the Playwright MCP tools (loaded via `ToolSearch` if not already available):

```
1. mcp__plugin_playwright_playwright__browser_navigate  → URL
2. wait for network idle / domcontentloaded (the tool handles this; if it returns too early, wait_for a stable selector)
3. mcp__plugin_playwright_playwright__browser_snapshot  → accessibility tree
4. Extract main content from the snapshot, convert to markdown
5. mcp__plugin_playwright_playwright__browser_close
```

Use the accessibility snapshot (not raw HTML) for cleaner extraction. Strip the same chrome you would in step 2.

### 4. Optional screenshot

If `SCREENSHOT` is set, after content extraction:

```
mcp__plugin_playwright_playwright__browser_take_screenshot
  → save to .pb-browse/<hostname>-<slug>-<timestamp>.png (gitignored)
```

If the URL is on the public internet and the page has a paywall, a CAPTCHA, or a login redirect: stop and report what was reached. Don't pretend the screenshot represents the requested page.

### 5. Clean and truncate

Unless `RAW` is set, post-process:

- Drop "Subscribe to our newsletter", cookie-consent text, "Share this article", "Related posts" sections
- Collapse runs of empty lines to one
- Resolve relative links to absolute against the URL's origin
- Keep code blocks intact

Unless `FULL` is set, truncate body content over 8000 characters:

```
[first 6000 chars]

... <truncated, N chars omitted, run with --full to see all> ...

[last 1000 chars]
```

### 6. Output

```
URL:        <final URL after redirects>
Title:      <page title>
Source:     webfetch | playwright
Length:     N chars (truncated: yes/no)
Screenshot: <path | none>

---

<markdown body>
```

Don't repeat the URL in prose, don't add commentary about the page's content unless asked. The user has the source and can read it; your job is faithful extraction, not summarization.

If the page is in a language other than the project's working language, return the original. Translation is a separate step.
