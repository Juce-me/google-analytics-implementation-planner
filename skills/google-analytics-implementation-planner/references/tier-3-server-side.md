# Tier 3 (hyper) — server-side

Two different things live in this tier, and conflating them is the most common
tier-3 planning error:

- **Measurement Protocol (MP)** — your backend POSTs events to GA4's ingestion
  endpoint.
- **Server-side GTM (sGTM)** — the browser sends to *your* domain; your tagging
  server forwards to GA4 and other vendors.

Tier 3 always sits **on top of** a client tier. MP and sGTM augment automatic
collection from [tier 1](tier-1-ga4-direct.md) or
[tier 2](tier-2-gtm-web.md); neither replaces it. Full server-to-server GA4
produces partial reporting.

Authoritative docs. The URL and its topic were verified on the date shown;
re-verify claim details before locking a plan — Google has changed MP payload
shape and required fields more than once.

- CONFIRMED 2026-05-26: <https://developers.google.com/analytics/devguides/collection/protocol/ga4>
- CONFIRMED 2026-05-26: <https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference>
- CONFIRMED 2026-05-26: <https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events>
- CONFIRMED 2026-05-26: <https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events>
- CONFIRMED 2026-06-21: <https://developers.google.com/tag-platform/tag-manager/server-side>
- CONFIRMED 2026-07-28: <https://developers.google.com/tag-platform/gtagjs/reference>

## Choose tier 3 when — MP

At least one must be true:

- You need data ad blockers can't drop (paid funnel, fraud signals).
- The event happens off-browser: cron finished, webhook fired, background
  renderer completed.
- The browser doesn't have the truth: server-only geo/device enrichment from
  request metadata, true duration, request id.
- You are joining online and offline behavior and already hold the browser/app
  identifier from automatic collection.

If none apply, stay on tier 1 or 2. If compliance forbids **any** client beacon,
escalate — MP is not a compliance workaround.

## Choose tier 3 when — sGTM

Only when ad blockers / cookie deprecation eat enough data that the deficit costs
more than the infrastructure:

- Paid acquisition spend > $10k/month and reported ROAS is clearly below backend
  truth.
- Advanced Consent Mode modeling is approved and still leaves observable
  paid-conversion gaps.
- Strict privacy posture (medical, finance, EEA/UK/Swiss regulated) where
  third-party beacons are a legal liability.

What it buys: the browser sends to `analytics.example.com`, your container
forwards; you can drop, enrich, or hash before data leaves your domain;
first-party traffic bypasses ad blockers.

What it costs: a Cloud Run / App Engine deployment to maintain, a custom domain
and certificate, staging **and** prod containers both versioned, and engineers
who can debug a Node-based tag server.

If the user says "GTM" and the project is a side project, an MVP, or
pre-paid-acquisition, push back: sGTM is the wrong answer. Record the pushback
and their decision in the plan.

## MP endpoint and auth

Web stream:

```
POST https://www.google-analytics.com/mp/collect
  ?measurement_id=G-XXXXXXX
  &api_secret=<from Admin → Data Streams → Measurement Protocol API secrets>
```

For EU regional collection requirements:

```
POST https://region1.google-analytics.com/mp/collect
  ?measurement_id=G-XXXXXXX
  &api_secret=<from Admin → Data Streams → Measurement Protocol API secrets>
```

App stream — `firebase_app_id` replaces `measurement_id`:

```
POST https://www.google-analytics.com/mp/collect
  ?firebase_app_id=<Firebase app id>
  &api_secret=<from Admin → Data Streams → Measurement Protocol API secrets>
```

Debug endpoint (validates the payload, returns errors, does NOT count toward
your data):

```
POST https://www.google-analytics.com/debug/mp/collect?measurement_id=...&api_secret=...
```

Use the debug endpoint in CI for every event in the catalog. For app streams the
body must carry an `app_instance_id` from the Firebase SDK after collection has
initialized; never mint it server-side.

## MP payload shape (the contract)

```json
{
  "client_id": "555.123",
  "user_id": "<hashed+peppered authenticated id, optional>",
  "timestamp_micros": 1716700000000000,
  "consent": {
    "ad_user_data": "GRANTED",
    "ad_personalization": "DENIED"
  },
  "events": [
    {
      "name": "purchase",
      "params": {
        "session_id": "1716699000",
        "engagement_time_msec": 100,
        "currency": "USD",
        "value": 49.95,
        "transaction_id": "T-12345",
        "items": [
          { "item_id": "SKU-1", "item_name": "Pro plan", "price": 49.95, "quantity": 1 }
        ]
      }
    }
  ]
}
```

### Required identity and reporting-critical fields

- **Web streams:** `client_id` is required. Get it with
  `gtag('get', 'G-XXXXXXX', 'client_id', callback)` in the browser and forward
  it. Cookie parsing is a fallback only — cookie formats are implementation
  details. For a purely server-side event with no browser involved, mint a
  stable id (UUIDv4), persist it, and accept partial reporting.
