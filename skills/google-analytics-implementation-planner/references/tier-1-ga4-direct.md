# Tier 1 (basic) — GA4 direct

The Google tag (`gtag.js`) on web, the Firebase Analytics SDK on iOS/Android.
No tag manager, no tagging server. Your code talks to GA4.

Authoritative docs. The URL and its topic were verified on the date shown;
re-verify claim details before locking a plan.

- CONFIRMED 2026-07-28: <https://developers.google.com/tag-platform/gtagjs/install>
- CONFIRMED 2026-07-28: <https://developers.google.com/analytics/devguides/collection/ga4/views>
- CONFIRMED 2026-07-28: <https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications>
- CONFIRMED 2026-07-28: <https://support.google.com/analytics/answer/9216061>
- CONFIRMED 2026-07-28: <https://developers.google.com/tag-platform/gtagjs/routing>
- CONFIRMED 2026-07-28: <https://firebase.google.com/docs/analytics/get-started>
- CONFIRMED 2026-07-28: <https://firebase.google.com/docs/analytics/screenviews>
- CONFIRMED 2026-07-28: <https://firebase.google.com/docs/analytics/userid>
- CONFIRMED 2026-07-28: <https://firebase.google.com/docs/analytics/configure-data-collection>
- CONFIRMED 2026-07-28: <https://developers.google.com/tag-platform/security/guides/consent>
- CONFIRMED 2026-06-21: <https://support.google.com/analytics/answer/9679158>
- CONFIRMED 2026-06-21: <https://support.google.com/analytics/answer/9304153>
- CONFIRMED 2026-06-21: <https://developers.google.com/tag-platform/gtagjs>
- CONFIRMED 2026-06-21: <https://developers.google.com/analytics/devguides/collection/ga4/events>

## Choose tier 1 when

- Engineering owns instrumentation. Nobody outside the repo needs to add tags.
- One GA4 property, no third-party ad pixels to manage.
- Losing 5–20% of events to ad blockers is acceptable for the decisions in scope.
- No regulatory requirement to keep beacons off Google-owned domains.
- App streams: this is the **default and correct** tier for iOS/Android. The
  Firebase SDK is how app streams get automatic collection, app-instance
  identity, and screen reporting. GTM has no equivalent app path worth the cost.

Do **not** choose tier 1 when a non-engineer must ship a tag without a deploy
(→ [tier 2](tier-2-gtm-web.md)) or when server-only truth or ad-blocker recovery
is the whole point (→ [tier 3](tier-3-server-side.md), layered on tier 1).

## GA4 object terminology

Use GA4 terms, never Universal Analytics ones. GA4 has no views and no
"profiles".

- **GA4 property** — the reporting/configuration container for one logical user base.
- **Web data stream** — the website data source inside the property. It owns the
  Measurement ID / Google tag ID, usually `G-...`.
- **App data stream** — the iOS/Android data source. It owns the Firebase app id.

If the user did not supply a GA4 property, the runbook creates a new property and
data stream, and leaves an explicit `G-...` placeholder plus a step to copy the
generated Measurement ID. Never invent an id. See
[assets/intake-questionnaire.md](../assets/intake-questionnaire.md) block 5.

## Web: install and send shape

Install the Google tag once, in the document head, on every page. Then one
`gtag('event', …)` call per tracked surface:

```js
gtag('event', 'sign_up', {
  feature_name: 'auth',
  method: 'password',
});
```

The canonical envelope in
[ga4-event-schema.md](ga4-event-schema.md) still governs which fields exist —
tier 1 flattens it into `gtag` params rather than nesting `userParams` /
`eventParams`, because gtag has no dataLayer to carry the nesting. Keep the
same names; do not rename a field between tiers.

Multiple destinations from one page use `gtag('config', …)` per target rather
than a second snippet.

## Web: who owns `page_view` (decide once, in the plan)

Exactly one source of `page_view` may be active. Two is the most common GA4
bug in a React app.

