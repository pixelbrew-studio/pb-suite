---
description: Pre-landing review of UI changes. Single comprehensive pass — combines Refactoring UI principles (from ux-design), structured visual critique (from art-director), and pb-suite's pre-merge severity model. Audits the diff for design quality, runs subjective critique when a live URL is given.
allowed-tools: [Bash, Read, Edit, Grep, Glob]
argument-hint: "[url]  optional dev-server URL for live screenshot pass + structured critique"
---

# pb-design-review

One comprehensive UI review pass for pre-merge. Bundles three things Karel used to run separately: the gstack design-review (now uninstalled), the `art-director` structured critique, and the `ux-design` Refactoring UI principles. Same severity model as the rest of pb-suite: BLOCKER auto-fixes when obvious, IMPORTANT asks first, NIT mentions only.

If a URL is given as the argument, the command also opens the live page and runs an art-direction critique on top of the checklist pass — no separate hand-off step.

Style targets are project-derived: read the project's existing components, tokens, and `CLAUDE.md` for the design system before applying any rule. Do not impose a style the project does not use. If a subproject has its own `CLAUDE.md`, that wins for tech-style decisions.

The `ux-design` skill remains the canonical reference for the underlying Refactoring UI theory — it auto-triggers while you write UI. This command applies those same principles as a deliberate pre-merge audit.

## Steps

### 1. Determine scope

Same scope-detection as `pb-review`: against `origin/main` for feature branches, against upstream when on main itself.

```bash
PB_CMD="$HOME/.claude/commands/pb-design-review.md"
PB_SUITE=$(dirname "$(dirname "$(readlink "$PB_CMD" 2>/dev/null || echo "$PB_CMD")")")
source "$PB_SUITE/scripts/lib/scope.sh"
git diff --name-only "$BASE"...HEAD | grep -E '\.(tsx?|jsx?|vue|svelte|astro|css|scss|sass|module\.css|html)$|tailwind\.config|globals\.css|tokens\.(ts|json|css)' || true
```

Include uncommitted UI changes. If no UI files changed, say so and stop — design review on backend-only diffs is noise.

### 2. Learn the project's design system

Before applying any rule, infer the project's conventions:

