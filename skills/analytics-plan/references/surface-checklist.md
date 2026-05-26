# Trackable-surface checklist

Use during step 1.2 of the SKILL. The point is to **enumerate**, not
to "track everything" — most surfaces will get cut in step 1.1 because
no decision needs them. But you can't decide to cut what you haven't
listed.

For each surface in the codebase, fill the row:

| Surface | Where it lives (`file:line`) | Decision it serves | Keep / cut |

A surface kept must trace to a decision from step 1.1. A surface cut
gets one line explaining why ("not enough volume", "duplicates X",
"PII risk").

## Web — page and screen

- [ ] Landing pages — logical names, not URLs (`/` → `home`,
      `/pricing` → `pricing`).
- [ ] Authenticated app screens (dashboard, settings, profile).
- [ ] Modal/dialog opens, if they're meaningful (pricing modal,
      onboarding step).
- [ ] Empty states (worth tracking if they correlate to drop-off).
- [ ] 404 / 500 pages (volume + path tells you broken inbound links).

## Auth

- [ ] `sign_up` (recommended GA4 name) — fire ONCE per user, on the
      moment of successful account creation.
- [ ] `login` (recommended) — every successful login. Include `method`
      param (password / oauth_google / oauth_github / sso / magic_link).
- [ ] `login_failed` — custom. Bucket by reason (bad_password,
      no_account, mfa_failed, rate_limited).
- [ ] `logout` — custom.
- [ ] `password_reset_request`, `password_reset_complete`.
- [ ] `mfa_enabled`, `mfa_disabled`, `mfa_challenge_failed`.
- [ ] `email_verification_sent`, `email_verification_complete`.

Anti-pattern: firing `sign_up` on every visit to `/signup`. The event
is the success, not the page view.

## Core CRUD per domain object

For each domain object (project, document, customer, invoice…):

- [ ] `<object>_created` (or `select_content` with `content_type=<object>`
      for cases the recommended naming fits).
- [ ] `<object>_updated` — debounce / coalesce; don't fire per
      keystroke.
- [ ] `<object>_deleted`.
- [ ] `<object>_archived` / `_restored` (if applicable).
- [ ] `<object>_shared` — use recommended `share` event with
      `content_type`, `item_id`, `method`.

## Search, filter, sort

- [ ] `search` (recommended) — params: `search_term`. **Scrub the
      term** before sending (no PII, no tokens).
- [ ] `view_search_results` (automatic in Enhanced Measurement if
      `?q=` is in URL — don't double-fire).
- [ ] `search_no_results` — custom; high signal for content gaps.
- [ ] `filter_applied` — params: `filter_field`, `filter_value`
      (bounded set).
- [ ] `sort_applied` — params: `sort_field`, `sort_direction`.

## Funnels (multi-step flows)

For each multi-step flow, fire one event per step with a shared
`flow_id` so funnel analysis is trivial:

- [ ] Onboarding: `tutorial_begin` → `<step_name>` → `tutorial_complete`.
- [ ] Checkout: `begin_checkout` → `add_shipping_info` →
      `add_payment_info` → `purchase` (all recommended names).
- [ ] Upgrade: `view_promotion` → `select_promotion` → `view_plan` →
      `purchase`.
- [ ] Custom multi-step wizards: `<flow>_step_started`,
      `<flow>_step_completed`, `<flow>_abandoned` (with `last_step`).

## Settings & preferences

- [ ] `setting_changed` — params: `setting_name`, `setting_value`
      (only if low-cardinality safe value).
- [ ] `theme_changed`, `language_changed`, `notification_toggled`.
- [ ] `account_deleted` — terminal event; ensure it fires BEFORE the
      User-Deletion API call so the event makes it through.

## Sharing, invites, virality

- [ ] `share` (recommended) — content shared out.
- [ ] `invite_sent` — params: `invite_method` (email / link /
      integration).
- [ ] `invite_accepted` — fired on the invitee, with
      `referrer_user_id` (hashed).
- [ ] `referral_landed` — first event from an invited user.

## Navigation

- [ ] Primary nav clicks — only if you have a decision around nav
      reorganization. Otherwise cut; this is event spam.
- [ ] CTA clicks on landing page — `select_content` with descriptive
      `content_id` (`hero_cta`, `pricing_cta_top`).
- [ ] External-link clicks (automatic in Enhanced Measurement as
      `click`).

## Errors

- [ ] Server-side errors — `error` event (custom; GA4 reserves but
      allows). Params: `error_class`, `error_route`, `status_code`,
      `error_id` (correlate to logs).
- [ ] Client-side errors — `window.onerror` and
      `unhandledrejection`. Bucket by `error_class`; never send the
      message (may contain PII).
- [ ] API errors visible to user — `api_error` with `endpoint`,
      `status_code`, `error_code`.

## Performance

- [ ] Core Web Vitals (LCP, FID/INP, CLS) — fire on page-hide as
      events `web_vitals` with `metric_name`, `metric_value` (metric).
      Several published patterns; use `web-vitals` npm package or
      equivalent.
- [ ] Slow server response — `slow_request` if a route exceeds a
      threshold. Params: `route_template`, `latency_ms` (metric).
- [ ] Long task — `long_task` from `PerformanceObserver`.

## Background, cron, async

- [ ] Job started / completed — `job_started`, `job_completed`. Params:
      `job_type`, `duration_ms`, `result` (success / failure).
- [ ] Webhook received — `webhook_received` with `source`,
      `event_type`.
- [ ] Email delivered — `email_delivered`, `email_opened`,
      `email_clicked` (`select_content` with `content_type=email` if
      preferring recommended names).

## Lifecycle moments

- [ ] First-run — `first_visit` (auto), `app_first_open` (auto on
      Firebase).
- [ ] Activation — define what activation means (sent first message?
      created first project? invited first teammate?) and fire one
      `activation_completed` per user when the criterion is met.
- [ ] Retention — Day-1, Day-7, Day-30 events. Server-minted on
      schedule, attached to the user via `user_id`.
- [ ] Churn signal — last-active beyond N days, fire `inactive_<N>d`
      from the backend.

## Ecommerce (only if real revenue exists; otherwise reserve in plan)

- [ ] `view_item_list`, `select_item` (catalog browsing).
- [ ] `view_item` (PDP).
- [ ] `add_to_cart`, `remove_from_cart`, `view_cart`.
- [ ] `begin_checkout`, `add_shipping_info`, `add_payment_info`.
- [ ] `purchase` — `transaction_id` (idempotent!), `currency`
      (ISO-4217), `value` = Σ items, `items[]`.
- [ ] `refund` — `transaction_id` must match the original `purchase`.

Do NOT fire ecommerce events with synthetic `currency` and
`value: 0` on non-revenue actions. Monetization reports cannot be
"untagged" once polluted.

## Cuts the checklist forces

The point of listing everything is that step 1.1 cuts most of it.
A typical SaaS plan emerges with ~25–40 kept events, not 200. Push
back hard on "we should track everything" — it's wrong twice (privacy
floor + report noise).
