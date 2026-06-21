---
name: google-analytics-implementation-planner
description: >
  Use when the user wants to add, design, audit, review, or document
  production analytics for a real codebase and the implementation target is
  Google Analytics 4, Firebase Analytics SDK app streams, Google Tag
  Manager, server-side GTM, or Measurement Protocol: "add analytics",
  "add GA4", "set up Google Analytics", "what should we track",
  "traffic-source reporting", "feature usage measurement", "funnel
  analysis", "adoption tracking", "telemetry", or "product tracking".
  Also trigger for broader analytics asks mentioning
  Segment, PostHog, Plausible, or similar tools so you can confirm vendor
  scope, but do not produce non-GA4 implementation plans from this skill.
  Produces a privacy-first, codebase-anchored GA4 instrumentation design
  plan, separate setup runbook, durable analytics contract, and future
  feature rule — never a generic event list.
---

# Google Analytics Implementation Planner

You produce GA4 plans an engineer can implement without follow-up questions,
that a privacy reviewer can sign off, and that survive the app growing. You
do NOT write generic "track button clicks" lists. Every plan is grounded in
(a) the actual product surface, (b) a stated decision the data must drive,
(c) the real codebase (file:line anchors), and (d) the live GA4 / GTM /
Measurement Protocol docs.

This skill separates decisions, configuration, and post-launch rules:
**design plan** (why + implementation order), **setup runbook** (how),
**durable analytics contract** (future feature work), and, when requested,
an **MCP execution spec** (machine-readable desired state for a separate
MCP server).

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
   beacon/header constraints, region/data-residency reality, Admin API
   user-deletion behavior.
   Mark each claim CONFIRMED / REFUTED / PARTIAL / NOT-FOUND with a source
   URL. Do not repeat a claim you couldn't verify. See
   [references/ga4-event-schema.md](references/ga4-event-schema.md) for
   the live caps and reserved-name table to compare against.
3. **Anchor to the real codebase.** Read the source. Cite `file:line` for
   every place an event fires, every route, every migration, every config
   touch. A plan that wasn't written with the source tree open is a guess.
4. **Privacy is the floor, not a feature.** No raw email/name/IP/free-text/
   tokens, or explicit IP/user-agent/referrer params reach Google. Browser
   and app SDKs can still transmit passive headers and connection metadata;
   document vendor behavior instead of overclaiming "nothing leaves." Maintain
   an explicit forbidden-keys list (exact names + suffix/prefix wildcards +
   value-shape regexes for emails, URLs, tokens). Scrub at the source AND at
   the processing layer (defense in depth). See
   [references/privacy-consent.md](references/privacy-consent.md) for the
   GDPR/COPPA/Consent-Mode-v2 floor and the forbidden-keys starter.
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

Capture: audience (minors? EEA/UK/Switzerland? B2B?), target GA4
property (or the need to create a new one), data streams (web, app, or
both), whether GTM web will be used (why, owner, container), other
infrastructure (gtag.js, Firebase SDK, sGTM, BigQuery), and hard
constraints (server-side-only? no client JS? privacy-by-default?).

If the user has not supplied a target GA4 property, make the setup
runbook create a new GA4 property and the required data stream. Do not
use Universal Analytics "profile" terminology. For web/GTM setup, ask
for the web data stream's Measurement ID / Google tag ID (`G-...`) before
producing paste-ready Google tag or GTM tag instructions; if the property
will be created during setup, leave an explicit `G-...` placeholder and a
step to copy the generated Measurement ID. Classic GTM web configuration
does not need a `web_stream_id`; use stream resource ids only when Admin
API automation explicitly modifies stream-level settings.

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
- GTM web/sGTM behavior, clients, tags, transformations, dataLayer contract
- recommended, automatically collected, and reserved event names
- identity, session, `client_id`, `user_id`, and consent rules
- event/parameter limits, custom definitions, metrics, and retention
- deletion APIs, region/data-residency statements, and BigQuery export
- ecommerce rules, including `items[]`, `transaction_id`, `currency`, and
  `value`

Mark claims CONFIRMED / REFUTED / PARTIAL / NOT-FOUND. If a claim cannot
be verified, do not use it as a requirement.

### 1.4. Design the event envelope

