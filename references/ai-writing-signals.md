# AI-writing signals — pb-copy knowledge base

The volatile detection rules for `/pb-copy`'s AI-slop pass. The skill reads this
file at runtime; the skill body holds only procedure. Edit here when the tells
shift (they change per model era) — no skill edit needed. Keep dated entries in
the changelog at the bottom so `/pb-evolve` and `git diff` can track what moved.

Distilled from [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
(the WikiProject AI Cleanup field guide). That guide exists to *detect* AI text
for moderation. `/pb-copy`'s job is the inverse: **avoid producing these tells,
and strip them when rewriting** — so the read here is "what to cut," not "who to
accuse." The accusation framing matters because the same guide is emphatic that
most single signals are weak (see Part A §6); the copy goal is concrete, human,
specific prose regardless of who or what wrote the draft.

Per-project overrides live in the project's `CLAUDE.md` (a `## Words` /
`## Voice` block or a content-style package). Project rules override the defaults
here on conflict — e.g. a brand that legitimately uses curly quotes, or one that
bans an extra set of words.

---

## Part A — In-depth summary

The guide groups tells into five families plus two "don't be fooled" sections.
Why these patterns exist: an LLM infers the statistically likely next token, so
it **regresses to the mean** — it smooths specific, rare facts into generic,
positive, important-sounding statements that could apply to almost any topic. A
sharp photo becomes a blurry, flattering sketch: simultaneously *less specific*
and *more exaggerated*. Most tells below are a surface symptom of that one cause,
which is also why "be specific and concrete" fixes most of them at once.

### 1. Content tells (what the text over-claims)

- **Undue emphasis on significance, legacy, and broader trends.** Puffs up the
  subject by tying mundane facts to grand arcs. Adds importance even to etymology
  or population data, sometimes after a hedge that admits the subject is minor.
  For biology/places: over-stresses ecosystem ties, conservation status, and
  "preservation efforts" even when none exist.
  *Watch:* stands/serves as, is a testament/reminder, a vital/significant/crucial/pivotal/key role/moment, underscores/highlights its importance, reflects broader, symbolizing its ongoing/enduring/lasting, contributing to the, setting the stage for, marking/shaping the, represents/marks a shift, key turning point, evolving landscape, focal point, indelible mark, deeply rooted.
- **Canned emphasis on notability, attribution, and media coverage.** "Proves"
  importance by hammering *that* the subject was covered and *what kind* of outlet
  covered it, rather than stating facts. Echoes review-criteria wording verbatim.
  *Watch:* independent coverage, local/regional/national media outlets, trade publications, profiled in, written by a leading expert, **maintains an active social media presence**, "significant, substantial, secondary coverage."
- **Superficial analyses.** Tacks an empty "-ing" participle clause onto the end
  of a sentence to fake insight ("…, highlighting its role as a regional hub"),
  often attributed to a vague or named source that says no such thing.
  *Watch:* highlighting/underscoring/emphasizing…, ensuring…, reflecting/symbolizing…, contributing to…, cultivating/fostering…, encompassing…, enhancing…, valuable insights, align/resonate with.
- **Promotional / advertisement-like language (puffery).** Drifts to travel-guide
  or press-release tone even when asked for neutral prose. Newer models are more
  *subtly* positive (avoid "the best") than older ones.
  *Watch:* boasts a, vibrant, rich, profound, enhancing, showcasing, exemplifies, commitment to, natural beauty, nestled, in the heart of, groundbreaking, renowned, featuring, diverse array.
- **Vague attribution / overgeneralized opinion (weasel).** Attributes claims to
  an unnamed authority and inflates how many sources hold a view (one source →
  "experts," "several publications").
  *Watch:* industry reports, observers have cited, experts argue, some critics argue, "several sources/publications" (when few are cited), "such as" before an exhaustive list.
- **Outline-like "challenges / future prospects" conclusion.** A rigid formula:
  "Despite its [praise], X faces challenges, including…" → vaguely upbeat close or
  speculation about future initiatives. The tell is the *formula*, not the topic.
  *Watch:* "Despite its … faces several challenges", "Despite these challenges", "Challenges and Legacy", "Future Outlook / Future Directions".
