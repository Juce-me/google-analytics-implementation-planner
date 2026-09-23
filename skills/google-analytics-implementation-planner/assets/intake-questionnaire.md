# Intake questionnaire (blocking)

Every fact in a GA4 plan comes from one of three places: the user's answers, the
repo, or a cited vendor doc. Nothing comes from inference. This questionnaire is
the first of those three.

## How to run it

1. Read the repo first (`AGENTS.md`, `README.md`, `docs/`, existing `gtag` /
   GTM / Firebase artifacts). Anything you can **verify** from the source tree,
   verify — then show it back for confirmation instead of asking blind:
   *"I found `gtag.js` in `app/views/layouts/application.html.erb:14` with
   `G-ABC123`. Is that the target property?"*
2. Ask the remaining questions **one block per message**, in order. Never dump
   all five blocks at once.
3. Skip a question only when its condition is false (marked *conditional*), or
   when the repo already answered it and the user confirmed.
4. Record every answer verbatim in the plan's **§0.5 Intake record**, with its
   source: `user`, `repo:<file:line>`, or `recommended+confirmed`.
5. **Stop when a required answer is missing.** No design plan, no runbook, no
   event catalog, no MCP spec. Say which question is open and wait.

## The three answer states

| State | When | What goes in the record |
| --- | --- | --- |
| Answered | the user stated it | the answer, verbatim |
| Recommended + confirmed | the user said "you decide" / "what do you recommend" | your recommendation, the reason, and the user's explicit confirmation |
| Open | the user genuinely doesn't know yet (legal review pending, property not created) | `OPEN — <question>. Blocks: <what it blocks>.` |

"Recommended + confirmed" is not a guess: you propose, the user agrees, the
record shows both. An unconfirmed recommendation is a guess — it stays `OPEN`.

An `OPEN` item blocks whatever depends on it and nothing else. An open BigQuery
question doesn't block the event catalog; an open audience question blocks
everything. Say which.

**Never write `ASSUMED:`. Never invent** a Measurement ID, property id, container
id, audience classification, consent posture, framework version, or team size. A
plausible-looking `G-XXXXXXX` in a runbook is a defect, not a placeholder —
placeholders must be visibly fake (`G-<paste-from-admin>`) and paired with the
step that fills them.

---

## Block 1 — Goal and decisions (all required)

Without this block every later answer is unanchored, so ask it first and don't
proceed on "we just need analytics".

- **Q1.1** Which keep / improve / drop / prioritize decisions will this data
  drive? Name 3–7. *(Required. Vague goals get rewritten with the user, not by
  the agent: "know our users" → "which of the six features to cut next quarter".)*
- **Q1.2** Who reads the reports, and in what tool — GA4 UI, Looker Studio,
  BigQuery, a weekly slide? *(Required. Determines whether custom definitions or
  an export is the right answer.)*
- **Q1.3** What decision is currently being made blind, and by when? *(Required.
  Gives the implementation order its priority.)*
- **Q1.4** Is anything explicitly out of scope? *(Required. Cheapest question in
  the list.)*

## Block 2 — Audience and legal (all required; contains hard stops)

- **Q2.1** Who are the end users: B2B, B2C, internal? *(Required.)*
- **Q2.2** Do any users reside in the EEA, UK, or Switzerland? *(Required.
  Yes → deny-by-default consent, equal-prominence reject, Consent Mode v2.)*