Define one canonical event envelope before any GA4/GTM mapping:
`trigger: "userevent"`, `event_type: "pageview" | "event"`,
GA4-native `event_name`, `feature_name` or `screen_name`, `ids`,
`consent`, `userParams`, `eventParams`, and `server_timestamp`. Never
maintain a product/internal event name and rewrite it to GA4 later.

For `event_type: "event"`, `event_name` is the final GA4 event name:
choose a GA4 recommended name where one exists, otherwise document one
custom GA4-safe name. For `event_type: "pageview"`, GA4 receives
`page_view`; page/screen context lives in `userParams`.

Use `feature_name` or `screen_name` for product/surface grouping; do not
use `event_group`. Keep page/user context in `userParams` by default
(`page_name`, `page_location`, `screen_name`); when using GTM, map
URL/path/referrer fields from GTM Built-In Variables and use `page_name`
for the logical page identity. For MCP execution specs, keep GTM
built-ins to the MCP-supported planner-facing list: `Page URL`,
`Page Path`, `Page Hostname`, `Referrer`, and `Event`; never include
`Page Title`. Keep action-specific payload in `eventParams`. Full shape
and validation rules live in
[references/ga4-event-schema.md](references/ga4-event-schema.md).

Before adding a parameter, dataLayer variable, or custom definition,
reuse GA4/GTM built-ins. Do **not** model Universal Analytics fields
(`event_category`, `event_action`, `event_label`). Add only
low-cardinality, context-specific parameters, then register only the ones
needed for reports.

### 1.5. Identity & sessions

Anonymous visitor id (server-minted, documented format) plus a stable
authenticated `user_id` that is **hashed AND peppered** — plain SHA-256
of an email is reversible with a user list, so treat as pseudonymous
personal data. State exactly which events carry `user_id` and when it's
cleared (logout, account deletion).

Don't assume Measurement Protocol can rely on `user_id` alone. Web MP
needs `client_id`; app MP needs SDK-derived `app_instance_id`; session and
engagement params are required for accurate Realtime, engagement, and
session attribution. See
[references/identity-sessions.md](references/identity-sessions.md).

### 1.6. Choose one architecture deliberately

The common patterns and when each is right:

- **gtag.js client-side** — fastest to ship, full Consent Mode support out
  of the box, and the normal path for GA4 automatic collection. Loses
  data to ad blockers and to users who deny consent.
- **Firebase Analytics SDK direct** — default for iOS/Android app streams.
  Gives app automatic collection, app-instance identity, screen reporting,
  and SDK consent controls. Measurement Protocol should augment this path,
  not replace it.
- **GTM web container** — use only when needed. Normal web analytics uses
  one `userevent` dataLayer event name with two filtered reusable
  trigger/tag paths; send one `dataLayer.push` per analytics occurrence,
  not a batch of multiple GA4 events; ecommerce stays separate. The GTM
  Google tag / GA4 Event tags send to the web data stream's Measurement
  ID / Google tag ID (`G-...`), not a GA4 web stream resource id.
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
- `dataLayer.push({ event: 'userevent', trigger: 'userevent',
  event_type: 'pageview' | 'event', event_name, userParams,
  eventParams })` for normal GTM web sends. GTM fires on top-level
  `event`; `trigger` stays in the canonical contract for audit/tests.
  Each push represents one GA4 event occurrence; never batch multiple
  GA4 events into one push.
- Firebase Analytics SDK `logEvent` / `setUserID` / `setConsent` for
  iOS/Android app sends
- `https://www.google-analytics.com/mp/collect?...` with JSON payload for
  Measurement Protocol sends, or
  `https://region1.google-analytics.com/mp/collect?...` when EU regional
  collection is required
- first-party sGTM endpoint path plus the exact client/tag/template config
  when using server-side GTM

For sGTM, distinguish routing Google tags through a first-party tagging
server from sending MP-format backend events to an sGTM Measurement
Protocol client. The latter is not the GA4 MP endpoint and has different
debugging/validation behavior.

State the trade-off out loud (cost, latency, privacy, modeled-conversion
loss, ops toil). See [references/gtm-and-tagging.md](references/gtm-and-tagging.md)
and [references/ga4-server-side.md](references/ga4-server-side.md) for the
full decision matrix.

