---
name: analytics-plan
description: >
  Use when the user wants to design, plan, or document Google Analytics 4
  (GA4) instrumentation for an app — "add GA4", "set up Google Analytics",
  "what should we track", "measure feature usage", "add telemetry", "wire
  up GTM", "server-side GA4", "Measurement Protocol", "decide what to keep
  or drop", "measure adoption". Produces a privacy-first, codebase-anchored
  GA4 instrumentation plan plus a separate setup runbook — never a generic
  event list. Works for client-side, server-side, hybrid, and tag-manager
  setups. Triggers even when the user only says "analytics" if the obvious
  vendor in the codebase is GA4 (gtag.js, GTM container, @google-analytics
  packages, GA4 measurement ids G-XXXX).
---

# GA4 Analytics Instrumentation Planner

You produce GA4 plans an engineer can implement without follow-up questions,
that a privacy reviewer can sign off, and that survive the app growing. You
do NOT write generic "track button clicks" lists. Every plan is grounded in
(a) the actual product surface, (b) a stated decision the data must drive,
(c) the real codebase (file:line anchors), and (d) the live GA4 / GTM /
Measurement Protocol docs.

This skill is dual-output by design: a **design plan** (the *why*) and a
**setup runbook** (the *how*). They never live in the same file — they
drift if you merge them.

## 0. First principles (non-negotiable)

1. **Tie every event to a decision.** Before listing anything, ask: "What
   keep / improve / drop / prioritize decision will this data drive?" If an
   event answers no decision, don't collect it. This is both data
   minimization (privacy) and anti-bloat.
2. **Never trust analytics folklore — validate against GA4's live docs.**
   GA4 behavior changes and is widely misremembered. Verify, with
   citations, every claim about: reserved vs recommended event names,
   `gtag.js` vs Measurement Protocol shape, currency/units rules,
   parameter limits (name/value length, params-per-event, custom-dimension
   caps), identity/session semantics, Consent Mode v2 requirements,
   beacon/header constraints, region/data-residency reality, deletion APIs.
   Mark each claim CONFIRMED / REFUTED / PARTIAL / NOT-FOUND with a source
   URL. Do not repeat a claim you couldn't verify. See
   [references/ga4-event-schema.md](references/ga4-event-schema.md) for
   the live caps and reserved-name table to compare against.
3. **Anchor to the real codebase.** Read the source. Cite `file:line` for
   every place an event fires, every route, every migration, every config
   touch. A plan that wasn't written with the source tree open is a guess.
4. **Privacy is the floor, not a feature.** No raw email/name/IP/free-text/
   tokens ever reach Google. Maintain an explicit forbidden-keys list
   (exact names + suffix/prefix wildcards + value-shape regexes for emails,
   URLs, tokens). Scrub at the source AND at the processing layer (defense
   in depth). See [references/privacy-consent.md](references/privacy-consent.md)
   for the GDPR/COPPA/Consent-Mode-v2 floor and the forbidden-keys starter.
5. **Push back on disproportion.** If a GTM + server-side container + BigQuery
   export apparatus is heavier than the app or audience warrants, say so
   plainly and name the lighter alternative (gtag.js direct, or even
   Plausible/PostHog) before building. Record the decision in the plan.
   Don't gold-plate; don't silently comply with over-engineering.

## 1. Process

Run these in order. On Claude Code, dispatch subagents (via the `Explore`
or `general-purpose` subagent types, or `superpowers:dispatching-parallel-agents`)
for breadth so the main context stays clean. On Codex or other harnesses
without subagents, run each step inline but keep notes terse — context is
the constraint.

### 1.1. Clarify the goal (use `superpowers:brainstorming` if available)

Rewrite the vague ask ("add analytics") into the specific decisions the
data must drive. Examples:

- "which features are used vs dead, to decide what to drop"
- "where does the signup funnel leak"
- "which locales to keep translating"
- "did the redesign change engagement"

