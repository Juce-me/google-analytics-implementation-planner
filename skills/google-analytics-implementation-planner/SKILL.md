---
name: google-analytics-implementation-planner
description: >
  Use when the user wants to add, design, audit, review, or document
  production analytics for a real codebase and the implementation target is
  Google Analytics 4, Google Tag Manager, server-side GTM, or Measurement
  Protocol: "add analytics", "add GA4", "set up Google Analytics", "what
  should we track", "traffic-source reporting", "feature usage
  measurement", "funnel analysis", "adoption tracking", "telemetry", or
  "product tracking". Also trigger for broader analytics asks mentioning
  Segment, PostHog, Plausible, or similar tools so you can confirm vendor
  scope, but do not produce non-GA4 implementation plans from this skill.
  Produces a privacy-first, codebase-anchored GA4 instrumentation design
  plan plus a separate setup runbook — never a generic event list.
---

# Google Analytics Implementation Planner

You produce GA4 plans an engineer can implement without follow-up questions,
that a privacy reviewer can sign off, and that survive the app growing. You
do NOT write generic "track button clicks" lists. Every plan is grounded in
(a) the actual product surface, (b) a stated decision the data must drive,
(c) the real codebase (file:line anchors), and (d) the live GA4 / GTM /
Measurement Protocol docs.

This skill is dual-output by design: a **design plan** (the *why*) and a
**setup runbook** (the *how*). They never live in the same file — they
drift if you merge them.

## Scope guard

This skill is GA4-deep. If the user asks for Segment, PostHog, Plausible,
Amplitude, or a vendor-agnostic CDP plan, first confirm whether GA4/GTM is
still the implementation target. If not, stop and recommend a separate
vendor-specific skill instead of stretching this one.

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
   a simpler non-GA4 product analytics tool) before building. Record the
   decision in the plan without adding non-GA4 implementation details.
   Don't gold-plate; don't silently comply with over-engineering.

## 1. Process

Run these in order. On Claude Code, dispatch subagents (via the `Explore`
or `general-purpose` subagent types, or `superpowers:dispatching-parallel-agents`)
for breadth so the main context stays clean. On Codex or other harnesses
without subagents, run each step inline but keep notes terse — context is
the constraint.

### 1.0. Read project instructions and existing docs first