If sending server-side, **never block the request path**. Use a bounded
queue + worker count + per-send timeout + explicit drop-on-overflow. Fail
silent for users and log failures without PII.

### 1.7. Privacy, consent & legal checklist

Consent model + defaults (deny-by-default in the EEA, UK, and Switzerland
under Google's EU User Consent Policy), equal-prominence reject button, the
exact gate logic. For minors: a hard **server-side** disable, not just a
client toggle. Existing users without age/consent classification default to
analytics-disabled / unclassified until they answer the gate. Default to
**basic consent mode** for strict privacy: consent rejection produces no
third-party analytics send. If the plan chooses advanced consent mode,
state that denied users still send cookieless pings and require explicit
legal/product approval. For apps, document Firebase SDK collection defaults,
`setConsent`, and `setAnalyticsCollectionEnabled` behavior.

No raw email, name, phone, free text, token, full URL query, or explicit
IP/user-agent/referrer params or payload fields leave the app. Define
forbidden keys, wildcard rules, and value-shape regexes. Scrub at the
source and again in the processing layer.

For IP/geo, prefer local enrichment. If IP-like data must leave the app,
truncate precisely in the plan (IPv4 `/24`, IPv6 `/48`, or stricter) and
cite the vendor behavior.

For richer data: DPIA, processor agreement, RoPA entry, privacy-policy
update, data-subject erasure pipeline (Admin API
`properties.submitUserDeletion` plus downstream stores like BigQuery
export), regional-collection reality (regional collection is not an
"EU-only" processing promise). Full floor in
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
that GA4 cannot already answer. For each feature/screen context, list the
context-specific parameters that may need registration. Do not create a
generic category/action/label replacement; create specific dimensions that
answer the decision for that context. Do not bulk-create dimensions from all
available params; >10 custom definitions in a first-pass plan needs an
explicit justification.
The current caps and decision rules live in
[references/reporting-config.md](references/reporting-config.md).

### 1.9. Reserve, don't build, the future

If real ecommerce/payments may come later, reserve the GA4-standard schema
(`purchase` / `refund`, ISO-4217 `currency`, idempotent `transaction_id`,
`value` = Σ discounted `items[].price * items[].quantity` excluding tax
and shipping) as a **documented-but-inactive** category — kept out of the
live allowlist until it ships. Flag the reservation as deliberate
future-proofing, docs-only. Cheap. Stops someone bolting `currency:
"POINTS"` onto a non-revenue event later and polluting Monetization
reports.

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
  If GTM web is used, confirm no normal event requires a per-event GTM
  tag or trigger beyond the approved `userevent` filtered trigger/tag
  paths, and that each `dataLayer.push` represents exactly one analytics
  occurrence.

Fix every finding before finalizing. Note the corrections in a revision
header.

### 1.11. Split decisions, implementation, and configuration

Keep the artifacts separate:

- **Design plan:** decisions, architecture rationale, event envelope,
  event catalog, codebase anchors, and implementation order. Keep
  implementation rationale here because agents need to see why a code
  change exists.
- **Setup runbook:** GA4 Admin, GTM, Measurement Protocol, Firebase, and
  sGTM configuration instructions with exact values to paste. Do not
  duplicate the rationale.
- **Durable analytics contract:** the post-launch source of truth for
  future feature work.
- **MCP execution spec:** optional machine-readable desired state for a
  separate custom GA/GTM MCP server.

Templates live in [assets/plan-template.md](assets/plan-template.md),
[assets/runbook-template.md](assets/runbook-template.md), and
[assets/analytics-contract-template.md](assets/analytics-contract-template.md).
When automation is requested, also use
[assets/mcp-execution-spec-template.yaml](assets/mcp-execution-spec-template.yaml).

### 1.11a. Generate MCP execution spec when automation is requested

If the user wants GA4/GTM configuration to be applied by an MCP server,
generate `docs/agents/features/PLANNED-ga4-instrumentation.mcp-execution.yaml`
from [assets/mcp-execution-spec-template.yaml](assets/mcp-execution-spec-template.yaml).

The MCP spec is machine-readable desired state. It must not contain
rationale. It may only contain approved values from the design plan and
setup runbook: GA4 property placeholders, Measurement ID / Google tag ID,
stream resource placeholders only for explicit stream-level Admin API
operations, GTM account/container placeholders, custom dimensions, custom
metrics, key events, built-in variables, data-layer variables, triggers,
tags, optional server-side GTM settings, validation rules, and publish
gate configuration.

Use concrete schema values wherever the MCP schema requires enums. For
example, `target.environment` must be `dev`, `staging`, or `prod`, not a
combined placeholder string. Target resource ids may remain obvious
placeholder resource names until the operator supplies real values.

Default execution mode is `dry_run`. Publishing must be disabled unless
the user explicitly requests publish after reviewing the diff and preview
validation.

Creating a GTM container version is also a gated step, because it
materializes workspace changes into a container version and removes the
workspace. Do not enable version creation by default.

Do not parse Markdown tables loosely into executable config if the values
are ambiguous. Mark ambiguous values as placeholders and require the final
MCP operator to fill them before apply. Do not put wildcard-style
`eventParams.*`, `userParams.*`, or `<approved_param>` entries into the
executable YAML; create only concrete Data Layer Variables and tag params
approved by the event catalog.

Do not create or modify consent settings unless the design plan explicitly
approves that behavior.

### 1.12. Make it durable (instrumentation contract)

Create or update `docs/README_ANALYTICS.md` using
[assets/analytics-contract-template.md](assets/analytics-contract-template.md).
It is the durable product contract after launch. It must explain how every
future user-visible feature gets measured.

Add a target-repo `AGENTS.md` rule: every user-visible feature change must
include analytics impact: `trigger`, `event_type`, `event_name` where
applicable, `feature_name` or `screen_name`, typed params, tests,
taxonomy doc update, predefined-dimension check for any new custom
definition, and vendor/runbook updates when relevant. The rule must ban
bulk custom-dimension creation and boolean presence dimensions such as
`*_exists` / `has_*`, and it must ban `event_group` as the taxonomy
field.

Enforce by CI drift checks:

- every state-changing route emits an event or appears in an allowlist
- code event envelopes match the taxonomy exactly
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
- [ ] Internal contract and GTM dataLayer payloads use
      `event: "userevent"` where GTM is used, plus
      `trigger: "userevent"` and `event_type: "pageview" | "event"`
- [ ] GTM web sends one `dataLayer.push` per analytics occurrence; no
      push batches multiple GA4 events.
- [ ] `event_name` is already the GA4 event name; no internal-to-GA4
      rewrite table exists
- [ ] No `event_group` or `ga4_event_name` field appears in new payloads
- [ ] Page/screen context is grouped in `userParams` with
      GA4/GTM-compatible keys
- [ ] Vendor sends use native mapped shapes (`gtag`, Firebase SDK, MP,
      or sGTM) and do not leak internal-only fields.
- [ ] Exactly-one-event assertions on critical funnels (no double-fire)
- [ ] Network failure → UX still works (fail silent)
- [ ] `user_id` stitches across anonymous → authenticated session
- [ ] Every registered custom dimension/metric populates in GA4 DebugView
  or equivalent within 60s of a test event
- [ ] Realtime report shows the test event with all expected params

## 2. Output

Produce the design plan and setup runbook separately in the project's
existing docs tree (`docs/agents/features/PLANNED-ga4-instrumentation.md`
plus a sibling `runbook` artifact, following `docs/AGENTS.md` if it
exists), then create/update `docs/README_ANALYTICS.md` and the target
repo `AGENTS.md` analytics-impact rule. If the user asks for
automation/MCP/configuration execution, also produce the optional MCP
execution spec as a sibling `*.mcp-execution.yaml` artifact.

- **Design plan:** use `assets/plan-template.md` for the why,
  architecture, event catalog, code anchors, implementation order,
  verification, risks, and deliverables.
- **Setup runbook:** use `assets/runbook-template.md` for GA4 Admin,
  GTM/Firebase/MP/sGTM configuration, custom definitions, consent setup,
  debug, validation, operations, and rollback.
- **Durable contract:** use `assets/analytics-contract-template.md`.
- **MCP execution spec, when automation is requested:** use
  `assets/mcp-execution-spec-template.yaml` for the machine-readable
  desired state.

Keep a **revision header** at the top of each: what changed between
passes. Plans that don't track their own revisions get re-litigated.

If `superpowers:writing-plans` is available, use it to produce the
implementation plan section; the GA4 design content above is the input
to that plan, not a replacement for it.

## 3. Anti-patterns (reject these)

- Events without decisions; plans without source anchors; claims without
  vendor citations.
- Product/internal event names rewritten to GA4 later. Pick GA4
  `event_name` once.
- `event_group`, `ga4_event_name`, or Universal Analytics-style
  `event_category`, `event_action`, `event_label`.
- Generic custom-dimension tables, boolean presence flags (`*_exists`,
  `has_*`), high-cardinality ids, or predefined GA4/GTM duplicates.
- Free-text, URLs, or tokens in event parameters.
- Synthetic `currency: "USD"` + `value: 0` on non-revenue events. Pollutes
  Monetization reports forever; GA4 won't let you "untag" historical data.
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
- MCP specs with secrets or real API secret values.
- MCP specs that enable publish or GTM container-version creation by
  default.
- MCP specs that invent events not present in the approved event catalog.
- MCP specs that require one GTM trigger/tag per normal product event.
- MCP specs that require `web_stream_id` for classic GTM web setup.
- MCP specs that modify consent settings without explicit approval.
- MCP specs that store full URLs with query strings as event parameters.

## 4. When to escalate, not plan

Stop and ask the user before producing a plan if any are true:

- The product targets children under 13 (US COPPA) or under 16 (some EU
  states) — a templated plan is unsafe; this needs counsel.
- The repo shows no GA4 / GTM / `gtag` artifacts and the user hasn't said
  GA4 is the choice. Confirm vendor first; don't assume.
- The user wants to track health data (HIPAA), education records (FERPA),
  or financial transactions in regulated jurisdictions. Escalate. Google
  Analytics does not offer a HIPAA BAA; HIPAA-regulated entities must not
  expose PHI to GA.
- Existing analytics already ship and the user is asking for a migration,
  not a greenfield plan, and the migration goal/source of truth is unclear.
  If the user has named a specific gap (for example, Stripe purchases
  missing from an existing gtag.js property), first state migration risks,
  then produce a migration plan with continuity, validation, and rollback
  steps.

## 5. Reference files

Read only the relevant detail:

- [references/ga4-event-schema.md](references/ga4-event-schema.md) —
  event envelope, reserved/recommended names, caps, naming, validation.
- [references/ga4-server-side.md](references/ga4-server-side.md) —
  Measurement Protocol shape, ids/sessions, retries, debug endpoint.
- [references/gtm-and-tagging.md](references/gtm-and-tagging.md) —
  GTM/sGTM choice, dataLayer contract, hygiene, tag sequencing.
- [references/privacy-consent.md](references/privacy-consent.md) —
  Consent Mode v2, GDPR/COPPA floor, forbidden keys, deletion.
- [references/identity-sessions.md](references/identity-sessions.md) —
  hashing + peppering, stitching, session semantics.
- [references/reporting-config.md](references/reporting-config.md) —
  dimensions vs metrics, caps, cardinality, scopes.
- [references/surface-checklist.md](references/surface-checklist.md) —
  full trackable-surface inventory.
- [references/mcp-automation.md](references/mcp-automation.md) —
  optional MCP execution-spec boundary, allowed/gated actions, and
  default dry-run flow.

## 6. Output templates

- [assets/plan-template.md](assets/plan-template.md) — design plan
  skeleton.
- [assets/runbook-template.md](assets/runbook-template.md) — the GA4 +
  GTM setup runbook skeleton with click-path placeholders and validation
  steps.
- [assets/analytics-contract-template.md](assets/analytics-contract-template.md) —
  durable `docs/README_ANALYTICS.md` skeleton for future feature work.
- [assets/mcp-execution-spec-template.yaml](assets/mcp-execution-spec-template.yaml) —
  optional machine-readable desired-state skeleton for custom MCP
  automation handoff.
- [assets/forbidden-keys.md](assets/forbidden-keys.md) — starter list of
  parameter names and value-shape regexes that must never leave the
  process boundary.
