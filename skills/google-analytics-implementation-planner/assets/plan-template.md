Status: planned
Type: feature
Author: <your-handle>

# Google Analytics Implementation — Design Plan

## Revision history

| Date | Pass | Author | What changed |
| --- | --- | --- | --- |
| YYYY-MM-DD | 1 | <handle> | Initial draft |

> Add a row per review pass. Plans that don't track their own revisions
> get re-litigated.

## 0. TL;DR

Two paragraphs max. What we'll track, why, what we'll deliberately not
track. The reader who reads only this should know whether to read on.

**Artifact boundary:** this plan owns decisions, event taxonomy, code
anchors, and implementation order. GA4 Admin, GTM, Firebase, Measurement
Protocol, and sGTM configuration click-paths live in the setup runbook.

## 1. Goal & decisions

What product/business decisions will this data drive? List 3–7. Each
will get one or more events. If a question can't be made concrete, cut
it.

- D1. <decision> — e.g., "Which features are used vs dead, to decide
      what to drop in the next refactor."
- D2. <decision>
- D3. <decision>

**Audience constraints:** EEA/UK/Switzerland / B2B / B2C / other
non-regulated audience.
If the product targets children, health data, education records, or
regulated finance, stop before using this template and escalate.

**Vendor context:** GA4 property type (web / app / both), existing GTM,
existing BigQuery export, paid acquisition budget. This determines the
architecture in §2.

**GTM web decision:** <yes/no>. If yes: why GTM is needed, who owns
container changes, environment/container ids, and whether ecommerce is
active.

## 2. Architecture (the deliberate choice)

State the chosen pattern and the alternatives rejected:

- [ ] gtag.js client-side direct
- [ ] Firebase Analytics SDK direct (iOS/Android app stream)
- [ ] GTM web container
- [ ] Measurement Protocol augmentation
- [ ] Server-side GTM (sGTM)
- [ ] Hybrid: <which surfaces go where>

**Selected endpoint/path and payload shape:** <exact endpoint, path,
client/server sender, and payload contract. For example:
`https://www.google-analytics.com/mp/collect?...` with JSON
Measurement Protocol body, or `gtag('event', name, params)` for browser
events, or Firebase SDK `logEvent` for app events. For EU MP collection,
consider `https://region1.google-analytics.com/mp/collect?...`.>

### GTM web dataLayer contract (if selected)

Normal web analytics uses one dataLayer event name, `userevent`, with two
filtered reusable GTM trigger/tag paths. GTM fires on the top-level
`event` key; keep `trigger` as canonical audit metadata. Do not create a
new GTM trigger or tag per product event.

| dataLayer event | Filter | GA4 event name | Data layer variables |
| --- | --- | --- | --- |
| `userevent` | `event_type = pageview` | `page_view` | GTM built-ins first; map `userParams.page_name` only if a logical page name is needed |
| `userevent` | `event_type = event` | `{{DLV - event_name}}` | Explicitly mapped `eventParams.<key>` plus approved context fields |

Normal event example:

```js
window.dataLayer.push({
  event: 'userevent',
  trigger: 'userevent',
  event_type: 'event',
  event_name: 'sign_up',
  feature_name: 'auth',
  screen_name: 'signup',
  userParams: {
    page_name: 'signup'
  },
  eventParams: {
    method: 'password'
  }
});
```

New normal events update code, tests, and §5 only; they do not create new
GTM triggers or per-event tags. Ecommerce, if active, uses approved GA4
ecommerce dataLayer events such as `purchase` with
`trigger: 'ga4_ecommerce'` and an `ecommerce` object containing
`items[]`. If the page-view tag emits `page_view`, disable duplicate
automatic/enhanced page-view sends and set `send_page_view = false`.

Do not invent dataLayer or GA4 params for page URL/path/referrer, device,
geo, campaign, traffic source, or click fields when GTM Built-In
Variables or GA4 predefined dimensions/metrics already support them.
For GTM, derive `page_location` and `page_title` from built-ins by
default; map `userParams.page_location` only when it is a full canonical
sanitized URL that the built-in cannot provide.