Before proposing an event, read the target repo's operating instructions
and product context: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`,
`docs/`, architecture docs, existing feature plans, postmortems, analytics
docs, and any current vendor config. Treat those files as requirements.
If they conflict with the user's ask, state the conflict before planning.

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

### 1.2. Required source-inspection checklist

Explore the codebase and list EVERY trackable surface — don't rely on
memory. See [references/surface-checklist.md](references/surface-checklist.md)
for the full inventory. At minimum cover:

- page/screen views (logical names, not just URLs)
- route tables, controller/actions, loaders/actions, API endpoints
- templates/components/screens and forms
- state-changing handlers and mutations
- domain objects and lifecycle transitions
- auth (signup, login, logout, failure, password reset, MFA)
- admin and support flows
- core CRUD for each domain object
- imports, exports, uploads, downloads, integrations, and webhooks
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

### 1.3. Vendor-doc validation checklist

Before locking architecture or schema, re-check current official vendor
docs and cite sources for every claim about:

- ingestion endpoint and URL path
- client payload shape vs Measurement Protocol payload shape
- GTM web and sGTM behavior, clients, tags, and transformations
- recommended, automatically collected, and reserved event names
- identity, session, `client_id`, `user_id`, and consent rules
- event/parameter limits, custom definitions, metrics, and retention
- deletion APIs, region/data-residency statements, and BigQuery export
- ecommerce rules, including `items[]`, `transaction_id`, `currency`, and
  `value`

Mark claims CONFIRMED / REFUTED / PARTIAL / NOT-FOUND. If a claim cannot
be verified, do not use it as a requirement.

### 1.4. Design the schema

Define a normalized internal event shape:

```
{ name, event_group, logical_page, ids, consent, params, server_timestamp }
```

Then define how the GA4 `event_name` is derived — prefer GA4's
recommended-event names where they exist (`sign_up`, `login`, `search`,
`select_content`, `share`, `view_item`, `purchase`, `refund`, etc.) so
GA4's built-in reports populate. Use GA4 event parameters for additional
context. Do **not** model Universal Analytics fields (`event_category`,
`event_action`, `event_label`) in GA4 plans, templates, wrappers, or
future-feature rules. Instead, define low-cardinality, group-specific
parameters such as `feature_area`, `signup_method`, `funnel_step`,
`content_type`, `error_class`, or `search_location`, then register only
the ones needed for reports as custom dimensions/metrics. `event_group`
is a planning/taxonomy field, not a default GA4 parameter to log. The
reserved and recommended event tables live in
[references/ga4-event-schema.md](references/ga4-event-schema.md).

### 1.5. Identity & sessions

Anonymous visitor id (server-minted, documented format) plus a stable
authenticated `user_id` that is **hashed AND peppered** — plain SHA-256
of an email is reversible with a user list, so treat as pseudonymous
personal data. State exactly which events carry `user_id` and when it's
cleared (logout, account deletion).

Don't assume GA4 auto-attaches `ga_session_id` for server-side
Measurement Protocol calls — it does not, you must mint and forward it.
See [references/identity-sessions.md](references/identity-sessions.md).

### 1.6. Choose one architecture deliberately

The three patterns and when each is right:

- **gtag.js client-side** — fastest to ship, full Consent Mode support out
  of the box, and the normal path for GA4 automatic collection. Loses
  data to ad blockers and to users who deny consent.
- **Measurement Protocol augmentation** — sends server/offline events
  into an existing web/app stream, can recover critical events ad
  blockers drop, and can enrich with server-only truth. It requires the
  right surface identifier (`client_id` for web, `app_instance_id` for
  app), manual `session_id`/`engagement_time_msec`, and should augment
  gtag.js/GTM/Firebase rather than replace automatic collection.
- **Server-side GTM (sGTM)** — hybrid: client sends to your domain, your
  sGTM container forwards to GA4. Best privacy posture, highest ops cost.

Pick one concrete architecture. Do not mix incompatible paths, except for
an explicit hybrid where Measurement Protocol augments a client/app stream
for named server/offline events. Distinguish
`gtag.js` / GA4 client traffic from Measurement Protocol traffic and from
custom sGTM clients. Name the exact endpoint/path and payload shape:

- `gtag('event', name, params)` for browser sends
- `https://www.google-analytics.com/mp/collect?...` with JSON payload for
  Measurement Protocol sends
- first-party sGTM endpoint path plus the exact client/tag/template config
  when using server-side GTM

State the trade-off out loud (cost, latency, privacy, modeled-conversion
loss, ops toil). See [references/gtm-and-tagging.md](references/gtm-and-tagging.md)
and [references/ga4-server-side.md](references/ga4-server-side.md) for the
full decision matrix.

If sending server-side, **never block the request path**. Use a bounded
queue + worker count + per-send timeout + explicit drop-on-overflow. Fail
silent for users and log failures without PII.

### 1.7. Privacy, consent & legal checklist

Consent model + defaults (deny-by-default in the EU under Consent Mode v2),
equal-prominence reject button, the exact gate logic. For minors: a hard
**server-side** disable, not just a client toggle. Existing users without
age/consent classification default to analytics-disabled / unclassified
until they answer the gate. Default to **basic consent mode** for strict
privacy: consent rejection produces no third-party analytics send. If the
plan chooses advanced consent mode, state that denied users still send
cookieless pings and require explicit legal/product approval.

No raw email, name, phone, free text, token, full URL query, raw user
agent, or full IP leaves the app. Define forbidden keys, wildcard rules,
and value-shape regexes. Scrub at the source and again in the processing
layer.

