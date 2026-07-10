---
name: pb-design-review
description: >
  Pre-merge UI design review for Codex. Use when the user asks for
  pb-design-review, a design review, visual review, UI review, pre-landing UI
  audit, or review of TSX, JSX, Vue, Svelte, Astro, CSS, SCSS, Tailwind,
  design-token, component, page, form, dashboard, card, navigation, modal, or
  app-shell changes. Audits the diff for design quality, accessibility,
  responsiveness, project-style consistency, AI-slop patterns, dead UI, and
  optionally runs a live screenshot critique when a URL is provided.
---

# pb-design-review

Run one comprehensive UI review pass before merge. Combine practical UI design
checks, art-direction critique, and the pb-suite severity model. Read the
project before applying taste. A finding only matters if it violates the
project's own design system, weakens the hierarchy, harms accessibility,
breaks responsiveness, or introduces generic AI-looking output.

Do not stage, commit, push, or open a PR. Auto-fix only local, obvious
BLOCKERs. Ask before changing anything that is taste-adjacent or brand-shaping.

## Canonical source

Before beginning, resolve the installed suite and read the complete canonical
command. Its refusal flags, severity model, source references, and report
requirements remain authoritative.

```bash
source "$HOME/.codex/skills/pb-bootstrap.sh"
```

Read `$PB_SUITE/commands/pb-design-review.md`, then apply the Codex-native
review detail below. Interpret arguments from the user's request; when the
canonical command calls another slash command, apply the corresponding Codex
skill procedure inline.

## 1. Determine Scope

Find the base branch and the UI files changed against it:

```bash
BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || git rev-parse HEAD~1)
git status --short
git diff --name-only "$BASE"...HEAD
git diff --name-only
```

Include uncommitted UI changes. Review files matching:

```text
*.ts *.tsx *.js *.jsx *.vue *.svelte *.astro *.css *.scss *.sass
*.module.css tailwind.config.* globals.css tokens.* *.html
```

If no UI files changed, say so and stop. Backend-only design review is noise.

## 2. Learn The Project Style

Before applying any rule, infer the system from local files:

- Read root `AGENTS.md`, `CLAUDE.md`, or local app/package instructions.
- Read design-system integration docs, theme CSS, token files, Tailwind config,
  app layout, globals, and nearby components.
- Identify spacing scale, type scale, color-token conventions, component
  primitives, icon library, state patterns, and copy/brand constraints.
- Prefer existing patterns over invented style. If a subproject has its own
  instructions, those win for that subproject.

## 3. Read The Visual Diff

Read the UI diff and classify the intent: new component, restyle, refactor,
new page, flow state, or small polish.

```bash
git diff "$BASE"...HEAD -- <changed-ui-files>
git diff -- <uncommitted-ui-files>
```

Hold the intent while reviewing. Do not punish a small token swap for not being
a redesign, and do not let a redesign hide accessibility regressions.

## 4. Focused Checks

Run these in order.

### Accessibility

BLOCKER when violated:

- Interactive behavior on non-semantic tags without role/keyboard support.
- Non-decorative images without useful `alt`.
- Form input without an associated label.
- Missing visible focus state on focusable UI.
- Clearly insufficient contrast: below 4.5:1 for body text or 3:1 for large/UI
  text and controls.

### Visual Hierarchy

Flag hierarchy issues when they affect comprehension:

- Pure black text where the project uses dark grey or tokenized foreground.
- Font weights below 400 used for de-emphasis.
- More than two font weights in a small surface without precedent.
- Distinction relying on size alone instead of size plus weight, color, spacing,
  or grouping.
- Section labels styled like primary content.
- Adjacent elements competing for the same visual weight.
- Button hierarchy based on semantics instead of importance.

### Spacing And Layout

Flag when the layout will feel unstable or amateur:

