# GA4 server-side — Measurement Protocol

Authoritative docs:
- <https://developers.google.com/analytics/devguides/collection/protocol/ga4>
- <https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events>
- <https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events>

Re-verify before locking a plan — Google has changed payload shape and
required fields more than once.

## When to use server-side at all

Use Measurement Protocol when **at least one** is true:

- You need data ad-blockers can't drop (paid funnel, fraud signals).
- The event happens off-browser (cron job finished, webhook fired,
  background renderer completed).
- The browser doesn't have the truth (server-only context: real
  user-agent, real IP for geo, true duration, request id).
- Compliance forbids client-side beacons (strict EU defaults, child
  audiences with COPPA disable).

If none apply, gtag.js is cheaper, simpler, and gives you Consent Mode
v2 modeling for free. Don't pay the server-side tax for nothing.

## Endpoint and auth

```
POST https://www.google-analytics.com/mp/collect
  ?measurement_id=G-XXXXXXX
  &api_secret=<from Admin → Data Streams → Measurement Protocol API secrets>
```

Debug endpoint (validates payload, returns errors, does NOT count
toward your data):

```
POST https://www.google-analytics.com/debug/mp/collect?measurement_id=...&api_secret=...
```

Use the debug endpoint in CI for every event in the catalog.

## Payload shape (the contract)

```json
{
  "client_id": "555.123",
  "user_id": "<hashed+peppered authenticated id, optional>",
  "timestamp_micros": 1716700000000000,
  "non_personalized_ads": true,
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

### Required-or-it-silently-drops fields

- `client_id` — must match what gtag.js mints on the browser if you want
  to stitch web + server events. Read `_ga` cookie value, strip the
  `GA1.1.` prefix. If the event is purely server-side (no browser
  involved), mint a stable id (UUIDv4) and persist it.
- Inside every event's `params`:
  - `session_id` — server-side does NOT inherit GA4's auto session.
    Either mint one (UNIX seconds at session start, persist for 30 min
    inactivity) or read it from the `_ga_<MEASUREMENT_ID>` cookie.
  - `engagement_time_msec` — without this, the event does not register
    an active user. Set to a small positive integer (100 is the common
    floor) for non-engagement events; set to the real value for
    measured-duration events.

### Common silent failures

- `timestamp_micros` more than 72h in the past → event dropped, no
  error in production endpoint. Debug endpoint surfaces it.
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
- **Retry with jitter** for 5xx and network errors; do not retry 4xx
  (those are payload bugs, fix them).
- **Fail silent for users** — analytics failures never surface in UI.
- **Log without PII** — log the event name, timestamp, queue depth,
  retry count; never log the params.

## Identity stitching server-side

If a server event represents an authenticated action (e.g., webhook
from Stripe → user upgraded), and you have both the `client_id`
(stored on the user row when they first signed up via the browser) and
the hashed-peppered `user_id`:

- Set both on the event.
- GA4 will stitch the server event into the same user's timeline.
- If you only have `user_id`, GA4 still attributes correctly but
  cross-device blending may suffer.

Never send raw email, raw user_id, or any reversible identifier. See
[privacy-consent.md](privacy-consent.md) §forbidden-keys.

## Quotas

Per measurement id:
- 500 events per request (batched in the `events` array).
- 25 params per event (same cap as client).
- 4 MB per request body.

Soft rate limit ~10 RPS per measurement id without warning — if your
load exceeds that, add jitter / batching / and consider Measurement
Protocol's recommended batch size (50 events per call).

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