- **App streams:** `firebase_app_id` in the URL, `app_instance_id` in the body.
  `app_instance_id` is not a web `client_id`. If analytics storage is denied and
  the SDK returns no app instance id, do not send app MP for that user/device.
- Inside every event's `params`:
  - `session_id` — server-side does **not** inherit GA4's automatic session. Use
    `gtag('get', 'G-XXXXXXX', 'session_id', callback)` and forward it when the
    event belongs to a browser session; mint a server-side session for
    pure-backend flows. Critical for Realtime, session attribution, and User-ID
    use cases.
  - `engagement_time_msec` — needed for Realtime and active-user reporting. A
    small positive integer (100 is the common floor) for non-engagement events;
    the real value for measured-duration events.

### Common silent failures

- The production endpoint returns `2xx` when the request is *received*, even if
  the payload is malformed or not processed. Validate through the debug endpoint
  with `ENFORCE_RECOMMENDATIONS` before live sends.
- More than 25 events in `events[]`, or a JSON body ≥ 130 KB → outside MP limits.
- `timestamp_micros` more than 72h in the past → default `RELAXED` validation
  clamps to 72 hours ago; `ENFORCE_RECOMMENDATIONS` rejects it.
- Missing `engagement_time_msec` → the event lands but doesn't count as an active
  user. Reports look right; user metrics are wrong.
- `client_id` regenerated per request → every server event mints a new user.
  Persist it.
- Body sent form-encoded instead of JSON → 204 back, zero events ingested.
- HTTP/1.1 without keep-alive → throughput collapses. Use a pooled HTTP client.

## Queue & worker pattern (mandatory if calls touch a user-facing path)

```
user request ──► handler ──► enqueue(event) ─► return 200
                                  │
                                  ▼
                            bounded queue ──► worker pool ──► MP endpoint
                                  │                              │
                                  └── drop on overflow,          └── retry with
                                       counter metric only            jittered backoff,
                                                                     cap at N retries
```

- **Bounded queue**, never unbounded — analytics must not OOM the service.
- **Drop on overflow** with a counter (`analytics.dropped.total`); never block the
  request path.
- **Retry with jitter** only for transport failures where receipt is unknown.
  Never retry the same payload after an HTTP non-2xx; fix the payload instead.
  Document idempotency limits.
- **Fail silent for users** — analytics failures never surface in the UI.
- **Log without PII** — event name, timestamp, queue depth, retry count. Never
  the params.

## Identity stitching server-side

For an authenticated server action (Stripe webhook → user upgraded), send the
stream/device identifier plus the hashed-peppered `user_id` when available:

- Web MP requires `client_id`; app MP requires `app_instance_id`.
- `user_id` is optional identity enrichment, never a substitute for
  `client_id` / `app_instance_id`.
- Session attribution also needs a valid `session_id` inside the documented
  window.

Never send raw email, raw user id, or any reversible identifier. See
[privacy-consent.md](privacy-consent.md) forbidden keys and
[identity-sessions.md](identity-sessions.md) for hashing and stitching.

## sGTM vs the MP endpoint — keep them apart

Routing browser Google tags through a first-party sGTM endpoint is **not** the
same as POSTing to the GA4 MP endpoint. If a backend sends MP-format requests to
an sGTM Measurement Protocol client, that client has its own endpoint, client
config, tag config, and debug workflow. Do not carry GA4 MP endpoint validation
assumptions over to it.

Whichever path is chosen, the plan must name the exact endpoint/path, the
client, the tags, any custom template code, and the first-party endpoint
contract. "sGTM transformations" that are not executable client/tag config is
not a plan.

## Quotas

Per request:

- 25 events per request (batched in `events[]`).
- 25 params per event (same cap as client).
- JSON POST body under 130 KB.
- Parameter names ≤ 40 chars.
- Parameter values ≤ 100 chars (Standard) or ≤ 500 chars (Analytics 360).

When batching, shard to satisfy both the 25-event and 130-KB limits. Keep retries
jittered and bounded.

## Verification for this tier

- [ ] Every catalog event validated through the debug endpoint, zero errors.
- [ ] One round-trip event lands in DebugView within 60s.
- [ ] Queue overflow simulation: 10× normal load, request latency unchanged, drop
      counter increments.
- [ ] Worker crash mid-send: no double-fire on restart (idempotency via
      `event.id` or `transaction_id`).
- [ ] Consent denied path: zero outbound calls to `google-analytics.com`.
- [ ] The client tier underneath still reports normally — tier 3 did not silently
      replace automatic collection.
- [ ] Server events are not duplicating client events for the same occurrence.

## Downgrade check

If, after design, no bullet in "Choose tier 3 when" survives contact with the
real numbers, say so and drop to tier 1 or 2. A tier-3 plan whose only
justification is "more accurate" is a tier-1 plan with an ops bill attached.