Capture: audience (minors? EU? B2B?), the GA4 property type (web stream,
app stream, both), existing infrastructure (GTM container? gtag.js?
server-side GTM? BigQuery export?), and any hard architectural constraints
(server-side-only? no client JS? privacy-by-default?).

### 1.2. Enumerate the product surface

Explore the codebase and list EVERY trackable surface — don't rely on
memory. See [references/surface-checklist.md](references/surface-checklist.md)
for the full inventory. At minimum cover:

- page/screen views (logical names, not just URLs)
- auth (signup, login, logout, failure, password reset, MFA)
- core CRUD for each domain object
- search/filter/sort interactions
- funnels (multi-step flows: checkout, onboarding, upgrade)
- settings/preferences toggles
- sharing/invites
- navigation (primary menu items, nav drawer)
- errors (server 5xx/4xx, client `onerror`, unhandled rejections)
- performance (latency, Core Web Vitals, slow queries)
- background/cron jobs (when the work the user requested completes)
- lifecycle moments (first-run, activation, retention triggers)

Map each surface to a decision from 1.1. Surfaces with no decision: cut.

### 1.3. Design the schema

Define a normalized internal event shape:

```
{ name, category, action, label, logical_page, ids, consent, properties, server_timestamp }
```

Then define how the GA4 `event_name` is derived — prefer GA4's
recommended-event names where they exist (`sign_up`, `login`, `search`,
`select_content`, `share`, `view_item`, `purchase`, `refund`, etc.) so
GA4's built-in reports populate. Keep original fields as event parameters
— don't collapse everything into one opaque `event_name`. The reserved
and recommended event tables live in
[references/ga4-event-schema.md](references/ga4-event-schema.md).

### 1.4. Identity & sessions

Anonymous visitor id (server-minted, documented format) plus a stable
authenticated `user_id` that is **hashed AND peppered** — plain SHA-256
of an email is reversible with a user list, so treat as pseudonymous
personal data. State exactly which events carry `user_id` and when it's
cleared (logout, account deletion).

Don't assume GA4 auto-attaches `ga_session_id` for server-side
Measurement Protocol calls — it does not, you must mint and forward it.
See [references/identity-sessions.md](references/identity-sessions.md).

### 1.5. Choose the architecture deliberately

The three patterns and when each is right:

- **gtag.js client-side** — fastest to ship, full Consent Mode support out
  of the box, modeled-conversion-friendly. Loses data to ad blockers and
  to users who deny consent.
- **Measurement Protocol server-side** — bypasses ad blockers, lets you
  enrich events with server-only context (real user-agent, real geo, true
  duration), but requires you to mint `client_id`/`session_id` yourself
  and loses GA4's automatic enhanced-measurement events.
- **Server-side GTM (sGTM)** — hybrid: client sends to your domain, your
  sGTM container forwards to GA4. Best privacy posture, highest ops cost.

State the trade-off out loud (cost, latency, privacy, modeled-conversion
loss, ops toil). See [references/gtm-and-tagging.md](references/gtm-and-tagging.md)
and [references/ga4-server-side.md](references/ga4-server-side.md) for the
full decision matrix.

If sending server-side, **never block the request path**. Use a bounded
queue + workers with explicit drop-on-overflow, fail silent for users, log
failures without PII.

### 1.6. Consent & legal (scale to the audience)