For IP/geo, prefer local enrichment. If IP-like data must leave the app,
truncate precisely in the plan (IPv4 `/24`, IPv6 `/48`, or stricter) and
cite the vendor behavior.

For richer data: DPIA, processor agreement, RoPA entry, privacy-policy
update, data-subject erasure pipeline (User Deletion API + downstream
stores like BigQuery export), data-residency reality (GA4 ingest region vs
Google's global infra — don't overclaim "EU-only"). Full floor in
[references/privacy-consent.md](references/privacy-consent.md).

### 1.8. Reporting config — dimensions vs metrics

Numeric values you aggregate (durations, counts, scores) are **metrics**
(with units); categorical values you group/filter by are **dimensions**. A
parameter is usually one or the other — pick deliberately. List what to
register as custom definitions, what NOT to register (GA4 built-ins;
high-cardinality ids that blow up GA4's cardinality limits and produce
"(other)" rows), the scope (event vs user), and stay under GA4's caps.
Start with GA4 predefined dimensions/metrics and recommended-event
parameters; create custom definitions only for decision-backed questions
that GA4 cannot already answer. For each event group, list the
group-specific parameters that may need registration. Do not create a
generic category/action/label replacement; create specific dimensions that
answer the decision for that group. Do not bulk-create dimensions from all
available params; >10 custom definitions in a first-pass plan needs an
explicit justification.
The current caps and decision rules live in
[references/reporting-config.md](references/reporting-config.md).

### 1.9. Reserve, don't build, the future

If real ecommerce/payments may come later, reserve the GA4-standard schema
(`purchase` / `refund`, ISO-4217 `currency`, idempotent `transaction_id`,
`value` = Σ `items[].price * items[].quantity`) as a **documented-but-
inactive** category — kept out of the live allowlist until it ships. Flag
the reservation as deliberate future-proofing, docs-only. Cheap. Stops
someone bolting `currency: "POINTS"` onto a non-revenue event later and
polluting Monetization reports.

### 1.10. Multi-pass review before finalizing

Run independent review passes. On Claude Code use parallel subagents; on
Codex run sequentially. Merge findings into the final plan and note every
correction in a revision header. Cover:

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

### 1.11. Split design from runbook

The **plan** documents the WHY (decisions, schema, rationale, anchors).
The **runbook** documents the HOW (GA4 admin click-paths, GTM container
config, Measurement Protocol curl examples, registration tables, exact
values to paste). Each owns its content — no duplication, or they drift.
Templates live in [assets/plan-template.md](assets/plan-template.md) and
[assets/runbook-template.md](assets/runbook-template.md).

### 1.12. Make it durable (instrumentation contract)

Create or update `docs/README_ANALYTICS.md` using
[assets/analytics-contract-template.md](assets/analytics-contract-template.md).
It is the durable product contract after launch. It must explain how every
future user-visible feature gets measured.

Add a target-repo `AGENTS.md` rule: every user-visible feature change must
include analytics impact: event name, event group, typed params, tests,
taxonomy doc update, predefined-dimension check for any new custom
definition, and vendor/runbook updates when relevant. The rule must ban
bulk custom-dimension creation and boolean presence dimensions such as
`*_exists` / `has_*`.

Enforce by CI drift checks:

- every state-changing route emits an event or appears in an allowlist
- code event names match the taxonomy exactly
- required event params have tests
- forbidden-keys regex sweep on captured payloads in CI

State the source-of-truth lifecycle: the plan in `docs/agents/features/`
during design and launch → migrates to a permanent product doc afterward.

### 1.13. Verification (checkbox, not vibes)

See [superpowers:verification-before-completion]. Each criterion is a
checkbox the implementer ticks:

