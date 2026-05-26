# GA4 server-side — Measurement Protocol

Authoritative docs (last checked: 2026-05-26):
- CONFIRMED: <https://developers.google.com/analytics/devguides/collection/protocol/ga4>
- CONFIRMED: <https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference>
- CONFIRMED: <https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events>
- CONFIRMED: <https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events>

Re-verify before locking a plan — Google has changed payload shape and
required fields more than once.

## When to use server-side at all

Measurement Protocol **augments** automatic collection through gtag.js,
GTM, or Firebase. It is not the default replacement for client/app
tagging; full server-to-server GA4 can produce partial reporting.

Use Measurement Protocol when **at least one** is true:

- You need data ad-blockers can't drop (paid funnel, fraud signals).
- The event happens off-browser (cron job finished, webhook fired,
  background renderer completed).
- The browser doesn't have the truth (server-only context: local
  geo/device enrichment from request metadata, true duration, request id).
- You are joining online and offline behavior and already have the
  browser/app identifier from automatic collection.

If none apply, gtag.js is cheaper, simpler, and gives you Consent Mode
v2 behavior through Google tags. Don't pay the server-side tax for
nothing. If compliance forbids any client/app beacon, escalate instead
of assuming MP is a safe workaround.

## Endpoint and auth

Web stream:

```
POST https://www.google-analytics.com/mp/collect
  ?measurement_id=G-XXXXXXX
  &api_secret=<from Admin → Data Streams → Measurement Protocol API secrets>
```

For EU regional collection requirements, use:

```
POST https://region1.google-analytics.com/mp/collect
  ?measurement_id=G-XXXXXXX
  &api_secret=<from Admin → Data Streams → Measurement Protocol API secrets>
```

App stream:

```
POST https://www.google-analytics.com/mp/collect
  ?firebase_app_id=<Firebase app id>
  &api_secret=<from Admin → Data Streams → Measurement Protocol API secrets>
```

Debug endpoint (validates payload, returns errors, does NOT count
toward your data):

```
POST https://www.google-analytics.com/debug/mp/collect?measurement_id=...&api_secret=...
```

Use `firebase_app_id` instead of `measurement_id` for app streams. Use
the debug endpoint in CI for every event in the catalog. For app streams,
the body must carry an `app_instance_id` retrieved from the Firebase SDK
after SDK collection has initialized; do not mint it server-side.

## Payload shape (the contract)

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

- Web streams: `client_id` is required for MP web events. Use
  `gtag('get', 'G-XXXXXXX', 'client_id', callback)` in the browser and
  forward the value to the server. Cookie parsing is a fallback only,
  because cookie formats are implementation details. If the event is
  purely server-side (no browser involved), mint a stable id (UUIDv4) and
  persist it, while accepting partial reporting.
- App streams: use `firebase_app_id` in the URL and `app_instance_id` in
  the body. `app_instance_id` is not the same as a web `client_id`; get
  it from the Firebase SDK. If analytics storage is denied and the SDK
  returns no app instance id, do not send app MP for that user/device.
- Inside every event's `params`:
  - `session_id` — server-side does NOT inherit GA4's auto session. Use
    `gtag('get', 'G-XXXXXXX', 'session_id', callback)` and forward it
    when the event belongs to a browser session, or mint a server-side
    session for pure-backend flows. This is critical for Realtime,
    session attribution, and User-ID assignment use cases.
  - `engagement_time_msec` — needed for Realtime and active-user reporting.
    Set to a small positive integer (100 is the common floor) for
    non-engagement events; set to the real value for measured-duration
    events.

### Common silent failures

- Production endpoint returns `2xx` when the HTTP request is received,
  even if the payload is malformed, incorrect, or not processed. Use the
  debug endpoint and `ENFORCE_RECOMMENDATIONS` validation before live
  sends.
- More than 25 events in the `events[]` array or JSON POST body
  >= 130 KB → payload is outside MP limits.
- `timestamp_micros` more than 72h in the past → default `RELAXED`
  validation clamps the timestamp to 72 hours ago; `ENFORCE_RECOMMENDATIONS`
  rejects it. Debug endpoint surfaces the issue.
- Missing `engagement_time_msec` → event lands but doesn't count as
  active user. Reports look right; user metrics are wrong.
- `client_id` regenerated per request → every server event creates a
  new user. Persist it.
- POST body sent as form-encoded instead of JSON → 204 from the server,
  zero events ingested.
- HTTP/1.1 from a backend that doesn't keep-alive → throughput collapses.
  Use a pooled HTTP client.

## Queue & worker pattern (mandatory if calls hit a user-facing path)

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

Rules:

- **Bounded queue**, never unbounded — analytics must not OOM the
  service.
- **Drop on overflow** with a counter (`analytics.dropped.total`); never
  block the request path.
- **Retry with jitter** only for transport failures where receipt is
  unknown. Do not retry the same payload after an HTTP non-2xx response;
  validate and fix payload bugs instead. Document idempotency limits.
- **Fail silent for users** — analytics failures never surface in UI.
- **Log without PII** — log the event name, timestamp, queue depth,
  retry count; never log the params.

## Identity stitching server-side

If a server event represents an authenticated action (e.g., webhook
from Stripe → user upgraded), send the stream/device identifier plus the
hashed-peppered `user_id` when available:

- Web MP requires `client_id`; app MP requires `app_instance_id`.
- Set `user_id` as optional identity enrichment, not as a substitute for
  `client_id` / `app_instance_id`.
- Session-specific attribution also needs a valid `session_id` within the
  documented window.

Never send raw email, raw user_id, or any reversible identifier. See
[privacy-consent.md](privacy-consent.md) §forbidden-keys.

## Server-side GTM caveat

Routing Google tags through a first-party server-side GTM endpoint is not
the same as POSTing to the GA4 Measurement Protocol endpoint. If a backend
sends MP-format requests to an sGTM Measurement Protocol client, document
the sGTM endpoint, client, tag, and debug workflow separately; do not reuse
the GA4 MP endpoint validation assumptions blindly.

## Quotas

Per request:
- 25 events per request (batched in the `events` array).
- 25 params per event (same cap as client).
- JSON POST body must be less than 130 KB.
- Parameter names: 40 chars or fewer.
- Parameter values: 100 chars or fewer for Standard properties, 500
  chars or fewer for Analytics 360 properties.

If you batch, shard into chunks that satisfy both the 25-event and
130-KB limits. Keep retries jittered and bounded.

## Test plan

- [ ] All catalog events validated through the debug endpoint, zero
      errors.
- [ ] One purchase round-trip lands in GA4 DebugView within 60s.
- [ ] Queue overflow simulation: 10× normal load, request latency
      unchanged, drop counter increments.
- [ ] Worker crash mid-send: no double-fire on restart (idempotency via
      `event.id` or `transaction_id`).
- [ ] Consent denied path: zero outbound calls to
      `google-analytics.com`.