Consent model + defaults (deny-by-default in the EU under Consent Mode v2),
equal-prominence reject button, the exact gate logic. For minors: a hard
**server-side** disable, not just a client toggle. For richer data: DPIA,
processor agreement, RoPA entry, privacy-policy update, data-subject
erasure pipeline (User Deletion API + downstream stores like BigQuery
export), data-residency reality (GA4 ingest region vs Google's global
infra — don't overclaim "EU-only"). Full floor in
[references/privacy-consent.md](references/privacy-consent.md).

### 1.7. Reporting config — dimensions vs metrics

Numeric values you aggregate (durations, counts, scores) are **metrics**
(with units); categorical values you group/filter by are **dimensions**. A
parameter is usually one or the other — pick deliberately. List what to
register as custom definitions, what NOT to register (GA4 built-ins;
high-cardinality ids that blow up GA4's cardinality limits and produce
"(other)" rows), the scope (event vs user), and stay under GA4's caps.
The current caps and decision rules live in
[references/reporting-config.md](references/reporting-config.md).

### 1.8. Reserve, don't build, the future

If real ecommerce/payments may come later, reserve the GA4-standard schema
(`purchase` / `refund`, ISO-4217 `currency`, idempotent `transaction_id`,
`value` = Σ `items[].price * items[].quantity`) as a **documented-but-
inactive** category — kept out of the live allowlist until it ships. Flag
the reservation as deliberate future-proofing, docs-only. Cheap. Stops
someone bolting `currency: "POINTS"` onto a non-revenue event later and
polluting Monetization reports.

### 1.9. Multi-pass review before finalizing

Run independent review passes. On Claude Code use parallel subagents; on
Codex run sequentially. Cover:

- **(a) GA4 correctness** — every reserved/recommended name, every param
  cap, every Consent Mode v2 claim cited against the live docs.
- **(b) Privacy/legal** — forbidden-keys list complete, hashing peppered,
  deletion pipeline real, residency claim accurate.
- **(c) Data coverage gaps** — what's collectable server-side that's
  being missed? (device from UA, geo from IP, referrer/UTM, real page
  URL, language, latency, error class, request id.)
- **(d) Codebase fit** — do the `file:line` anchors actually exist? Do
  proposed patterns match existing project conventions, deps, lint rules?

Fix every finding before finalizing. Note the corrections in a revision
header.

### 1.10. Split design from runbook

The **plan** documents the WHY (decisions, schema, rationale, anchors).
The **runbook** documents the HOW (GA4 admin click-paths, GTM container
config, Measurement Protocol curl examples, registration tables, exact
values to paste). Each owns its content — no duplication, or they drift.
Templates live in [assets/plan-template.md](assets/plan-template.md) and
[assets/runbook-template.md](assets/runbook-template.md).

### 1.11. Make it durable (instrumentation contract)

Add an instrumentation contract: every future feature must emit its event
in the same PR (typed properties, no free text, i18n-safe, a test, a
taxonomy-doc row). Enforce by a CI drift check:

- every state-changing route emits an event or appears in an allowlist
- code event names == documented event names (no drift)
- forbidden-keys regex sweep on captured payloads in CI

State the source-of-truth lifecycle: the plan in `docs/agents/features/`
during design and launch → migrates to a permanent product doc afterward.

### 1.12. Verification (checkbox, not vibes)

See [superpowers:verification-before-completion]. Each criterion is a
checkbox the implementer ticks:

- [ ] PII sweep of captured payloads — no forbidden keys leak
- [ ] Exactly-one-event assertions on critical funnels (no double-fire)
- [ ] Consent denied → zero hits to `google-analytics.com` and `analytics.google.com`
- [ ] Network failure → UX still works (fail silent)
- [ ] `user_id` stitches across anonymous → authenticated session
- [ ] Every registered custom dimension/metric populates in GA4 DebugView
  within 60s of a test event
- [ ] Realtime report shows the test event with all expected params

## 2. Output

Produce **two artifacts**, separately, in the project's existing docs tree
(`docs/agents/features/PLANNED-ga4-instrumentation.md` plus a sibling
`runbook` artifact, following `docs/agents.md` naming if that file
exists). Use the templates:

- **Design plan** (the why): `assets/plan-template.md`
  Includes: goal & decisions, schema, identity, architecture, consent/legal,
  full event catalog (table: name | category | action | trigger/anchor |
  properties | consent gate), reporting-config intent, codebase `file:line`
  anchor table, implementation order (one commit per step), verification
  checklist, risks/open questions, deliverables.

- **Setup runbook** (the how): `assets/runbook-template.md`
  Includes: GA4 property creation steps, data stream setup, GTM container
  config, server-side endpoint setup (if applicable), custom-definition
  registration table, Consent Mode v2 config, debug & validation steps.

Keep a **revision header** at the top of each: what changed between
passes. Plans that don't track their own revisions get re-litigated.

If `superpowers:writing-plans` is available, use it to produce the
implementation plan section; the GA4 design content above is the input
to that plan, not a replacement for it.

## 3. Anti-patterns (reject these)

- A flat list of events with no decision behind them.
- Generic `snake_case` names that ignore GA4's recommended names — losing
  the built-in funnel, retention, and monetization reports.
- Free-text, URLs, or tokens in event parameters.
- Synthetic `currency: "USD"` + `value: 0` on non-revenue events. Pollutes
  Monetization reports forever; GA4 won't let you "untag" historical data.
- Plan written without reading the source; `file:line` anchors that don't
  exist or point to the wrong line.
- "Trust me, GA4 does X" with no doc citation. Vendor behavior changes —
  always link.
- Heavy infra (sGTM + BigQuery + Looker) proposed without naming the
  lighter alternative and the cost delta.
- Mixing the why-doc and the how-runbook into one drifting file.
- High-cardinality dimensions (`user_id`, `order_id`, `session_id` as a
  custom dimension) that hit GA4's cardinality limit and collapse into
  `(other)`.

## 4. When to escalate, not plan

Stop and ask the user before producing a plan if any are true:

- The product targets children under 13 (US COPPA) or under 16 (some EU
  states) — a templated plan is unsafe; this needs counsel.
- The repo shows no GA4 / GTM / `gtag` artifacts and the user hasn't said
  GA4 is the choice. Confirm vendor first; don't assume.
- The user wants to track health data (HIPAA), education records (FERPA),
  or financial transactions in regulated jurisdictions. Escalate.
- Existing analytics already ship and the user is asking for a migration,
  not a greenfield plan. The migration risks (data discontinuity, breaking
  saved reports, audience-rebuild time) are different work.

## 5. Reference files

Read these only when the relevant step needs the detail — they exist so
this SKILL.md stays under 500 lines and the always-loaded context stays
clean.

- [references/ga4-event-schema.md](references/ga4-event-schema.md) —
  reserved & recommended event names, parameter caps, naming rules, the
  validation script's checklist.
- [references/ga4-server-side.md](references/ga4-server-side.md) —
  Measurement Protocol payload shape, `client_id` / `session_id` minting,
  retry & queue patterns, debug endpoint.
- [references/gtm-and-tagging.md](references/gtm-and-tagging.md) — when
  to use GTM web vs server-side GTM vs neither; container hygiene; tag
  sequencing.
- [references/privacy-consent.md](references/privacy-consent.md) —
  Consent Mode v2, GDPR floor, COPPA disable, forbidden-keys starter list,
  scrubbing patterns, deletion pipeline.
- [references/identity-sessions.md](references/identity-sessions.md) —
  hashing + peppering, anonymous-to-authenticated stitching, session
  semantics in client vs server contexts.
- [references/reporting-config.md](references/reporting-config.md) —
  dimensions vs metrics decision rule, GA4 custom-definition caps,
  cardinality traps, scope choice (event vs user).
- [references/surface-checklist.md](references/surface-checklist.md) —
  the full trackable-surface inventory, for step 1.2.

## 6. Output templates

- [assets/plan-template.md](assets/plan-template.md) — the design plan
  skeleton with revision header, every required section, and prompts that
  fail loudly if you skip a step.
- [assets/runbook-template.md](assets/runbook-template.md) — the GA4 +
  GTM setup runbook skeleton with click-path placeholders and validation
  steps.
- [assets/forbidden-keys.md](assets/forbidden-keys.md) — starter list of
  parameter names and value-shape regexes that must never leave the
  process boundary.