- **Leads that treat a descriptive title as a proper noun.** Defines a generic
  phrase as if it were a named entity ("**Catchment area (health)** refers to…").

### 2. Language & grammar tells (how the sentences are built)

- **High density of "AI vocabulary."** A specific, studied set of overused words.
  One or two is coincidence; **many, repeatedly, is the single strongest tell.**
  They co-occur — where there's one there are others. The set shifts per model
  era (see Part B word list). Take it literally: a word being overused does *not*
  implicate its synonyms.
- **Avoidance of basic copulatives.** Replaces plain *is/are/has* with
  marketing-ish verbs. "Gallery 825 **is** LAAA's exhibition arm" → "**serves
  as**"; "**has** four spaces" → "**features** four spaces." In leads, avoids *is*
  via "**refers to**."
  *Watch:* serves as / stands as / marks / represents [a], boasts / features / maintains / offers [a], refers to.
- **Negative parallelisms.** Contrast scaffolds that fake nuance:
  - *Not only X but also Y* / *It's not just X, it's Y*
  - *Not X, but Y* / *no…, no…, just…*
  - *X rather than Y* (reversed form, common in Grok)

  **Empty vs. concrete discriminator.** Only the *empty* form is a tell — where
  the affirmative half is generic or vacuous ("not just a tool, it's a *journey*";
  "not X, but *something more*"). Antithesis where the affirmative half names a
  **specific** thing is human rhetoric, not slop ("The remedy is not to avoid AI.
  The remedy is to *force every judgment back to the criterion and the quote*").
  Contrast is native to how-to and "avoid these traps" writing, so high density
  of *concrete* antithesis is not evidence of AI — do not flag on density alone.
- **Rule of three.** Triads everywhere: "adjective, adjective, adjective" or
  "phrase, phrase, and phrase," used to make thin analysis look thorough.

  **Empty vs. concrete discriminator** (same logic as negative parallelism). The
  tell is the *empty* triad — interchangeable filler that pads thin analysis
  ("creative, smart, and passionate"; "robust, scalable, and innovative"). A triad
  whose three members each carry **distinct, concrete content** — escalating
  definitions, anaphora with specific referents ("An outcome with no criterion is
  a preference. A criterion with no source is an assertion. A source no human has
  weighed is an unread quote.") — is deliberate human rhetoric. Do not flag on
  count alone; also note that AI skews to *threes* specifically, so varied list
  lengths (fours, fives) are weak evidence *against* AI.
- **Lexical diversity / elegant variation.** A repetition penalty makes it swap
  in needless synonyms for the same referent ("creativity" → "artistic
  aspirations" → "artistic vision" → "creative expression"). (Caveat: some
  non-native-English writers are taught to avoid repetition too.)

### 3. Style tells (formatting)

- **Title Case In Headings** where sentence case is the house style.
- **Boldface overuse** — emphasizing **every** key term mechanically, readme /
  slide-deck / "key takeaways" style.
- **Inline-header vertical lists** — bullet/number → **bold lead-in** → colon →
  description, repeated. The canonical AI list shape.
- **Em dashes**, especially **spaced** ( — ), used as an all-purpose connector
  where a comma, colon, or parentheses belong; often to "punch up" parallelisms.
  Weak alone (many writers and house styles use them); strong in combination.
- **Unusual tiny tables** for two or three facts that belong in prose.
- **Curly quotes / apostrophes** (" " ' ') from ChatGPT/DeepSeek; often mixed
  inconsistently with straight ones. Weak alone — Word, macOS, and pro typesetters
  all produce them; Gemini and Claude usually don't.
- **Skipped heading levels** (jumping to H3 with no H2) and **thematic breaks
  (`---`) before every heading** — Markdown habits leaking into the output.

### 4. Communication-leakage tells (the assistant talking to you, in the copy)

These are the highest-confidence tells: chatbot chrome that should never appear
in shipped copy.

- **Collaborative communication.** The assistant register survives into the text.
  *Watch:* "I hope this helps," "Of course!", "Certainly!", "You're absolutely
  right!", "Would you like…", "Is there anything else," "Let me know," "Here is
  a…," "a more detailed breakdown."
- **Knowledge-cutoff disclaimers & speculation about missing sources.** "As of my
  last knowledge update…," "While specific details are limited/scarce…," "not
  widely documented/disclosed," "based on available information." For people it
  invents "maintains a low profile / keeps personal details private." All
  speculative.
- **Phrasal templates & placeholder text.** Un-filled Mad-Libs slots that shipped:
  `[Your Name]`, `[Entertainer's Name]`, `[link to the revised article]`,
  `INSERT_SOURCE_URL`, `PASTE_YOUTUBE_VIDEO_URL_HERE`, dates like `2025-XX-XX`.

### 5. Markup & citation-leakage tells

Surface-dependent — these matter when the copy renders as plain text/HTML (web,
email, UI) but the draft carries another markup or tool fingerprint.

- **Markdown bleeding into a non-Markdown surface** — literal `## Heading`,
  `**bold**`, `- bullets`, or ```` ```fenced``` ```` blocks showing up as visible
  characters; ```` ```wikitext ```` fences; mixed markup.
- **`utm_source=` / `referrer=` fingerprints in links** — `utm_source=chatgpt.com`,
  `utm_source=openai`, `utm_source=copilot.com`, `referrer=grok.com`. Near-proof a
  link came from a chatbot's browsing. (Meta-note: the URL that triggered building
  this very KB carried `utm_source=…&_bhlid=…`.)
- **Broken / fabricated citations** — dead links, invalid or mismatched DOIs/ISBNs,
  page-less book cites, named references declared but never used. (Mostly an
  editorial concern, but a tell when copy cites sources.)

### 6. The two "don't be fooled" sections (false-positive discipline)

The guide spends as much space on what is **not** a reliable tell. `/pb-copy`
must not flag these on their own, or it will gut good human copy:

- **Ineffective indicators (never flag alone):** perfect grammar; mixed
  casual/formal register; "bland/robotic" feel; "fancy/academic" prose; letter-like
  salutations; transition words (*Additionally, Consequently, Notably*) in
  isolation; the mere presence of curly quotes or em dashes; unsourced content.
- **Signs of *human* writing (encourage these; they are the fix, not the fault):**
  plain `is`/`has`; simple verbs over stiff synonyms (*wrote* not *authored*,
  *used* not *utilized*, *died* not *passed away*, *moved* not *relocated*, *tried*
  not *attempted*); concrete superlatives that are actually true (*the first*,
  *the only*); ordinary hedges (*perhaps*, *tends to*); the writer's ability to
  explain *why* they made a choice.
- **Caveats:** automated AI detectors have non-trivial error rates; humans are
  near chance at spotting AI text; human and LLM language are converging. So:
  **confidence comes from density and combination, never one signal.**

---

## Part B — The ruleset (evaluate copy against this)

How to score. For each rule, count hits and apply severity. Then apply the
**confidence gate**:

- **Single weak-signal hit** (em dash, curly quote, one AI-vocab word, one
  transition word) → do **not** flag; it is within normal human range.
- **Density** — 3+ distinct AI-vocab words, or the same tell 3+ times in a short
  passage → flag at the listed severity.
- **Combination** — two or more *different* families present (e.g. AI vocab +
  rule-of-three + spaced em dashes) → raise one severity step; this is the
  strongest evidence the prose reads as AI.
- **Leakage tells (family 4–5) are exempt from the gate** — a single
  `[Your Name]`, "Certainly!", or `utm_source=chatgpt.com` is a BLOCKER on its own,
  because it can never be intentional shipped copy.

Severity uses the suite model: **BLOCKER** auto-fix when local and obvious;
**IMPORTANT** ask before fixing (taste/meaning call); **NIT** mention once.

| ID | Signal | How to detect | Severity | Fix |
|----|--------|---------------|----------|-----|
| **AIW-01** | AI-vocabulary density | 3+ distinct words from the word list below in a passage, or any one of them 3×+ | IMPORTANT (BLOCKER if also puffery/superficial) | Replace each with the plain equivalent; delete if it adds nothing |
| **AIW-02** | Undue significance / legacy / "broader trends" | "testament to," "pivotal moment," "reflects a broader," "evolving landscape," importance asserted for a mundane fact | IMPORTANT | Cut the significance claim or replace with one concrete fact/number |
| **AIW-03** | Canned notability / media-coverage padding | "profiled in," "independent coverage," "trade publications," "maintains an active social media presence" | IMPORTANT | State the fact directly; cite inline if needed, don't narrate the coverage |
| **AIW-04** | Superficial "-ing" analysis tail | sentence ends with an empty participle clause (highlighting/ensuring/reflecting/contributing to…) | IMPORTANT | Delete the clause, or replace with a specific, sourced consequence |
| **AIW-05** | Promotional puffery | nestled, in the heart of, vibrant, rich, renowned, groundbreaking, boasts, diverse array, natural beauty | BLOCKER per word in product copy; IMPORTANT in marketing | Delete or replace with a concrete, verifiable detail |
| **AIW-06** | Vague attribution / overgeneralized opinion | "experts argue," "observers have cited," "several sources" (few cited), "such as" before a closed list | IMPORTANT | Name the source, or drop the claim; don't inflate one source into "experts" |
| **AIW-07** | "Challenges / Future prospects" formula | "Despite its …, faces challenges…" → upbeat/speculative close; a "Challenges" or "Future Outlook" section | IMPORTANT | Cut the formula; keep only specific, sourced challenges if real |
| **AIW-08** | Copulative avoidance | "serves as / stands as / represents / features / offers" where *is/are/has* is meant | NIT (IMPORTANT if pervasive) | Restore *is / are / has* unless the fancier verb adds real meaning |
| **AIW-09** | Negative parallelism | "not just X, it's Y," "not X but Y," "no…, no…, just…," "X rather than Y" — **only when the affirmative half is empty/generic** (a journey, something more). Concrete antithesis (the affirmative half names a specific thing) is human rhetoric; do not flag on density alone, esp. in how-to / "avoid these traps" copy | IMPORTANT (empty form) · do-not-flag (concrete form) | Pick the one true statement and say it plainly; keep the contrast when the affirmative half is specific |
| **AIW-10** | Rule of three | strings of three adjectives/phrases, esp. repeated across sentences — **only the empty form** (interchangeable filler: "creative, smart, and passionate"). Triads whose members carry distinct concrete content (escalating definitions, anaphora with specific referents) are deliberate rhetoric; do not flag on count alone | NIT, empty form (IMPORTANT if it's the dominant rhythm) · do-not-flag, concrete form | Keep what's load-bearing; cut filler items; vary structure — but leave concrete triads alone |
| **AIW-11** | Elegant variation | needless synonym-swapping for one referent across a passage | NIT | Repeat the plain noun; don't dress it up |
| **AIW-12** | Title Case headings | every main word capitalized, against house sentence case | NIT (BLOCKER if brand rule says sentence case) | Convert to sentence case |
| **AIW-13** | Boldface overuse | bold on every key term / "key takeaways" pattern | NIT | Bold at most one phrase per block, or none |
| **AIW-14** | Inline-header vertical list | bullet → **bold lead-in:** → description, repeated | NIT (IMPORTANT in long-form marketing) | Convert to prose, or to a plain parallel list without bold lead-ins |
| **AIW-15** | Spaced em dashes | " — " used as a comma/colon substitute, esp. 3×+ in a paragraph | NIT (only with another family) | Use comma, colon, parentheses, or unspaced em dash per house style |
| **AIW-16** | Unusual tiny table | a 2–3 row table for facts that belong in a sentence | NIT | Convert to prose |
| **AIW-17** | Curly quotes/apostrophes | " " ' ' where house style is straight, esp. mixed with straight | NIT (BLOCKER if a brand/code surface bans them) | Normalize to the surface's required quote style |
| **AIW-18** | Markdown/markup leakage | literal `##`, `**`, `-`, ```` ``` ```` rendering as visible chars on a non-Markdown surface | BLOCKER | Strip the markup; produce the surface's native format |
| **AIW-19** | Assistant / collaborative-comm leakage | "Certainly!," "I hope this helps," "Would you like…," "Let me know," "Here is a…" | BLOCKER | Delete entirely — it is chatbot chrome, never copy |
| **AIW-20** | Knowledge-cutoff / missing-source disclaimer | "as of my last knowledge update," "details are limited," "maintains a low profile" | BLOCKER | Delete; replace with a known fact or omit the point |
| **AIW-21** | Placeholder / template text | `[Your Name]`, `[link…]`, `INSERT_…`, `PASTE_…_HERE`, `2025-XX-XX` | BLOCKER | Fill it in or remove; never ship a slot |
| **AIW-22** | Chatbot link fingerprint | `utm_source=chatgpt.com` / `=openai` / `=copilot.com`, `referrer=grok.com` in any URL | BLOCKER | Strip the tracking param; verify the link actually supports the claim |

### Do-not-flag list (false-positive guard)

Never raise a finding on these **alone** (they pass the confidence gate only in
combination): perfect grammar; formal or academic tone; one transition word; one
em dash; one curly quote; mixed casual/formal register; letter-style salutation;
plain `is`/`has`; true superlatives; ordinary hedges (*perhaps*, *tends to*).
Flagging these in isolation is the failure mode the source guide warns about most.

### AI-vocabulary word list (the AIW-01 set)

Replace with the plain word; **delete** if it carries no meaning. The set is
era-tagged because the tells rotate as models change — weight recent eras more.

- **Core (all eras):** crucial, pivotal, vital, key (adj), robust, seamless,
  vibrant, rich, enduring, intricate / intricacies, meticulous / meticulously,
  testament, tapestry (figurative), landscape (figurative), realm, interplay,
  valuable, profound, comprehensive, holistic.
- **Verbs:** delve, leverage, harness, underscore, highlight, emphasize, showcase,
  foster, enhance, boast (= has), garner, bolster, align with, elevate,
  supercharge, streamline, revolutionize, transform, empower, unlock, navigate
  (figurative), embark on.
- **Connectives / openers:** Additionally (sentence-start), Moreover, Furthermore,
  Notably, Consequently, "It's worth noting that," "In today's …."
- **Era weighting** (from the source's frequency study):
  - 2023–mid-2024 (GPT-4): delve, boasts, bolstered, intricate, tapestry, testament, meticulous, garner, Additionally.
  - mid-2024–mid-2025 (GPT-4o): align with, fostering, showcasing, highlighting, enhance, pivotal, underscore, vibrant.
  - mid-2025+ (GPT-5): emphasizing, enhance, highlighting, showcasing + the notability/attribution words (AIW-03).
  - Grok-specific: causal, empirical, correlate, "X rather than Y," and still *underscore*.
- **In comments/feedback copy:** "concrete" as an adjective ("concrete evidence,"
  "concrete examples").

Projects may extend or override this list in `CLAUDE.md`. A documented brand word
(e.g. a product genuinely named "Tapestry") is never a hit.

---

## Changelog

- 2026-06-26 — AIW-10: mirror the empty-vs-concrete discriminator onto rule of
  three. Only interchangeable filler triads are a tell; triads with distinct
  concrete members (escalating definitions, anaphora) are deliberate rhetoric.
  Surfaced across three Evalgist blog/guide pages whose signature voice uses
  concrete triads the count-based rule would over-fire on.
- 2026-06-26 — AIW-09: add empty-vs-concrete discriminator. Negative parallelism
  is a tell only when the affirmative half is generic; concrete antithesis is
  human rhetoric and must not be flagged on density alone (esp. how-to / "avoid
  these traps" genres). Surfaced by a smoke test on a contrast-heavy Evalgist
  guide where the density rule would otherwise have over-fired.
- 2026-06-26 — Initial KB. Distilled from Wikipedia:Signs of AI writing
  (WikiProject AI Cleanup). Part A summary of all signal families; Part B 22-rule
  ruleset with confidence gate, severities mapped to the suite model, the AI-vocab
  word list with era weighting, and the false-positive do-not-flag guard.