**Why this and not the others:** one paragraph naming the cost/benefit
deltas. Reference `references/gtm-and-tagging.md` decision matrix.

**Reliability rules:**

- [ ] Server-side calls never block the request path.
- [ ] Bounded queue + worker count + send timeout + drop-on-overflow.
- [ ] Retries with jittered backoff only for transport failures where
      receipt is unknown; never retry the same payload after an HTTP
      non-2xx response.
- [ ] Fail silent for users.
- [ ] Logs contain no event params.

## 3. Canonical event envelope

### Internal shape

```
{
  trigger:          "userevent",
  event_type:       "pageview" | "event",
  event_name:       string?,   // required when event_type = "event"; already the GA4 name
  feature_name:     string?,   // auth | search | billing | admin | ...
  screen_name:      string?,   // signup | dashboard | settings | ...
  ids: {
    client_id:      string,    // web id from gtag('get') (or minted server id)
    app_instance_id:string?,   // app id from Firebase SDK, app streams only
    user_id:        string?,   // hashed+peppered, only when authenticated
    session_id:     string,    // synced with GA4 session
  },
  consent: {
    analytics_storage: 'granted' | 'denied',
    ad_user_data:      'granted' | 'denied',
    ad_personalization:'granted' | 'denied',
    ad_storage:        'granted' | 'denied',
  },
  userParams: {
    page_name?:     string,
    page_location?: string,    // full sanitized URL when not using GTM built-ins
    page_title?:    string,    // app-owned title only when built-in is insufficient
    screen_name?:   string,
  },
  eventParams:      Record<string, string | number | boolean | null>,
  server_timestamp: number,
}
```

Do not send or document Universal Analytics-style
`event_category`, `event_action`, or `event_label`. GA4 events use
`event_name` plus specific event parameters. `event_name` is already the
GA4 event name; do not create a separate internal name and derive the
GA4 name later. Use `feature_name` or `screen_name` for grouping, never
`event_group`.

Represent missing values as `null` in the internal contract/tests and
omit null params from the GA4 payload. Do not create boolean presence
dimensions such as `geo_exists` or `has_referrer`; use meaningful params
like `geo: null` / `geo: "DE"` or `referrer_domain: null` /
`referrer_domain: "example.com"`.

### GA4 event_name selection

Pick `event_name` once in the taxonomy:
1. The recommended GA4 name if one applies (`sign_up`, `login`,
   `search`, `select_content`, `view_item`, `share`, …).
2. A documented custom GA4-safe name from §5 catalog.

For `event_type: "pageview"`, the GA4 event name is `page_view` and
page/screen context comes from `userParams`.

## 4. Identity & sessions

- **Anonymous `client_id`:** <format, how minted, where persisted>.
  For app streams, use `app_instance_id` + `firebase_app_id` instead of
  a web `client_id` contract. `app_instance_id` must come from the
  Firebase SDK; do not mint it server-side.
- **Authenticated `user_id`:** hashed with `sha256(email_lower || PEPPER)`.
  Pepper rotation policy: <quarterly / on incident / never>. Storage:
  <where>.
- **Session_id source:** browser cookie / server-minted / hybrid.
- **Stitching strategy:** <how anonymous → authenticated stitches; see
  references/identity-sessions.md>.

## 5. Event catalog

The contract. Every row must trace to a decision in §1.

| Trigger | Event type | Event name | Feature/screen | userParams | eventParams | File/line anchor | Server/browser side | Decision/use |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `userevent` | `event` | `sign_up` | `feature_name: auth`, `screen_name: signup` | `page_name`; `page_location`/`page_title` from GTM built-ins unless non-GTM | required: `method`; optional: `plan_tier` | `src/auth/signup.ts:42` | browser | D1 |
| `userevent` | `event` | `login` | `feature_name: auth`, `screen_name: login` | `page_name`; `page_location`/`page_title` from GTM built-ins unless non-GTM | required: `method`; optional: `login_result` | `src/auth/login.ts:88` | browser | D1 |
| `userevent` | `event` | `search` | `feature_name: search`, `screen_name: search` | `page_name`; `page_location`/`page_title` from GTM built-ins unless non-GTM | required: `search_term` (allowlisted/bucketed; no raw free text); optional: `search_location`, `result_count_bucket` | `src/search/handler.ts:17` | browser | D2 |
| ... | | | | | | | | |