| Source | How it fires | Turn it off by |
| --- | --- | --- |
| Enhanced Measurement — page loads | automatic on tag load | Admin → Data Streams → Web → Enhanced measurement |
| Enhanced Measurement — page changes based on browser history events | automatic on `pushState`/`replaceState` | the same panel, Page views → advanced settings |
| Manual | your code calls `gtag('event', 'page_view', {…})` | `gtag('config', 'TAG_ID', { send_page_view: false })` |

Rules, all vendor-documented:

- The Google tag's `config` command sends a pageview by default
  (`send_page_view` defaults to `true`).
- Sending manual pageviews **without** disabling the automatic one produces
  duplicate pageviews.
- `send_page_view: false` **does not persist across pages** — it must be repeated
  in the snippet on every page where the automatic pageview is unwanted.
- For a History-API SPA, Google's recommended path is the automatic one: enable
  Enhanced Measurement page views including *page changes based on browser
  history events*, and send nothing manually.
- Manual sends are for the cases automatic history tracking cannot see: fragment-
  only navigation, `DocumentFragment` screen swaps, infinite scroll, wizard steps
  inside one route.
- `page_location` defaults to `location.href` **excluding the fragment**. If you
  override it, the value must start with the protocol and be a full URL.

Framework-by-framework wiring for all of this is in
[framework-integration.md](framework-integration.md).

## App: Firebase Analytics SDK

- `logEvent` for events, `setUserId` for the hashed+peppered authenticated id,
  `setConsent` for consent signals, `setAnalyticsCollectionEnabled` for the hard
  off switch.
- Screen views are reported automatically by the SDK. Send a manual
  `screen_view` only for screens the SDK cannot see (a tab swap inside one
  native screen, a modal treated as a screen). Do not re-send what the SDK
  already sends.
- `app_instance_id` is SDK-derived. Never mint it server-side. Tier 3 needs it
  from the SDK, not from your database.
- For minors or pre-consent states, disable collection at the SDK level
  (`setAnalyticsCollectionEnabled(false)`) and, where required, before the SDK
  initializes — a UI toggle is not a gate. See
  [privacy-consent.md](privacy-consent.md).

## Consent

Google tags carry built-in consent checks. Order on the page matters and is not
negotiable:

1. Consent **default** snippet — synchronous, top of `<head>`, before any
   measurement tag.
2. Google tag (async).
3. CMP / cookie banner — calls `gtag('consent', 'update', …)` on interaction.
4. Application code firing events.

Defaults must be in the HTML itself. A CMP loaded *by* the tag races the first
event and logs it under the wrong consent state. Basic vs advanced consent mode
and the EEA/UK/Switzerland floor are in
[privacy-consent.md](privacy-consent.md).

## Verification for this tier

- [ ] Exactly one `page_view` per navigation in DebugView — click through five
      routes, count five.
- [ ] `send_page_view: false` present on every page that sends manually.
- [ ] Consent denied → zero requests to `google-analytics.com` /
      `analytics.google.com` (basic consent mode).
- [ ] App: no duplicate `screen_view` alongside automatic SDK screen reporting.
- [ ] Every registered custom dimension populates in DebugView within 60s.

## Upgrade path → tier 2 (GTM web)

What carries over unchanged: the GA4 property, data stream, Measurement ID,
custom definitions, key events, the event catalog, the envelope field names, and
the consent posture.

What changes shape: sends move from `gtag('event', …)` to
`dataLayer.push({ event: 'userevent', … })`, and the Google tag is installed by
the container instead of by your layout. The flattened tier-1 params become
nested `userParams` / `eventParams`.

What must be migrated deliberately: `page_view` ownership is re-decided —
Google's guidance is that when tags are configured through Tag Manager you must
**not** enable automatic history tracking in GA4, or pageviews double-count.
Remove the tier-1 snippet in the same deploy that adds the container; two
Google tags on one page double-count everything.

Cost delta: a container to own, a review path for container changes, and one
more system in the debugging loop. Do not pay it without a reason from
[tier-2-gtm-web.md](tier-2-gtm-web.md) "Choose tier 2 when".
