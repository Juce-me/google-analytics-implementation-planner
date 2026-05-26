Status: planned
Type: feature
Author: <your-handle>

# GA4 Setup Runbook

> The **how**, not the **why**. The **why** lives in the design plan
> (sibling artifact). When something here changes (a click-path
> screenshot, a new admin step), update this file — don't drift the
> plan.

## Revision history

| Date | Pass | Author | What changed |
| --- | --- | --- | --- |
| YYYY-MM-DD | 1 | <handle> | Initial draft |

## 0. Prerequisites

- [ ] Google account with Editor permission on the GA4 property (or
      create-property permission on the target organization).
- [ ] Access to the codebase (commit + PR).
- [ ] Access to the CMP admin panel (if applicable).
- [ ] Secret-manager access to write the `PEPPER` for user-id hashing.
- [ ] If sGTM: GCP project + billing + Cloud Run deploy permissions.

## 1. Create / configure the GA4 property

Admin (gear icon, bottom left) → Property column.

1. **Property → Property Details:** name, timezone, currency. (Currency
   here defines the report-level conversion target — set even if you
   don't have ecommerce.)
2. **Data Streams → Web**:
   - Stream name, URL, stream id.
   - Enhanced Measurement → toggle: keep ON for `scroll`, `outbound
     click`, `site search`, `video engagement`, `file download`.
     Keep automatic `page_view` only when the plan does not manually emit
     `page_view` via GTM/gtag/app routing. **Turn OFF anything you'll
     re-emit manually** (avoid double counts).
   - Configure tag settings → Domains → list of cross-domain
     destinations.
   - Configure tag settings → Internal traffic → add IP rules for the
     office / VPN to exclude.
3. **Data Streams → iOS / Android**:
   - Register app stream and Firebase app id.
   - Install Firebase Analytics SDK.
   - Document automatic events, screen-reporting source of truth, and app
     debug mode.
   - If using MP augmentation, capture SDK-derived `app_instance_id`; do
     not mint it server-side.
4. **Property → Reporting Identity:** choose Blended / Observed /
   Device-based per plan §4.
5. **Property → Data Settings → Data Retention:** 14 months (max on
   Standard; longer requires 360). Reset user data on new activity:
   ON.
6. **Property → Data Settings → Data Collection → Google Signals:**
   ON if marketing needs demographics & cross-device; OFF if audience
   includes minors or strict-privacy use cases.

## 2. Register custom definitions

Admin → Property → **Custom Definitions**.

Before creating anything, confirm the plan checked GA4 predefined
dimensions/metrics and recommended-event parameters first. Do not create
custom definitions for built-ins, boolean presence flags, or every event
parameter in the catalog. More than 10 first-pass custom definitions
requires the explicit justification from plan §6.

Custom dimensions tab → Create custom dimension. Paste rows from
plan §6:

| Display name | Parameter/User property | Scope | Event group(s) | GA4 predefined alternative checked | Description | Decision/use |
| --- | --- | --- | --- | --- | --- | --- |
| Plan tier | `plan_tier` | User | auth, funnel | none | Subscription tier at event time | D1, D3 |
| Feature area | `feature_area` | Event | content, system | Page path/screen name is too broad | Top-level product area | D1 |
| Search location | `search_location` | Event | search | Search term is not enough | UI surface that initiated search | D2 |
| Experiment variant | `experiment_variant` | User | all | none | A/B test cell | D4 |
| ... | ... | ... | ... | ... | ... | ... |

Custom metrics tab → Create custom metric. Specify **unit** correctly:

| Display name | Parameter | Scope | Event group(s) | GA4 predefined alternative checked | Description | Unit of measurement | Decision/use |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Latency | `latency_ms` | Event | system | no equivalent for app-specific timing | Server response time | Milliseconds | D5 |
| ... | ... | ... | ... | ... | ... | ... | ... |

> Double-check spelling and case of the parameter name BEFORE saving.
> Archiving frees quota for new definitions, but breaks dependent
> audiences, explorations, reports, and ads integrations.

## 3. Mark key events

Admin → Property → **Events** → after the event has fired at least once
(or after manual creation), toggle **Mark as key event**. For events
that have never fired yet:

- Admin → Property → **Key events** → Create → enter event name
  exactly as it will fire.

Per plan §6: `sign_up`, `purchase`, `<other>`.

## 4. Measurement Protocol API secret (if server-side)

Admin → Data Streams → <stream> → Measurement Protocol API secrets →
**Create**.

- Name: `<env>-server` (e.g., `prod-server`).
- Copy the secret immediately — it's only shown once.
- Store in secret manager. Reference from server config as
  `GA4_MP_API_SECRET`.

Repeat per environment. Never share secrets across envs.

### Measurement Protocol endpoint contract

Live endpoint:

```text
POST https://www.google-analytics.com/mp/collect?measurement_id=<G-ID>&api_secret=<secret>
Content-Type: application/json
```

EU regional endpoint when required:

```text
POST https://region1.google-analytics.com/mp/collect?measurement_id=<G-ID>&api_secret=<secret>
Content-Type: application/json
```

Debug endpoint:

```text
POST https://www.google-analytics.com/debug/mp/collect?measurement_id=<G-ID>&api_secret=<secret>
Content-Type: application/json
```

Payload shape is exactly the one approved in the design plan. Do not add
params outside the event taxonomy. Validate every catalog event against
the debug endpoint before enabling live sends. Web streams use
`measurement_id` + `client_id` retrieved with `gtag('get')`; app streams
use `firebase_app_id` + SDK-derived `app_instance_id`.

## 5. Consent Mode v2 (web)

Place the **default snippet** inline in `<head>` of every server-
rendered page, BEFORE any tag loader. Example:

```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });
</script>
```

For EEA, UK, and Switzerland traffic the defaults are `denied`. For other
traffic the choice is documented in plan §7.

Wire your CMP's "Accept" / "Reject" callbacks to call
`gtag('consent', 'update', {…})` with the user's choice.

## 5a. Firebase app consent (iOS/Android)

For app streams, use Firebase SDK controls rather than the web snippet:

1. Disable collection before consent where the plan requires it
   (`setAnalyticsCollectionEnabled(false)` or platform config).
2. On consent update, call SDK `setConsent` for analytics storage, ad
   storage, ad user data, and ad personalization.
3. Document whether the collection-enabled override persists across app
   restarts and how the user can change consent later.
4. Verify denied consent returns no `app_instance_id` for MP augmentation
   and sends no app analytics events in basic mode.

## 6. (If using GTM) container setup

GTM admin → Workspace.

1. Create new container per environment. Never share across envs.
2. Confirm the approved dataLayer contract uses `dataLayer.push({...})`,
   not `dataLayer(...)`, and that GTM web is intentionally selected.
3. Tags → New → Google tag for base configuration.
4. Create exactly two normal analytics triggers/tags:

   | Trigger | Tag | Event name | Data layer variables to map |
   | --- | --- | --- | --- |
   | Custom Event `ga4_page_view` | GA4 Event `GA4 - Page View` | `page_view` | GTM built-ins first; only app-owned page params if needed |
   | Custom Event `ga4_user_event` | GA4 Event `GA4 - User Event` | `{{DLV - ga4_event_name}}` | Event-specific params not covered by GA4/GTM |

   Adding a new normal event updates the app taxonomy/tests and the
   `ga4_user_event` payload only; it does not create another GTM trigger
   or tag.
   If this tag sends `page_view`, disable duplicate automatic page-view
   sends from the Google tag / Enhanced Measurement source of truth,
   especially for SPA route changes.
5. If ecommerce is active, configure it separately:

   | Trigger | Tag | Event name | Required variables |
   | --- | --- | --- | --- |
   | Custom Event `ga4_ecommerce` | GA4 Event `GA4 - Ecommerce` | `{{DLV - ga4_ecommerce_event_name}}` | `currency`, `value`, `transaction_id` where applicable, `items[]` with `item_id` or `item_name` |

   Map GA4 ecommerce fields from the data layer and validate `purchase`,
   `refund`, and cart events against the ecommerce section of the plan.
6. Google tags have built-in consent checks. Add required consent only
   when deliberately implementing basic-mode blocking; otherwise you
   suppress advanced-mode cookieless pings/modeling.
7. Variables → enable built-ins first (Page URL, Page Path, Referrer,
   Click ID, Click URL, click classes/text, scroll/form/error variables
   as needed). Create Data Layer Variables only for app-owned params that
   GA4/GTM does not already provide, such as `logical_page`,
   `feature_area`, `ga4_event_name`, and event-specific business fields.
   Do not create variables for page, device, geo, campaign, traffic, or
   click fields that built-ins already cover.
8. Preview before publishing. Confirm normal page/user events fire only
   the two normal triggers/tags; ecommerce fires only its dedicated path.
   Publish only after Tag Assistant green
   for every test path.
9. Lock prod container — only the analytics lead has publish rights.

## 7. (If using sGTM) server-side container

1. Create server container in GTM.
2. Tagging Server → Provisioning → Manually provision (Cloud Run /
   App Engine). Document the GCP project, region, scaling settings.
3. Map a first-party subdomain (`analytics.example.com`) → server
   container.
4. Web container points to the sGTM endpoint instead of
   `google-analytics.com` directly.
5. Document the exact endpoint path that receives events, the container
   client that claims the request, and the request payload shape.
6. GA4 client tag inside the sGTM container forwards to GA4 with the
   measurement id.
7. If a backend sends MP-format requests to an sGTM Measurement Protocol
   client, document that endpoint and debug path separately from the GA4
   MP endpoint; do not reuse MP endpoint validation assumptions blindly.
8. Every transformation is either a concrete tag/client setting or custom
   template code reviewed with this runbook. No vague "scrub in sGTM"
   placeholders.
9. Health checks + alerting on the Cloud Run service. Document the
   on-call.

## 8. Validation

### DebugView

1. Admin → Property → **DebugView**.
2. To stream a device into DebugView: install GA Debugger Chrome
   extension, OR pass `debug_mode: true` on the gtag config (web) or in
   each Measurement Protocol event's `params` object with
   `engagement_time_msec` set to a positive number.
3. Fire each event in plan §5. Confirm it appears within seconds with
   ALL expected parameters and correct types.

### Measurement Protocol debug endpoint

For server-side, validate payload shape BEFORE switching to the live
endpoint:

```bash
curl -X POST \
  "https://www.google-analytics.com/debug/mp/collect?measurement_id=G-XXX&api_secret=$GA4_MP_API_SECRET" \
  -H "Content-Type: application/json" \
  -d @event.json
```

Expected response: `{"validationMessages": []}`. Any messages indicate
malformed payload — fix before live calls.

### Privacy gates

- Basic consent mode denied: zero third-party analytics sends.
- Advanced consent mode denied: only approved cookieless pings; no
  cookies or full measurement payload.
- Minor / age-unclassified user: zero analytics sends.
- Payload sweep: no forbidden keys or forbidden value shapes.
- Delivery failure: UX still succeeds; only non-PII counters/logs change.

### Realtime report

Admin → Reports → **Realtime**. Fire a test event; confirm it appears
within 30 seconds and the params show in the "Event count by Event
name" card.

### Custom dimension / metric population

DebugView → click the event → the parameter row shows the value AND a
chip indicating "Custom dimension: <name>" once registered. If the
chip is missing, the dimension is registered with a wrong parameter
key.

## 9. Data export to BigQuery (if applicable)

Admin → Property → **BigQuery Links** → Link.

1. Select GCP project.
2. Data location: documented regional choice for EEA/UK/Switzerland
   residents (or as documented in plan §7).
3. Frequency: Daily (free), Streaming (paid).
4. Include advertising identifiers: per plan §7.
5. Document that collected User-ID data exports to BigQuery and that GA4
   deletion requests do not delete exported rows; maintain a separate
   dataset deletion job.

## 10. Ongoing operations

- **Drift check in CI** — `scripts/check_analytics.ts` compares code
  event names to plan §5 catalog. Fails CI on drift.
- **Quarterly review** — re-read plan §1 decisions. Have they changed?
  Cut events that no longer serve a decision.
- **Pepper rotation** — quarterly cadence. Backfill stored hashes
  during the rotation window.
- **Cardinality watch** — Reports → Explore → "(other)" appearing in
  any dimension is the alarm; investigate the registration.

## 11. Rollback

If the live deploy creates a problem:

1. **Web (gtag.js / GTM):** revert the container publish (GTM → Admin
   → Versions → publish a previous version). For gtag.js, revert the
   code commit.
2. **Server-side (MP):** flip a feature flag to disable analytics
   sends. The queue drains, drop counter goes to 100%, no user impact.
3. **Custom definitions:** archive unused definitions if needed; check
   dependent audiences, explorations, reports, and ads integrations
   first.
4. **Communicate** — note the rollback in the design plan's revision
   header.

## Outcome

Fill only after implementation.

- Outcome: <implemented as planned | implemented with changes |
  superseded by implementation | obsolete before execution>
- Source of truth after execution: <GA4 admin links / code/docs paths>

## Current Accuracy

Fill only after implementation. State whether this runbook still matches
the live GA4/GTM/MP configuration, and record doc-review coverage for
admin setup, consent, privacy, rollback, and operations links.
