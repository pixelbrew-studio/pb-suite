# House review lens — pb-suite knowledge base

A reusable "cold target-user" review lens. Other skills load this and add findings
under a **"House reviewer"** axis: `pb-copy` (copy), `pb-design-review` (UI),
`pb-pop` (page value). It is advisory, not a gate. Severities use the suite model
(BLOCKER / IMPORTANT / NIT).

It is **seeded from a co-founder's** pilot-user feedback on Acme
Shortlist (June 2026) — a co-founder and the canonical *target user* (an episodic
evaluator, no technical background). His reviews are high-signal about product
copy, UX clarity, and "does this earn its place", and low-signal about technical
feasibility. This file captures both, so a skill can apply the eye **and** know
when to push back. The *patterns* generalize to any product; the named surfaces
(Account page, the public marketing site, `/legal/*`) are examples. Per-project
specifics still come from the project `CLAUDE.md` and content-style. Projects can
extend or override this with a `## House reviewer` block in their `CLAUDE.md`.

---

## Part A — What the reviewer flags (the dislikes)

Each is a pattern to detect, with the move the reviewer expects.

| ID | Pattern | How it shows up | Severity | The move |
|----|---------|-----------------|----------|----------|
| **HR-01** | Vanity / context-free aggregate | A number summed across a context the user doesn't act on ("2 shortlisted candidates" across projects; per-criterion counts across candidates). Tell: *"is this summed across X? what's the use?"* | IMPORTANT | Remove it, OR if it has real value at scale, **label its purpose** — never ship a context-free total. |
| **HR-02** | AI-slop / generic copy | Filler, hype, jargon, padded "AI-generated (badly)" text. Tell: *"terrible texts", "bad AI-generated copy"*. | IMPORTANT | Rewrite concrete and sober. Hand to `/pb-copy`. |
| **HR-03** | Redundancy | The same info twice, filler card subtitles, the same links in several places. | NIT (IMPORTANT if it causes confusion) | Cut the duplicate. Keep the *pattern/slot* if it is load-bearing (see CAL-01). |
| **HR-04** | Escape route / stranding | A link that sends a signed-in or in-product user OUT to a general, logged-out, or unfinished surface with no path back. Tell: *"I'm lost", "it takes me to a page where I'm logged out"*. | IMPORTANT | Keep users in product context; link same-domain/in-product; remove links to weak pages until they're fixed. |
| **HR-05** | Inaccurate / non-existent-feature claim | Copy that describes the product wrong, or a capability that doesn't exist. Tell: *"wrong info", "is this real? looks like a feature that doesn't exist"*. | BLOCKER | Verify against the code/product; fix the copy or cut the claim. Never describe non-existent features. |
| **HR-06** | Misplaced compliance / pressure | A legal/compliance claim in casual copy (e.g. "GDPR-compliant" in a friction line), or urgency framing ("prices will rise"). | IMPORTANT (BLOCKER if it overclaims compliance) | Move compliance to the legal/FAQ surface where it's substantiated; drop urgency/pressure tactics. |
| **HR-07** | Confusing wording | A phrase a normal user misreads. Tell: *"I find this confusing"*. | NIT (IMPORTANT if it misleads on price/data) | Reword to the plainest accurate phrasing. |
| **HR-08** | Mislabelled / empty heading | A card/section title that doesn't match its contents. | NIT | Rename to what the section actually contains. |
| **HR-09** | Not self-contained | "Learn more" / "see elsewhere" when the content belongs on this page. | NIT | Put the substance on the page, or drop the pointer. |
| **HR-10** | Single-source-of-truth break | The same document/claim referenced from several places that could drift apart. Rule: *"if you link it in more than one place, it must be the exact same underlying document"*. | IMPORTANT | One canonical source; many links to it are fine, divergent copies are not. |

## Part B — What the reviewer wants (check for the positives)

- **Concrete and actionable.** Says what the user does and what they get, not a slogan.
- **Tight and scannable.** Short label + one-line claim. No filler.
- **Sober tone.** No hype, no superlatives, no urgency.
- **In-context.** The user stays where they are; clear path back; nothing dumps them on a weak or external page.
- **Accurate.** Copy reflects exactly what the product does today.
- **Audience-true.** Speaks to the real target user, not an adjacent enterprise persona.

## Part C — How the reviewer reviews (method, for context)

- Reviews the **live product as a cold user** (fresh eyes get "lost").
- **Screenshots and annotates** ("remove this", circles/arrows).
- Asks **"what's the use?"** — questions a thing's *purpose for a decision*, not just its wording.
- Checks whether a number is a **cross-context aggregate**.
- Demands **accuracy** and flags wrong info hard.
- Usually **proposes a concrete rewrite**, not just a complaint.
- Thinks through **user expectations and edge cases** (e.g. "delete account should mean delete my data", legal retention, future teams/orgs).

## Part D — Calibration: when to push back (the reviewer is non-technical)

Apply the eye, but do **not** apply the proposed fix blindly. Check these before acting:

- **CAL-01 — Delete the content, not the pattern.** Separate redundant *content* from a *useful UI slot*. (A duplicated value in an eyebrow is the problem, not the eyebrow → keep the slot, change the content.)
- **CAL-02 — "What's the use?" can mean "label it", not "delete it".** If a feature is low-value at the test scale but genuinely useful at the product's target scale, state its purpose rather than remove it. Decide on real decision-value at scale.
- **CAL-03 — Don't remove legally-required surfaces.** Acceptance of Terms/Privacy/DPA, company identification, refund-rights wording are legal requirements; "one place / remove it" does not override them.
- **CAL-04 — Don't drop deliberate positioning.** Strategic framing can look like filler. Preserve intentional positioning from the project's canonical docs.
- **CAL-05 — Technical feasibility / architecture.** Some asks aren't advisable: per-product duplicate legal documents (drift/audit risk vs one source + annexes); "delete account = delete all data" ignoring a shared cross-product identity. Reframe to what's correct and explain why.
- **CAL-06 — Verify before agreeing on accuracy.** When the reviewer says "wrong info" or "this feature doesn't exist", confirm against the code — usually right, occasionally the proposed correction introduces its own inaccuracy.

The throughline: **the reviewer is usually right about the symptom (this confuses/strands me, this is filler, what's the use), and the value is in choosing the right fix** — rewrite, relabel, keep-and-explain, or remove — rather than taking the proposed action literally.

---

## Changelog

- 2026-06-27 — Initial lens. Distilled from ~14 pilot-user review tasks on Acme
  Shortlist (entry page, account/settings, dashboard, credits, review surfaces).
