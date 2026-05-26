# Identity and sessions in GA4

Authoritative refs (last checked: 2026-05-26):
- CONFIRMED: <https://support.google.com/analytics/answer/9355972> (User-ID feature)
- CONFIRMED: <https://support.google.com/analytics/answer/9213390> (session unification)
- CONFIRMED: <https://developers.google.com/analytics/devguides/collection/ga4/cookies-user-id>
- CONFIRMED: <https://support.google.com/analytics/answer/11986666> (GA4 vs UA session differences)
- CONFIRMED: <https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference> (MP identifiers)
- CONFIRMED: <https://developers.google.com/tag-platform/gtagjs/reference#get> (`gtag('get')`)
- CONFIRMED: <https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1alpha/properties/submitUserDeletion> (GA4 Admin API user deletion)

## The two ids

GA4 attributes every event to two ids. Both matter; both have failure
modes.

### `client_id` — the device/browser

- Auto-minted by gtag.js and retrievable with
  `gtag('get', 'G-XXXXXXX', 'client_id', callback)`.
- Server-side: forward the value returned by `gtag('get')` from the
  browser. Cookie parsing is a fallback only, because `_ga` cookie formats
  are implementation details. If no browser/device exists, mint a stable
  id and accept the partial-reporting trade-off.
- Cleared by: browser cookie purge, incognito session end, user logout
  if you tie cookie lifetime to session.
- Persistence target: 2 years (matches `_ga` cookie default; the cookie
  resets on every visit so it survives indefinitely for active users).

For app streams using Measurement Protocol, the parallel identifier is
`app_instance_id` in the request body, with `firebase_app_id` in the URL.
Retrieve `app_instance_id` from the Firebase SDK after analytics
collection initializes; do not mint it server-side, and do not send app MP
events with a web `client_id` contract. If analytics storage is denied and
the SDK returns no app instance id, do not send app MP for that user/device.

### `user_id` — the authenticated identity

- Optional. Set it only AFTER login.
- **Must be hashed AND peppered.** SHA-256 of the email is reversible
  with a user list (rainbow-table or breach correlation). Mix in a
  server-only secret:
  ```
  user_id = hex(sha256(email_lowercased || PEPPER))
  ```
  where `PEPPER` is a 32+ byte secret rotated quarterly. On rotation,
  re-hash all stored ids in a backfill — don't run with two ids per
  user.
- Clear on logout (set to null on subsequent events).
- Clear permanently on account deletion (GA4 Admin API
  `properties.submitUserDeletion` plus downstream stores).
- **Cardinality is not a problem for `user_id` itself** — it's a
  property-level field, not a custom dimension. The cardinality trap
  hits when you also try to register `user_id` as a custom dimension.
  Don't.

## Anonymous → authenticated stitching

The flow GA4 expects:

1. User lands anonymous → events fire with `client_id` only.
2. User signs up / logs in → on the FIRST authenticated event, fire
   with both `client_id` AND `user_id`.
3. All subsequent events carry both until logout.
4. GA4 can associate anonymous and authenticated activity when the same
   device/session later carries both identifiers. Do not promise that all
   older historical events are reprocessed after `user_id` is set.

Pitfalls:

- If the post-login event fires from the SERVER (e.g., session created
  on the backend), you must forward the `client_id` from the browser to
  the server using `gtag('get', ..., 'client_id', callback)` and include
  it in the session-create call. The server has no other documented way to
  learn it.
- If the user signs in on a NEW device, GA4 still attributes by
  `user_id` but cross-device blending depends on your reporting
  identity setting (Blended / Observed / Device-based).
- If you fire `login` with `user_id` but no `client_id`, GA4 treats it
  as a server-only event and your web session count is wrong.

## Sessions

GA4 defines a session as "a group of user interactions on your site/app
within a given time frame". Defaults:

- 30 minutes of inactivity → session ends.

GA4 sessions are **not** restarted at midnight and are **not** restarted
when new campaign parameters are encountered. Those are Universal
Analytics behaviors; don't copy them into server-minted GA4 sessions.

### Client-side (gtag.js): automatic

`gtag.js` manages GA4 web sessions and exposes `session_id` and
`session_number` through `gtag('get', 'G-XXXXXXX', ...)`. Don't override
unless you have a documented reason — the auto behavior is correct.

### Server-side (Measurement Protocol): manual

Set `session_id` in MP event params whenever the event should join a
known session. Without it, Realtime, engagement, session attribution, and
User-ID assignment use cases are incomplete or misleading.

Two patterns:

**Pattern A — forward from the browser:**

```
gtag('get', 'G-XXXXXXX', 'session_id', callback)
```

Forward the returned value to the server for events in the same browser
session. Cookie parsing is a fallback implementation detail, not the
contract.

**Pattern B — mint and persist server-side:**

For pure-backend events (webhook, cron), mint a `session_id` per user
per 30-minute window:

```
key = "session:" + user_id + ":" + (now // 1800)
session_id = redis.get_or_set(key, now, ttl=1800)
```

This synthesizes server-side sessions that align with GA4's 30-minute
default.

Also needed in MP event params for active-user and Realtime reporting:

```
engagement_time_msec
```

Without it, events can arrive but the user is not counted active. For
pure-server events without a real duration, use a small positive
integer (100). For events that measure something (latency, render
time), use the real value.

## Identity stitching across web + app + server

If you have a web stream, an app stream, and server-side calls, and
want all three to land on the same user:

1. Every event must carry `user_id` once authenticated.
2. Every event must carry the surface's GA4 device/app identifier:
   web uses `client_id` retrieved via `gtag('get')`; app streams use
   SDK-derived `app_instance_id`; server-only events use the persisted
   identifier linked to the user and accepted in the plan's reporting
   trade-off.
3. Property setting: Admin → Property → Reporting Identity → choose
   "Blended" or "Observed" so GA4 uses both `user_id` and the
   device/app identifier for stitching.

## Logout, deletion, rotation

- **Logout:** clear `user_id` on the next event, keep `client_id`. The
  user is now anonymous on this device until next login.
- **Account deletion:** call GA4 Admin API `properties.submitUserDeletion`
  once per known identifier (`userId`, `clientId`, or `appInstanceId`)
  for that user. Propagate to BigQuery export and other downstream stores.
  See
  [privacy-consent.md](privacy-consent.md) §erasure.
- **Pepper rotation:** maintain old and new hashes during a window;
  send events with the new hash; backfill stored ids. Never have two
  active peppers in production for the same user.