- **Spacing scale** — Tailwind defaults, custom config, or ad-hoc?
- **Typography scale** — how many sizes/weights are actually in use? What is the body line-height? Is `max-w-prose` (or equivalent) applied to text blocks?
- **Color tokens** — `--color-*` CSS vars, Tailwind theme, or hex literals? Is the grey scale neutral or tinted (gray-with-hue)?
- **Component primitives** — shadcn, custom, MUI, etc.?
- **Existing patterns** for the kind of element you're reviewing (a button, a card, a form).
- **Brand discipline** — accent-color restrictions, font blacklist, motion budget (Sendays' DESIGN.md is the canonical example).

### 3. Read the visual diff

```bash
git diff "$BASE"...HEAD -- $(git diff --name-only "$BASE"...HEAD | grep -E '\.(tsx?|jsx?|vue|svelte|astro|css|scss|html)$|tailwind\.config|globals\.css' || true)
```

Hold the intent: new component, restyle, refactor of existing UI, new page, or tweak.

### 4. Focused checks

Run in order. Stop early if a finding warrants discussion. Categories below cover the Refactoring UI principles (hierarchy, spacing, typography, color, depth, forms, states), accessibility, and the AI-slop patterns Karel has flagged before.

**Accessibility (BLOCKER if violated)**
- Interactive element on a non-semantic tag (`div onClick`, no `role`)
- Image without `alt` (or empty `alt` for non-decorative)
- Form input without an associated label
- Focus-visible state missing on a focusable element
- Color contrast clearly under 4.5:1 for body text or 3:1 for large/UI

**Visual hierarchy** (Refactoring UI §2)
- Pure `#000` / `rgb(0,0,0)` text — should be very dark grey (e.g. `hsl(0,0%,9%)`)
- Font-weights below 400 used for de-emphasis (use lighter color or smaller size instead)
- More than two font-weights in the diff without an existing precedent
- Hierarchy distinction relies on size alone — should combine size + weight + color
- Section titles styled as content (large/bold) rather than as labels (small/muted)
- Adjacent elements competing for the same visual weight (accidental visual ties)
- Solid icons used without a contrast adjustment to balance their visual weight
- Button hierarchy not by importance — destructive actions treated as primary when destruction is not the goal

**Spacing & layout** (Refactoring UI §3)
- Magic px values outside the project's spacing scale
- Density mismatch: closely-related items not in proximity, loosely-related items not separated
- Vertical rhythm broken — inconsistent gaps between similar blocks
- White-space feels reactively added (tight, then padded) rather than generous-then-trimmed
- Mobile breakpoint not considered when the change is layout-affecting (no `sm:` / `md:` adjustment, no flex-wrap, no responsive typography)
- Heading level skipped (`h1` then `h3`) without a structural reason
- Overflow risk: long string in a fixed-width container, no truncation

**Typography** (Refactoring UI §4)
- Body text without `max-w-prose` or an equivalent line-length cap (target: 45-75ch)
- Body leading missing or below 1.5x — should be 1.5-1.6x for body, 1.1-1.3x for headings
- Line-height absent or inconsistent for blocks of text
- Type scale ratio inconsistency (no clear modular relationship between sizes)
- Typeface character does not match the project's brief

**Color & depth** (Refactoring UI §5-6)
- Hardcoded hex/rgba where a token exists for that role
- Pure greys without hue when the project's palette uses gray-with-hue
- RGB used for new colors when the project's convention is HSL/HSLA
- Saturation jumps — neutral palette plus a sudden saturated accent without precedent
- Single-layer shadows added when the project uses multi-layer (ambient + key) shadows
- Shadow opacity > 0.25 or no scale match
- Gradients added without precedent — especially purple/blue/violet (common AI-slop)

**Forms** (Refactoring UI §8)
- Label/value not combined where the format self-identifies (`$19.99`, `jane@example.com`, `3 bedrooms`)
- Required-state has no visual indicator
- Disabled state lacks a clear non-interactive affordance
- Help text and label position inconsistent with the rest of the project

**States & feedback** (Refactoring UI §10)
- New data-driven component without empty state, loading state, or error state
- Skeleton vs spinner choice does not match the expected latency
- Optimistic UI applied without a rollback path

**AI slop / generic-LLM output**
- Glass-morphism (`backdrop-blur` + translucent white) without a reason rooted in the design
- Centered hero with a gradient background and a giant CTA, when the rest of the app is utilitarian
- Emoji in copy where brand-tone forbids it (per `CLAUDE.md`)
- Lorem ipsum or placeholder copy left in
- Components named `Hero`, `Feature`, `Pricing` etc. on internal tooling

**Dead UI**
- Component file with no caller after this change
- Variant or prop removed in code but the type still includes it
- Old class names left next to new ones

### 5. Categorize and act

- **BLOCKER** — accessibility violation, broken responsiveness, hardcoded color when tokens exist for that role, AI-slop forbidden by `CLAUDE.md`. Auto-fix only when the replacement is unambiguous (swap `<div onClick>` to `<button>`, add `alt=""` for a decorative icon, replace `#0066ff` with `--color-primary`, remove a `console.log`).
- **IMPORTANT** — taste-adjacent: spacing inconsistency, missing focus state styling that requires a design choice, hierarchy fix that touches more than one element. Ask before fixing.
- **NIT** — minor polish, single-pixel adjustments, "could be nicer". Mention once. Do not fix.

Never auto-fix: anything changing the visual identity (palette swap, type-scale rewrite), anything that requires a screenshot to verify, anything in a brand-controlled surface (marketing pages, landing pages) without explicit approval.

### 6. Live pass (only if a URL was given)

If `$ARGUMENTS` contains a URL, capture a screenshot via the pb-suite browse script:

```bash
PB_SUITE=$(dirname "$(dirname "$(readlink "$HOME/.claude/commands/pb-design-review.md" 2>/dev/null || echo "$HOME/.claude/commands/pb-design-review.md")")")
BRANCH=$(git branch --show-current 2>/dev/null || echo "no-branch")
SAFE_BRANCH=${BRANCH//[^a-z0-9.-]/_}
OUT=".pb-design-review/$SAFE_BRANCH"
mkdir -p "$OUT"
bun "$PB_SUITE/scripts/browse.ts" "$URL" --screenshot "$OUT/$(date +%s).png" --raw > /dev/null
```

Compare the screenshot against the checklist findings. If a NIT looks worse in the screenshot than the diff suggested, promote it to IMPORTANT.

### 7. Structured critique (live URL + no BLOCKERs)

When a live URL was given and the checklist surfaced no BLOCKERs, run an art-direction pass on the captured screenshot. This is the subjective layer — the things a checklist can't catch. Skip when the diff is purely mechanical (touch-target padding, single-token swap) or when BLOCKERs remain.

Critique across five dimensions, brief and specific. Reference the project's `CLAUDE.md` design system for brand context.

- **First impression** — what does the screenshot communicate before you read anything? One sentence. Does it land or not?
- **Composition & hierarchy** — where does the eye go first, second, third? Is the visual weight distribution serving the content priority? Identify the dominant element — is it the right one? Spot accidental visual ties.
- **Color alignment** — compare against the project's palette. Temperature (warm vs cool), value range (contrast), saturation level. Reference specific approved patterns when making observations: "The product surfaces lean Geist Mono + denser data — this card is heading editorial."
- **Typography** — measure against objective principles: line length (45-75ch), leading (1.5-1.6x body, 1.1-1.3x headings), scale ratio consistency. Is the typeface character matching the brief? Is weight distribution working?
- **Craft** — spacing consistency (does the grid hold?), alignment, type rendering quality, image treatment, detail finish. The fine-grained pass.

Close with one priority: what is the single most important thing to address — not a list of ten, one. And one sentence on what is genuinely working.

### 8. Report

```
Design review: N findings — X BLOCKER, Y IMPORTANT, Z NIT
Project style read from: <files used to infer the system>

Auto-fixed:
  - <bullet per fix, with file:line>

Needs your call:
  - <bullet per finding, with file:line and the question>

NIT:
  - <one line per nit>

Live pass:      <screenshot path | skipped — no URL given>
Critique:       <ran | skipped — <reason>>
Top priority:   <single one-liner from the critique, if it ran>
Working well:   <single one-liner from the critique, if it ran>
```

Then ask: continue or discuss findings? Do not stage, commit, push, or open a PR.