Every parameter listed here must be passed; nothing else is. The
catalog is closed: if a feature needs a new event, the catalog gets a
new row in the same PR.

## 6. Reporting config

### Custom dimensions

Start with GA4 predefined dimensions/metrics and register custom
definitions only when the named decision cannot be answered from built-ins
or recommended-event parameters. A first-pass plan with more than 10
custom definitions needs an explicit justification.

| Display name | Parameter/User property | Scope | Feature/screen context(s) | GA4 predefined alternative checked | Description | Decision/use |
| --- | --- | --- | --- | --- | --- | --- |
| Plan tier | `plan_tier` | User | auth, funnel | none | Subscription tier at event time | D1, D3 |
| Feature name | `feature_name` | Event | content, system | Page path/screen name is too broad | Top-level product area | D1 |
| Search location | `search_location` | Event | search | Search term is not enough | UI surface that initiated search | D2 |
| Experiment variant | `experiment_variant` | User | all | none | A/B test cell | D4 |

### Custom metrics

| Display name | Parameter | Scope | Feature/screen context(s) | GA4 predefined alternative checked | Description | Unit | Decision/use |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Latency | `latency_ms` | Event | system | no equivalent for app-specific timing | Server response time | ms | D5 |

### Key events

- `sign_up`, `purchase`, `<one more>`.

**Explicitly NOT registering:**
- `user_id`, `transaction_id`, `order_id` (cardinality).
- `page_path`, `country`, `device_category` (GA4 built-ins).
- Boolean presence flags (`geo_exists`, `has_referrer`,
  `search_has_results`). Use nullable meaningful params or buckets.

## 7. Consent & legal

- Consent Mode v2 defaults: `denied` for all four signals for EEA, UK,
  and Switzerland. For other traffic: <documented choice>.
- CMP: <which one>. Loaded inline in `<head>`. Equal-prominence reject.
- Server-side MP calls pass only supported MP consent fields:
  `ad_user_data` and `ad_personalization`.
- Consent rejected: <basic mode = zero third-party analytics sends |
  advanced mode = cookieless pings with explicit approval>.
- App consent: <Firebase `setConsent` mapping; whether
  `setAnalyticsCollectionEnabled` disables collection before consent>.
- Minor or age-unclassified user: zero analytics sends until classified
  and permitted.
- Privacy policy: §<which one> updated with the GA4 statement.
- DPIA: <required? completed?>.
- Erasure pipeline: <which job, what cadence, target SLA>.

## 8. Codebase anchors

Every event in §5 has a `file:line` anchor. This section catalogs
**touch points** beyond just emission:

| Concern | File:line anchor | Why |
| --- | --- | --- |
| Typed wrapper | `src/analytics/track.ts:1` | All callers route through here |
| Forbidden-keys scrubber | `src/analytics/scrub.ts:1` | Pre-send filter |
| Consent gate | `src/analytics/consent.ts:1` | Reads CMP state |
| Server queue | `src/analytics/queue.ts:1` | Bounded, drop-on-overflow |
| CI drift check | `scripts/check_analytics.ts:1` | Code names == doc names |
| GA4 Admin API deletion job | `src/jobs/erase_user.ts:1` | Erasure pipeline |
| Analytics contract | `docs/README_ANALYTICS.md:1` | Future-feature measurement rule |
| Agent rule | `AGENTS.md:1` | Requires analytics impact for user-visible features |

## 9. Future-feature analytics contract

Create or update `docs/README_ANALYTICS.md` with:

- The event taxonomy from §5.
- Required param types and allowed values.
- The allowlist for state-changing surfaces with no event.
- The future-feature rule: `trigger`, `event_type`, `event_name` where
  applicable, `feature_name` or `screen_name`, typed params,
  predefined-dimension check for new custom definitions, tests, taxonomy
  row, and vendor/runbook updates in the same PR.
