---
description: Pre-landing review of UI changes. Audits the diff for design quality — hierarchy, spacing, typography, color, accessibility, AI slop. Auto-fixes mechanical issues, asks before taste calls.
allowed-tools: [Bash, Read, Edit, Grep, Glob]
argument-hint: "[url]  optional dev-server URL for live screenshot pass"
---

# pb-design-review

Pre-landing review of UI changes. Reads the diff for visual/component changes and audits design quality. Same severity model as `pb-review`: BLOCKER auto-fixes when obvious, IMPORTANT asks first, NIT mentions only.

If a URL is given as the argument, also do a live pass — open the page, screenshot key states, compare against the checklist visually.

Style targets are project-derived: read the project's existing components, tokens, and `CLAUDE.md` for the design system before applying any rule. Do not impose a style the project does not use.

## Steps

### 1. Determine scope

Same scope-detection rules as `pb-review`: against `origin/main` for feature branches, against upstream when reviewing unpushed commits on main itself.

```bash
CURRENT=$(git branch --show-current 2>/dev/null)
if [ "$CURRENT" = "main" ] || [ "$CURRENT" = "master" ]; then
  BASE=$(git rev-parse --verify @{u} 2>/dev/null || echo "HEAD~1")
else
  BASE=$(git rev-parse --verify origin/main 2>/dev/null \
    || git rev-parse --verify origin/master 2>/dev/null \
    || git rev-parse --verify main 2>/dev/null \
    || git rev-parse --verify master 2>/dev/null \
    || echo "HEAD~1")
fi
git diff --name-only "$BASE"...HEAD | grep -E '\.(tsx?|jsx?|vue|svelte|astro|css|scss|sass|module\.css|html)$|tailwind\.config|globals\.css|tokens\.(ts|json|css)' || true
```

Include uncommitted UI changes. If no UI files changed, say so and stop — design review on backend-only diffs is noise.

### 2. Learn the project's design system

Before applying any rule, infer the project's conventions:

- Spacing scale — Tailwind defaults, custom config, or ad-hoc?
- Typography scale — how many sizes/weights are actually in use?
- Color tokens — `--color-*` CSS vars, Tailwind theme, or hex literals?
- Component primitives — shadcn, custom, MUI, etc.?
- Existing patterns for the kind of element you're reviewing (a button, a card, a form)

If a `CLAUDE.md` documents a design system or brand-tone (e.g. Sendays' two aesthetic registers), respect it. If a subproject has its own `CLAUDE.md`, that wins for tech-style decisions.

### 3. Read the visual diff

```bash
git diff "$BASE"...HEAD -- $(git diff --name-only "$BASE"...HEAD | grep -E '\.(tsx?|jsx?|vue|svelte|astro|css|scss|html)$|tailwind\.config|globals\.css' || true)
```

Hold the intent: new component, restyle, refactor of existing UI, new page, or tweak.

### 4. Focused checks

Run in order. Stop early if a finding warrants discussion.

**Accessibility (BLOCKER if violated)**
- Interactive element using a non-semantic tag (`div onClick`, no `role`)
- Image without `alt` (or empty `alt` for non-decorative)
- Form input without an associated label
- Focus-visible state missing on a focusable element
- Color contrast clearly under 4.5:1 for body text or 3:1 for large/UI

**Hierarchy & layout**
- Two elements of the same kind drawn with different weights/sizes for no reason
- Heading level skipped (`h1` then `h3`) without a structural reason
- Overflow risk: long string in a fixed-width container, no truncation
- Mobile breakpoint not considered when the change is layout-affecting (no `sm:`/`md:` adjustment, no flex-wrap, no responsive typography)

**Spacing & typography**
- Magic px values that don't sit on the project's scale
- Mixed font-weight values that don't match an existing pattern
- Line-height absent or inconsistent for blocks of text

**Color & depth**
- Hardcoded hex/rgba where a token exists
- Shadow added without an existing shadow scale, or shadow opacity > 0.25
- Gradients added without precedent in the project (especially purple/blue gradients — common AI-slop)

**AI slop / generic-LLM output**
- Glass-morphism (`backdrop-blur` + translucent white) without a reason rooted in the design
- Centered hero with a gradient background and a giant CTA, when the rest of the app is utilitarian
- Emoji peppered in copy where the brand-tone forbids it (per `CLAUDE.md`)
- Lorem ipsum or placeholder copy left in
- Component named `Hero`, `Feature`, `Pricing` etc. when the page is internal tooling

**Dead UI**
- Component file with no caller after this change
- Variant or prop removed in code but the type still includes it
- Old class names left on elements next to new ones

### 5. Categorize and act

- **BLOCKER** — accessibility violation, broken responsiveness, hardcoded color when tokens exist for that exact role, AI-slop in a project whose `CLAUDE.md` forbids it. Auto-fix only when the right replacement is unambiguous (e.g. swap `<div onClick>` to `<button>`, add a missing `alt=""` for a decorative icon, replace `#0066ff` with the existing `--color-primary` token).
- **IMPORTANT** — taste-adjacent: spacing inconsistency, missing focus state styling that requires a design choice, hierarchy fix that affects more than one element. Ask before fixing.
- **NIT** — minor polish, single-pixel adjustments, "could be nicer" observations. Mention once. Do not fix.

Never auto-fix: anything that changes the visual identity (color palette swap, type-scale rewrite), anything that requires a screenshot to verify, anything in a brand-controlled surface (marketing pages, landing pages) without explicit approval.

### 6. Live pass (only if a URL was given)

```bash
# arg parsing: $ARGUMENTS contains the URL if provided
```

If the user passed a URL, take screenshots of the changed pages or components. Use Playwright via `browser_navigate` + `browser_take_screenshot`, or fall back to `/browse` if it is the only browsing tool available.

Screenshot at three widths: 375 (mobile), 768 (tablet), 1280 (desktop). Compare against the checklist above. Save screenshots to `.pb-design-review/<branch>/<page>-<width>.png` (gitignored).

### 7. Report

```
Design review: N findings — X BLOCKER, Y IMPORTANT, Z NIT
Project style read from: <files used to infer the system>
Auto-fixed:
  - <bullet per fix, with file:line>
Needs your call:
  - <bullet per finding, with file:line and the question>
NIT:
  - <one line per nit>
Live pass: <urls screenshotted | skipped — no URL given>
```

Then ask: continue or discuss findings? Do not stage, commit, push, or open a PR.
