Status: planned
Type: feature
Author: <your-handle>

# GA4 Instrumentation — Design Plan

## Revision history

| Date | Pass | Author | What changed |
| --- | --- | --- | --- |
| YYYY-MM-DD | 1 | <handle> | Initial draft |

> Add a row per review pass. Plans that don't track their own revisions
> get re-litigated.

## 0. TL;DR

Two paragraphs max. What we'll track, why, what we'll deliberately not
track. The reader who reads only this should know whether to read on.

## 1. Goal & decisions

What product/business decisions will this data drive? List 3–7. Each
will get one or more events. If a question can't be made concrete, cut
it.

- D1. <decision> — e.g., "Which features are used vs dead, to decide
      what to drop in the next refactor."
- D2. <decision>
- D3. <decision>

**Audience constraints:** EU / minors / B2B / B2C / regulated industry.
This determines the privacy floor.

**Vendor context:** GA4 property type (web / app / both), existing GTM,
existing BigQuery export, paid acquisition budget. This determines the
architecture in §4.

## 2. Architecture (the deliberate choice)

State the chosen pattern and the alternatives rejected:

- [ ] gtag.js client-side direct
- [ ] GTM web container
- [ ] Measurement Protocol server-side
- [ ] Server-side GTM (sGTM)
- [ ] Hybrid: <which surfaces go where>

**Why this and not the others:** one paragraph naming the cost/benefit
deltas. Reference `references/gtm-and-tagging.md` decision matrix.

**Reliability rules:**

- [ ] Server-side calls never block the request path.
- [ ] Bounded queue + drop-on-overflow.
- [ ] Retries with jittered backoff for 5xx/network; never for 4xx.
- [ ] Fail silent for users.
- [ ] Logs contain no event params.

## 3. Schema

### Internal event shape

```
{
  name:             string,    // snake_case, max 40
  category:         enum,      // auth | content | search | funnel | system
  action:           string,    // verb (created, viewed, completed)
  label:            string?,   // optional human-readable disambiguator
  logical_page:     string?,   // home | dashboard | settings | ...
  ids: {
    client_id:      string,    // browser id (or minted server id)
    user_id:        string?,   // hashed+peppered, only when authenticated
    session_id:     string,    // synced with GA4 session
  },
  consent: {
    analytics_storage: 'granted' | 'denied',
    ad_user_data:      'granted' | 'denied',
    ad_personalization:'granted' | 'denied',
    ad_storage:        'granted' | 'denied',
  },
  properties:       Record<string, string | number | boolean>,
  server_timestamp: number,
}
```

### GA4 event_name derivation

`event_name` = first match in:
1. The recommended GA4 name if one applies (`sign_up`, `login`,
   `search`, `select_content`, `view_item`, `share`, …).
2. A documented custom name from §5 catalog.

## 4. Identity & sessions

- **Anonymous `client_id`:** <format, how minted, where persisted>.
- **Authenticated `user_id`:** hashed with `sha256(email_lower || PEPPER)`.
  Pepper rotation policy: <quarterly / on incident / never>. Storage:
  <where>.
- **Session_id source:** browser cookie / server-minted / hybrid.
- **Stitching strategy:** <how anonymous → authenticated stitches; see
  references/identity-sessions.md>.

## 5. Event catalog

The contract. Every row must trace to a decision in §1.

| Name | Category | Action | Trigger / `file:line` anchor | Required params | Consent gate | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| `sign_up` | auth | created | `src/auth/signup.ts:42` | `method` | analytics_storage | D1 |
| `login` | auth | created | `src/auth/login.ts:88` | `method` | analytics_storage | D1 |
| `search` | content | issued | `src/search/handler.ts:17` | `search_term` (scrubbed) | analytics_storage | D2 |
| ... | | | | | | |

Every parameter listed here must be passed; nothing else is. The
catalog is closed: if a feature needs a new event, the catalog gets a
new row in the same PR.

## 6. Reporting config

### Custom dimensions

| Display name | Param | Scope | Why we need it (decision) |
| --- | --- | --- | --- |
| Plan tier | `plan_tier` | User | D1, D3 |
| Feature area | `feature_area` | Event | D1 |
| Experiment variant | `experiment_variant` | User | D4 |

### Custom metrics

| Display name | Param | Scope | Unit | Why |
| --- | --- | --- | --- | --- |
| Latency | `latency_ms` | Event | ms | D5 |

### Key events (conversions)

- `sign_up`, `purchase`, `<one more>`.

**Explicitly NOT registering:**
- `user_id`, `transaction_id`, `order_id` (cardinality).
- `page_path`, `country`, `device_category` (GA4 built-ins).

## 7. Consent & legal

- Consent Mode v2 defaults: `denied` for all four signals (EU). For
  non-EU traffic: <documented choice>.
- CMP: <which one>. Loaded inline in `<head>`. Equal-prominence reject.
- Server-side calls mirror consent in `consent` field.
- Privacy policy: §<which one> updated with the GA4 statement.
- DPIA: <required? completed?>.
- Erasure pipeline: <which job, what cadence, target SLA>.
- Children: <if applicable: server-side hard disable + parental consent
  flow + counsel sign-off>.

## 8. Codebase anchors

Every event in §5 has a `file:line` anchor. This section catalogs
**touch points** beyond just emission:

| Concern | File | Why |
| --- | --- | --- |
| Typed wrapper | `src/analytics/track.ts` | All callers route through here |
| Forbidden-keys scrubber | `src/analytics/scrub.ts` | Pre-send filter |
| Consent gate | `src/analytics/consent.ts` | Reads CMP state |
| Server queue | `src/analytics/queue.ts` | Bounded, drop-on-overflow |
| CI drift check | `scripts/check_analytics.ts` | Code names == doc names |
| User-Deletion job | `src/jobs/erase_user.ts` | GDPR erasure pipeline |

## 9. Implementation order

One commit per step. The implementer follows this list top to bottom.

1. Add typed wrapper + scrubber + consent gate. Tests.
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
11. User-Deletion job + erasure-API integration.

## 10. Verification

- [ ] PII sweep CI test: every event in §5 fires with fixture user, no
      forbidden key or value-shape regex match.
- [ ] Exactly-one-event test for each funnel step (no double-fire).
- [ ] Consent-denied test: zero outbound calls to GA4 domains.
- [ ] Network-failure test: queue overflows, UX unaffected, drop
      counter increments.
- [ ] Identity-stitch test: anonymous events + login → events appear
      under same user in GA4 DebugView.
- [ ] Each custom dimension/metric populates in DebugView within 60s.
- [ ] Realtime report shows test event with all expected params.
- [ ] Account-deletion smoke: deletion triggers User-Deletion API
      within SLA.

## 11. Risks & open questions

- R1. <e.g., "Consent rate in EU may be <30%; modeled conversions help
      but ad attribution will be soft.">
- R2.
- OQ1. <open question for product/legal>
- OQ2.

## 12. Deliverables

- This plan, frozen at v1.0 once approved.
- The setup runbook (sibling artifact, see `assets/runbook-template.md`).
- Typed wrapper + scrubber + consent gate code.
- CI drift check.
- Updated privacy policy.
- DPIA if applicable.