- Magic pixel values outside the project scale.
- Related items separated too far, unrelated items too close.
- Broken vertical rhythm between repeated blocks.
- Missing mobile behavior for layout-affecting changes.
- Skipped heading levels without structural reason.
- Long-string overflow risk in fixed containers.
- Text that can collide with adjacent content or outgrow a button/card.

### Typography

Use objective thresholds:

- Body copy should have a line-length cap around 45-75 characters.
- Body leading should usually be 1.5-1.6x; headings usually 1.1-1.3x.
- Type sizes should follow the project scale rather than arbitrary values.
- Typeface character should match the app's tone and existing design system.

### Color And Depth

Flag:

- Hardcoded hex/rgba where a semantic token exists.
- New colors using a different color syntax than the project standard.
- Neutral palettes interrupted by saturated accents without precedent.
- New gradients, especially purple/blue/violet marketing gradients, without a
  project-rooted reason.
- Shadows that do not match the local elevation system.
- Shadow-only hover states without background, border, or focus parity.

### Forms, States, Feedback

Flag:

- Required state without a visual indicator.
- Disabled state that still looks interactive.
- Help text, labels, or validation placed inconsistently.
- Data-driven component with no empty, loading, and error state where those
  states can occur.
- Optimistic UI without an evident rollback or failure path.

### AI Slop

Treat these as suspicious unless the project explicitly uses them:

- Glassmorphism, translucent white panels, or backdrop blur as decoration.
- Centered hero, gradient background, oversized CTA in an operational app.
- Emoji where the project forbids them.
- Lorem ipsum or placeholder copy.
- Generic marketing component names in internal tooling: `Hero`, `Feature`,
  `Pricing`, etc., when domain names would be clearer.

### Dead UI

Flag:

- New component with no caller.
- Removed variant still present in types.
- Old class names or props left next to new ones.
- Duplicate UI paths after a refactor.

## 5. Categorize And Act

Use the pb-suite severity model:

- **BLOCKER**: accessibility violation, broken responsiveness, hardcoded color
  where a clear token exists, project-forbidden AI slop, or UI behavior that is
  plainly broken. Auto-fix only when the replacement is unambiguous and local.
- **IMPORTANT**: spacing, hierarchy, state, or craft issue that requires a
  design choice. Ask before fixing.
- **NIT**: minor polish. Mention once. Do not fix unless asked.

Never auto-fix palette changes, type-scale rewrites, visual identity choices,
brand-controlled surfaces, or anything requiring screenshot verification.

## 6. Optional Live Pass

If the user provides a URL, capture the page and critique the screenshot. Prefer
the Browser plugin for local URLs and active in-app browser work. If the Browser
plugin is not already available, use `tool_search` for `browser`. Store ad-hoc
screenshots where the repository says; if there is no project convention, use:

```text
.pb-design-review/<branch-or-session>/
```

Compare the screenshot against the checklist findings. Promote a NIT to
IMPORTANT when the visual artifact is materially worse than the code suggested.

When a live pass ran and no BLOCKERs remain, add a short art-direction critique:

- **First impression**: what the screen communicates before reading.
- **Composition and hierarchy**: eye path, dominant element, accidental ties.
- **Color alignment**: temperature, value range, saturation, token fit.
- **Typography**: line length, leading, scale, typeface character.
- **Craft**: spacing consistency, alignment, state finish, image treatment.

Close the critique with one top priority and one thing genuinely working.

## 7. Report

Use this exact shape:

```text
Design review: N findings - X BLOCKER, Y IMPORTANT, Z NIT
Project style read from: <files used>

Auto-fixed:
  - <bullet per fix, with file:line>

Needs your call:
  - <bullet per finding, with file:line and the question>

NIT:
  - <one line per nit>

Live pass:      <screenshot path | skipped - no URL given>
Critique:       <ran | skipped - <reason>>
Top priority:   <single one-liner if critique ran>
Working well:   <single one-liner if critique ran>
```

Then ask whether to continue with fixes or discuss findings.
