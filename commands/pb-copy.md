---
description: Copywriting review and rewrite. Strips AI-slop ("dive into", "leverage", "In today's fast-paced landscape..."), enforces project brand-tone from CLAUDE.md, applies one copywriting framework per surface (AIDA/PAS/FAB/BAB). Mode-aware for marketing vs product copy. Severity-based output.
allowed-tools: [Bash, Read, Edit, Write, Glob, Grep, AskUserQuestion]
argument-hint: "[copy text or file path] [--mode rewrite|critique|generate|brand-check] [--surface marketing|product|email|button]"
---

# pb-copy

Pre-publish copy review and rewrite. Strips AI-slop, enforces project brand-tone from `CLAUDE.md`, applies one copywriting framework per surface. Same severity model as the rest of pb-suite: BLOCKER auto-fixes when obvious, IMPORTANT asks first, NIT mentions only.

Distilled from the better Claude-Code copywriting skills (cyrwheelninja's AI-trope list, classic frameworks) but kept light: one framework per pass, project-specific rules read from `CLAUDE.md`, no DTC sales-page vibe — built for tools/SaaS/studio surfaces where words matter but enthusiasm doesn't.

## Modes

- **rewrite** (default when text or file is given) — improve existing copy. Auto-fix trope words, propose IMPORTANT changes for taste calls.
- **critique** — review only, no edits. Useful for "is this OK to publish?".
- **generate** — produce copy from a brief. Requires `--surface` to pick the right register and framework.
- **brand-check** — fast pass against the project's `CLAUDE.md` rules (emoji ban, exclamation cap, superlative ban). Cheap, quick.

## Steps

### 1. Triage

Parse `$ARGUMENTS`:
- Copy text (positional, multi-line) — or
- File path (ending in `.md`/`.txt`/`.tsx`/`.ts`/`.html`) — read the file, focus on user-facing strings (JSX text nodes, copy constants, alt text, button labels)
- `--mode rewrite|critique|generate|brand-check` — default `rewrite`
- `--surface marketing|product|email|button` — optional, auto-detected from content if omitted

If no input: stop and ask for copy or file path.

### 2. Read project brand-tone

Collect brand-tone signals from multiple possible locations. Read whichever exist:

**Top-level files** (read first, these usually have the headline rules):

```bash
for f in CLAUDE.md AGENTS.md BRAND.md VOICE.md DESIGN.md; do
  [ -f "$f" ] && echo "found: $f"
done
```

**Monorepo content-style packages** (e.g. Acme's `@acme/content-style`). Look for packages whose name or path hints at voice/tone/brand/copy:

```bash
find packages -maxdepth 3 -type d \( -name "*content-style*" -o -name "*voice*" -o -name "*tone*" -o -name "*brand*" -o -name "*copy*" -o -name "*content*" \) 2>/dev/null | head -5
```

For each match, read its `CLAUDE.md` / `README.md` and any `src/*.ts` exporting typed constants (e.g. `PREFERRED_WORDS`, `AVOIDED_WORDS`, `TONE`, `BRAND_PROMISE`, `PRODUCT_NAMING`). Those are usually the most precise, machine-readable definitions.

**App-specific overrides** (when running inside a monorepo app rather than the root):

```bash
# When CWD is inside apps/<name>/, read that app's CLAUDE.md too
test -f apps/$(basename "$PWD")/CLAUDE.md && cat apps/$(basename "$PWD")/CLAUDE.md
```

App-level rules override platform-level rules where they conflict.

**Extract from each source**:

- **Language** — NL / EN / mixed (which surfaces use which)
- **Emoji policy** — allowed or forbidden
- **Exclamation marks** — allowed or forbidden
- **Superlative ban list** — explicit or inferred ("no superlatives" → use pb-copy's default list)
- **Preferred/avoided words** — when a content-style package or `## Words` section lists them, use those verbatim as overrides for the generic AI-tropes appendix
- **Two-register split** — e.g. Sendays' "editorial marketing vs instrument product"
- **Required vocabulary** — brand words to use (e.g. "decision engine", "evidence", "shortlist") or avoid (e.g. "AI-powered" when too generic)
- **Product-naming rules** — first-mention vs second-mention, sub-brand bans, deprecated names (e.g. Acme's "LegacyProduct" → "Acme Shortlist")
- **Compliance posture** — audit-caution flags (e.g. "no wordplay around fraud/pretending"), regulator-tone constraints
- **AI-positioning** — function-name preferred over marketing-claim ("AI-assisted screening" beats "Powered by AI")
- **Length budgets** — if documented for specific surfaces

Aggregate sources into a single effective rule set. Cite the source path for each rule in the report so the user can trace why a finding fired.

If no brand-tone is documented anywhere: use pb-suite defaults — no emoji, no exclamation marks, no superlatives, no AI-tropes, neutral and concrete.

### 3. Detect surface register

If `--surface` is given: use that. Otherwise infer:

- Long-form with hero/headline/pricing structure → **marketing** (editorial register: storytelling allowed, longer sentences OK, one expressive verb permitted)
- Short labels, error messages, form fields, table headers, tooltips → **product** (instrument register: clarity over flair, action-verb first, no metaphors)
- "Hi <name>" / sign-off / subject line patterns → **email**
- Single line CTA on a button-shaped element → **button**

Surfaces have different rules — apply them in step 6 below.

### 4. AI-slop check (BLOCKER if found, auto-fix in rewrite mode)

Scan for trope words and patterns. The full list is in **Appendix: AI Tropes** at the bottom — edit it per project when needed.

**Trope words (highlight + propose replacement)** — common verbs (dive into, leverage, harness, unlock, empower, revolutionize, streamline, optimize, elevate, supercharge, transform), adjectives (robust, seamless, cutting-edge, game-changing, holistic, innovative, dynamic, transformative, comprehensive, world-class), nouns (journey, landscape, paradigm, synergy, ecosystem).

**Trope patterns (BLOCKER)**:
- "It's not just X, it's Y" — pick one
- "The result?" / "The bottom line?" rhetorical pauses
- Rule of three without substance ("creative, smart, and passionate")
- Rhetorical questions that answer themselves ("Want more leads? Of course you do.")
- Opening with "In today's fast-paced..."
- "We're SO excited to announce..." (any excessive-enthusiasm formula)
- Em-dashes used as comma-substitute three+ times in a paragraph
- Every paragraph starts with the same construction
- Sentence-length uniformity (every sentence ≈ same word count — LLM cadence tell)

In **rewrite** mode: replace trope words with the simpler equivalent from the appendix. Rewrite trope patterns into direct statements. Ask before any change that shifts meaning.

### 5. Brand-tone check

Apply the project's `CLAUDE.md` rules from step 2.

- **Emoji** where forbidden → BLOCKER, strip
- **Exclamation marks** where forbidden → BLOCKER, strip
- **Superlative** from project ban list → BLOCKER per matching word
- **Wrong register** — product copy reading like marketing, or vice versa → IMPORTANT
- **Wrong language** — EN where project specifies NL (or mixed where one register is required) → IMPORTANT
- **Missing required vocabulary** — project insists on a specific phrasing (e.g. "decision engine" not "AI tool") and the copy uses the wrong one → IMPORTANT

### 6. Framework pass (one per surface)

Apply ONE framework — the one that fits the surface. Frameworks are diagnostic, not templating.

**marketing-hero / landing-page** → **AIDA**:
- Attention — does the headline make me look?
- Interest — does the next line make me want more?
- Desire — is there one concrete reason to want this?
- Action — verb + object + clear destination?

**marketing-feature** → **FAB**:
- Feature — what is it
- Advantage — what it does
- Benefit — why I care
Most copy stops at A. The B is where the value lands.

**marketing-problem-section** → **PAS**:
- Problem — name the specific pain
- Agitation — make it concrete (one example, not a list)
- Solution — your product, one line

**product-empty-state** → **BAB**:
- Before — current state
- After — state after the action
- Bridge — the single action that gets you there

**button-CTA** → verb + object, max 4 words, no period. "Get started" works; "Start" is better; "Sign up free now!" is broken.

**email-subject** → curiosity OR clarity, never both. ≤ 50 chars. No emojis, no `Re:` hijacks.

### 7. Specificity check

Generic phrasing signals hand-wavy thinking. Flag (IMPORTANT):

- "Solution" / "platform" / "tool" used as the noun without specifying what it does
- "Best" / "leading" / "premier" without proof
- Numbers without a unit ("40% increase" → 40% in what, over what period?)
- "Made for X" / "Designed for X" without naming what X actually does differently
- Hand-wavy verbs (leverage, harness, enable, facilitate) where a concrete verb exists

**Rule**: every claim needs (a) a specific verb of what happens, or (b) one proof point (number, named example, link to demo).

### 8. Length & rhythm

Marketing register has more room; product register fits the UI constraint.

- Marketing hero: ≤ 7 words headline, ≤ 14 words subhead
- Marketing body: ≤ 20 words per sentence, **varied** sentence lengths
- Product button: ≤ 4 words, no period
- Product tooltip: ≤ 10 words
- Product error: ≤ 15 words, action-verb start ("Check your network" not "An error occurred")
- Email subject: ≤ 50 chars
- Transactional email body: ≤ 150 words

Over budget: NIT for marketing (taste), IMPORTANT for product (fits the UI).

### 9. Report

```
pb-copy: <mode>
Surface:           <marketing | product | email | button>
Language:          <detected>
Brand-tone source: <CLAUDE.md path used>

Findings: N (X BLOCKER, Y IMPORTANT, Z NIT)

[BLOCKER]
  <quote or position> — <issue ("leverage" used 3×, em-dashes 4× in 2 sentences)>
    suggestion: <concrete replacement>

[IMPORTANT]
  ...

[NIT]
  ...

Rewritten (rewrite mode only):
  <full rewritten copy>
```

In **rewrite** mode the rewritten copy is shown but only written back to file when the original was a file AND the user explicitly approves via `AskUserQuestion`.

End with: apply changes / discuss findings / show again with one finding ignored?

## Appendix: AI Tropes (edit per project as needed)

**Verbs to replace**: dive into → explore; leverage → use; harness → use; unlock → access; empower → help; revolutionize → change; streamline → simplify; optimize → improve; elevate → raise; supercharge → speed up; transform → change; navigate → use; foster → build; embark on → start.

**Adjectives to replace**: robust → strong; seamless → smooth; cutting-edge → new; game-changing → useful; holistic → complete; innovative → new; dynamic → active; transformative → effective; comprehensive → complete; world-class → (delete); best-in-class → (delete); next-generation → new.

**Nouns to replace**: journey → process; landscape → market; paradigm → approach; synergy → (delete); ecosystem → system; framework (when vague) → method; solution (when vague) → product.

**Patterns to remove entirely**: "In today's fast-paced...", "It's not just X, it's Y", "The result? <statement>", "Want X? Of course you do.", "We're SO excited to announce!", excessive em-dashes used as comma-substitute, every sentence-of-the-same-length cadence.

## What this command does NOT do

- Not a CMS — does not push the rewrite live, only updates the source file (when approved).
- Not a long-form generator — `generate` mode produces one surface at a time. For full landing pages, run it per section.
- Not a translator. Detected-language stays detected-language unless the user explicitly asks for a translation.
- Not the design pass — that is `/pb-design-review`. Pb-copy reviews the words IN the UI; pb-design-review reviews the UI those words sit in.