- [ ] PII sweep of captured payloads — no forbidden keys leak
- [ ] Consent denied → zero third-party analytics sends
- [ ] Minor / age-unclassified user → zero analytics sends
- [ ] Exact event assertions for each critical event and required param
- [ ] Exactly-one-event assertions on critical funnels (no double-fire)
- [ ] Network failure → UX still works (fail silent)
- [ ] `user_id` stitches across anonymous → authenticated session
- [ ] Every registered custom dimension/metric populates in GA4 DebugView
  or equivalent within 60s of a test event
- [ ] Realtime report shows the test event with all expected params

## 2. Output

Produce **two artifacts**, separately, in the project's existing docs tree
(`docs/agents/features/PLANNED-ga4-instrumentation.md` plus a sibling
`runbook` artifact, following `docs/agents.md` naming if that file
exists). Use the templates:

- **Design plan** (the why): `assets/plan-template.md`
  Includes: goal & decisions, schema, identity, architecture, consent/legal,
  full event catalog (table: event name | event group | required params |
  optional/group params | trigger | file/line anchor | server/browser side |
  decision/use), reporting-config intent, codebase `file:line` anchor
  table, implementation order (one commit per step), verification checklist,
  risks/open questions, deliverables.

- **Setup runbook** (the how): `assets/runbook-template.md`
  Includes: GA4 property creation steps, data stream setup, GTM container
  config, exact server-side endpoint/path and payload shape (if
  applicable), custom-definition registration table, Consent Mode v2
  config, debug & validation steps.

Also create or update:

- **Durable analytics contract:** `docs/README_ANALYTICS.md`, from
  `assets/analytics-contract-template.md`.
- **Agent rule:** target repo `AGENTS.md`, requiring future feature work
  to update analytics taxonomy, tests, and vendor/runbook docs.

Keep a **revision header** at the top of each: what changed between
passes. Plans that don't track their own revisions get re-litigated.

If `superpowers:writing-plans` is available, use it to produce the
implementation plan section; the GA4 design content above is the input
to that plan, not a replacement for it.

## 3. Anti-patterns (reject these)

- A flat list of events with no decision behind them.
- Generic `snake_case` names that ignore GA4's recommended names — losing
  the built-in funnel, retention, and monetization reports.
- Universal Analytics-style `event_category`, `event_action`, or
  `event_label` parameters. GA4 plans use event names plus specific event
  parameters/custom definitions.
- A "register everything" custom-dimension table, especially one that
  approaches GA4's 50 event-scoped dimension cap without proving each
  dimension beats a predefined GA4 dimension/metric.
- Boolean presence flags like `geo_exists`, `has_referrer`, or
  `search_has_results`. Represent missing data as null/omitted in the
  contract and use meaningful values such as `geo`, `referrer_domain`, or
  `result_count_bucket`.
- Free-text, URLs, or tokens in event parameters.
- Synthetic `currency: "USD"` + `value: 0` on non-revenue events. Pollutes
  Monetization reports forever; GA4 won't let you "untag" historical data.
- Plan written without reading the source; `file:line` anchors that don't
  exist or point to the wrong line.
- "Trust me, GA4 does X" with no doc citation. Vendor behavior changes —
  always link.
- Heavy infra (sGTM + BigQuery + Looker) proposed without naming the
  lighter alternative and the cost delta.
- Vague sGTM "transformations" that are not executable client/tag config,
  custom template code, or an explicit first-party endpoint contract.
- Mixing the why-doc and the how-runbook into one drifting file.
- Saying future features need analytics without updating `AGENTS.md`,
  `docs/README_ANALYTICS.md`, and CI drift checks.
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
  not a greenfield plan, and the migration goal/source of truth is unclear.
  If the user has named a specific gap (for example, Stripe purchases
  missing from an existing gtag.js property), first state migration risks,
  then produce a migration plan with continuity, validation, and rollback
  steps.

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
- [assets/analytics-contract-template.md](assets/analytics-contract-template.md) —
  durable `docs/README_ANALYTICS.md` skeleton for future feature work.
- [assets/forbidden-keys.md](assets/forbidden-keys.md) — starter list of
  parameter names and value-shape regexes that must never leave the
  process boundary.
