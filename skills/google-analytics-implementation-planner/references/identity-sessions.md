# Identity and sessions in GA4

Authoritative refs:
- CONFIRMED: <https://support.google.com/analytics/answer/9355972> (User-ID feature)
- CONFIRMED: <https://support.google.com/analytics/answer/9213390> (session unification)
- CONFIRMED: <https://developers.google.com/analytics/devguides/collection/ga4/cookies-user-id>
- CONFIRMED: <https://support.google.com/analytics/answer/11986666> (GA4 vs UA session differences)
- CONFIRMED: <https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference> (MP identifiers)

## The two ids

GA4 attributes every event to two ids. Both matter; both have failure
modes.

### `client_id` — the device/browser

- Auto-minted by gtag.js into the `_ga` cookie. Format:
  `GA1.1.<random>.<timestamp>`.
- Server-side: you mint it yourself OR copy it from the `_ga` cookie
  forwarded by the browser. Must be a string that persists across
  events for the same browser/device — generate once, store on the
  user row or in a long-lived cookie.
- Cleared by: browser cookie purge, incognito session end, user logout
  if you tie cookie lifetime to session.
- Persistence target: 2 years (matches `_ga` cookie default; the cookie
  resets on every visit so it survives indefinitely for active users).

For app streams using Measurement Protocol, the parallel identifier is
`app_instance_id` in the request body, with `firebase_app_id` in the URL.
Do not send app MP events with a web `client_id` contract.

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
- Clear permanently on account deletion (User-Deletion API).
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
4. GA4 retroactively stitches the pre-login `client_id` history into
   the authenticated user's profile via the User-ID + Device-ID
   reporting identity.

Pitfalls:

- If the post-login event fires from the SERVER (e.g., session created
  on the backend), you must forward the `client_id` from the browser to
  the server (read `_ga` cookie, send in the session-create call). The
  server has no other way to learn it.
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

`gtag.js` mints `_ga_<MEASUREMENT_ID>` cookie containing a session
counter and timestamp, manages timeouts, and exposes `ga_session_id`
and `ga_session_number` automatically. Don't override unless you have
a documented reason — the auto behavior is correct.

### Server-side (Measurement Protocol): manual

You MUST set `session_id` in every event's `params`. Without it,
sessions count as new on every event (or worse, GA4 fills a synthetic
default that breaks session-scoped reports).

Two patterns:

**Pattern A — read from browser cookie:**

```
session_id = parse_session_id(_ga_<MEASUREMENT_ID> cookie)
```

The cookie value is `GS1.1.<session_start_unix>.<session_count>.…`.
Take the `session_start_unix` portion as `session_id`. Works only if
the server event is in the same request lifecycle as a browser request.

**Pattern B — mint and persist server-side:**

For pure-backend events (webhook, cron), mint a `session_id` per user
per 30-minute window:

```
key = "session:" + user_id + ":" + (now // 1800)
session_id = redis.get_or_set(key, now, ttl=1800)
```

This synthesizes server-side sessions that align with GA4's 30-minute
default.

Also required in every event's params for active-user accounting:

```
engagement_time_msec
```

Without it, events arrive but the user is not counted active. For
pure-server events without a real duration, use a small positive
integer (100). For events that measure something (latency, render
time), use the real value.

## Identity stitching across web + app + server

If you have a web stream, an app stream, and server-side calls, and
want all three to land on the same user:

1. Every event must carry `user_id` once authenticated.
2. Every event must carry the surface's GA4 device/app identifier:
   web uses `client_id` from the `_ga` cookie; app streams use
   `app_instance_id`; server-only events use the persisted identifier
   linked to the user and accepted in the plan's reporting trade-off.
3. Property setting: Admin → Property → Reporting Identity → choose
   "Blended" or "Observed" so GA4 uses both `user_id` and the
   device/app identifier for stitching.

## Logout, deletion, rotation

- **Logout:** clear `user_id` on the next event, keep `client_id`. The
  user is now anonymous on this device until next login.
- **Account deletion:** call User-Deletion API with every known
  `user_id` plus relevant web `client_id` / app `app_instance_id` for
  that user. Propagate to BigQuery export. See
  [privacy-consent.md](privacy-consent.md) §erasure.
- **Pepper rotation:** maintain old and new hashes during a window;
  send events with the new hash; backfill stored ids. Never have two
  active peppers in production for the same user.