- Links to the setup runbook and privacy/deletion flow.

Add or update the target repo `AGENTS.md` rule:

> User-visible feature changes must include analytics impact: `trigger`,
> `event_type`, `event_name` where applicable, `feature_name` or
> `screen_name`, typed params, tests, taxonomy doc update, predefined-
> dimension check for any new custom definition, and any required
> vendor/runbook updates. Do not add bulk custom dimensions or boolean
> presence dimensions like `*_exists` / `has_*`, and do not use
> `event_group`. If no event is needed, update the analytics allowlist
> with a reason.

CI drift checks:

- [ ] Every state-changing route emits analytics or is allowlisted.
- [ ] Code event envelopes match the taxonomy.
- [ ] Required params have tests.
- [ ] Captured payloads pass forbidden-key and forbidden-value sweeps.

## 10. Implementation order

One commit per step. The implementer follows this list top to bottom.

1. Add typed `userevent` envelope wrapper + scrubber + consent gate.
   Tests.
2. Wire Consent Mode v2 defaults snippet in HTML.
3. Add custom dimensions / metrics / key events in GA4 Admin (per
   runbook).
4. Emit auth events (`sign_up`, `login`, `logout`, `login_failed`).
5. Emit search events.
6. Emit funnel events (<flow name>).
7. Emit error events (client + server).
8. Add web-vitals reporter.
9. Background job events (Measurement Protocol).
10. CI drift check.
11. `docs/README_ANALYTICS.md` contract + `AGENTS.md` future-feature rule.
12. GA4 Admin API `properties.submitUserDeletion` job + downstream
    erasure integration.

## 11. Verification

- [ ] PII sweep CI test: every event in §5 fires with fixture user, no
      forbidden key or value-shape regex match.
- [ ] Consent-denied test: basic mode sends zero third-party analytics
      calls; advanced mode sends only approved cookieless pings.
- [ ] Minor / age-unclassified test: zero analytics sends.
- [ ] Exact event assertions for each critical event.
- [ ] Internal contract and GTM dataLayer assertions check
      `event: "userevent"` where GTM is used, plus
      `trigger: "userevent"` and `event_type: "pageview" | "event"`.
- [ ] `event_name` is the GA4 event name with no rewrite table.
- [ ] No `event_group` or `ga4_event_name` field appears in captured
      payloads.
- [ ] Page/screen context is under `userParams` with GA4/GTM-compatible
      keys.
- [ ] Vendor sends use native mapped shapes (`gtag`, Firebase SDK, MP,
      or sGTM) and do not leak internal-only fields.
- [ ] Exactly-one-event test for each funnel step (no double-fire).
- [ ] Network-failure test: queue overflows, UX unaffected, drop
      counter increments.
- [ ] Identity-stitch test: anonymous events + login → events appear
      under same user in GA4 DebugView.
- [ ] Each custom dimension/metric populates in DebugView within 60s.
- [ ] Realtime report shows test event with all expected params.
- [ ] Account-deletion smoke: deletion triggers GA4 Admin API
      `properties.submitUserDeletion` for each known identifier within SLA.

## 12. Risks & open questions

- R1. <e.g., "Consent rate in EEA/UK/Switzerland may be <30%; modeled
      conversions help but ad attribution will be soft.">
- R2.
- OQ1. <open question for product/legal>
- OQ2.

## 13. Deliverables

- This plan, frozen at v1.0 once approved.
- The setup runbook (sibling artifact, see `assets/runbook-template.md`).
- `docs/README_ANALYTICS.md` durable analytics contract.
- Target repo `AGENTS.md` analytics-impact rule.
- Typed wrapper + scrubber + consent gate code.
- CI drift check.
- Updated privacy policy.
- DPIA if applicable.

## Outcome

Fill only after implementation.

- Outcome: <implemented as planned | implemented with changes |
  superseded by implementation | obsolete before execution>
- Source of truth after execution: <code/docs paths>

## Current Accuracy

Fill only after implementation. State whether this plan still matches
the shipped analytics contract, and record doc-review coverage for
privacy, event schema, setup/runbook, and future-feature workflow.