- **Q2.3** Can users be under 13 (US COPPA) or under 16 (some EU states)?
  *(Required. **Hard stop** if yes or unknown — escalate, don't plan.)*
- **Q2.4** Does the product touch health data, education records, or regulated
  financial transactions? *(Required. **Hard stop** if yes — Google Analytics
  offers no HIPAA BAA; PHI must never reach GA.)*
- **Q2.5** Is there an existing CMP / cookie banner, and who owns it? *(Required.
  Determines whether consent plumbing is a code change or a vendor config.)*
- **Q2.6** Basic or advanced consent mode? *(Required. Default to **basic** for
  strict privacy — denied means no third-party send. Advanced still sends
  cookieless pings from denied users and needs explicit legal/product sign-off.)*

A hard stop means: state the regulatory issue, say what would need to be true to
proceed, and produce no plan. See [../references/privacy-consent.md](../references/privacy-consent.md).

## Block 3 — Platform and stack (required per platform in scope)

Platform is independent of tier: any platform can run at any tier.

- **Q3.1** Which surfaces are in scope: web, iOS/Android app, backend/offline?
  *(Required.)*
- **Q3.2** Web only: framework and version, and which router? *(Required for web.
  Next.js App Router vs Pages Router vs Vite/react-router vs server-rendered
  changes the wiring — see
  [../references/framework-integration.md](../references/framework-integration.md).)*
- **Q3.3** Web only: is navigation a full page load, a History-API SPA, a
  hash router, or Turbo/htmx swaps? *(Required for web. This decides `page_view`
  ownership, the single most common GA4 defect.)*
- **Q3.4** App only: Firebase already integrated? Which SDK wrapper?
  *(Conditional on app in scope.)*
- **Q3.5** Backend only: language/framework, and is there an existing job queue?
  *(Conditional on backend/offline events in scope — the queue is mandatory for
  tier 3.)*
- **Q3.6** Where does authentication happen, and is there a stable internal user
  id to hash and pepper? *(Required if any `user_id` is wanted.)*

## Block 4 — Tier and ownership (all required)

Show the tier table from `SKILL.md` §2 before asking. Recommend one, with the
reason. Then record what the user chose.

- **Q4.1** Which tier: 1 (GA4 direct), 2 (GTM web), or 3 (server-side)?
  *(Required. If the choice is disproportionate to the app or team, say so, name
  the cheaper tier and the cost delta, and record their decision either way.)*
- **Q4.2** Who may change tags after launch — engineering only, or marketing /
  growth without a deploy? *(Required. A "marketing needs it" answer here is the
  only real justification for tier 2.)*
- **Q4.3** Tier 2 only: who owns the GTM container, and who holds publish rights?
  *(Conditional.)*
- **Q4.4** Tier 3 only: who operates the tagging server or the queue, and what is
  the on-call story? *(Conditional. No owner → no tier 3.)*
- **Q4.5** Should GA4/GTM configuration be applied by an MCP server, or by a
  human following the runbook? *(Required. MCP → also produce the execution spec;
  see [../references/mcp-automation.md](../references/mcp-automation.md).)*

## Block 5 — Existing GA4 / GTM state (all required; answers may be "none")

Ask for values, never derive them. "None" is a valid, useful answer — it means
the runbook creates the resource.

- **Q5.1** Target GA4 account and property, or "create a new property"?
  *(Required.)*
- **Q5.2** Web data stream Measurement ID / Google tag ID (`G-...`)? *(Required
  for web. If the property doesn't exist yet, the runbook keeps a visible
  placeholder plus the step that copies the generated id. Never ask for a
  `web_stream_id` for classic GTM web setup.)*
- **Q5.3** App: Firebase project and app id? *(Conditional on app streams.)*
- **Q5.4** Tier 2/3: GTM account, container id, environments? *(Conditional.)*
- **Q5.5** Existing analytics already shipping — GA4, Universal Analytics
  remnants, another vendor? *(Required. Yes → this is a migration: continuity,
  validation, and rollback come before new events.)*
- **Q5.6** BigQuery export wanted or already on? *(Required. Default no.)*
- **Q5.7** Tier 3: where will the Measurement Protocol API secret live?
  *(Conditional. The secret value never enters a plan, runbook, or spec.)*
- **Q5.8** Any hard constraint not covered above — no client JS, CSP rules,
  data-residency commitments, a vendor already contracted? *(Required.)*

---

## Paste this into the plan as §0.5

```markdown
## 0.5 Intake record

Every value below came from the user, the repo, or a confirmed recommendation.
Nothing here was inferred.

| # | Question | Answer | Source |
| --- | --- | --- | --- |
| Q1.1 | Decisions the data must drive | D1 …, D2 …, D3 … | user |
| Q2.2 | EEA/UK/CH users | yes | user |
| Q3.2 | Framework / router | Next.js 15, App Router | repo:package.json:14 |
| Q4.1 | Tier | 2 (GTM web) | user |
| Q5.2 | Measurement ID | `G-<paste-from-admin>` | OPEN — property not created |
| … | … | … | … |

**Open items and what they block**

- Q5.2 — blocks the runbook's tag configuration step only. Catalog and code
  anchors proceed.
```
