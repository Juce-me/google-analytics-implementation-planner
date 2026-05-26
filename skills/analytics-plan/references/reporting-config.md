# GA4 reporting config — dimensions, metrics, custom definitions

Authoritative refs:
- <https://support.google.com/analytics/answer/10075209> (custom dimensions & metrics)
- <https://support.google.com/analytics/answer/9355671> (cardinality)
- <https://support.google.com/analytics/answer/14071986> (Explorations limits)

## The dimension-vs-metric decision

For every parameter you fire, decide it's exactly one:

- **Dimension** if you'll **group / filter / pivot** by it. Categorical.
  Examples: `plan_tier`, `feature_area`, `signup_method`, `locale`,
  `experiment_variant`.
- **Metric** if you'll **aggregate** it (sum, average). Numeric with a
  unit. Examples: `latency_ms`, `items_count`, `score`, `duration_sec`.

Hybrids fail in reports. `latency_bucket = "slow"` is a dimension; the
underlying `latency_ms` is a metric. Pick the one the report needs and
fire that one (or both, if both reports are needed — paying the
parameter slot is fine).

## Scope: event vs user

- **Event-scoped** dimension/metric: attached to a single event,
  re-evaluated per event. Use for: anything that varies per
  interaction. Default choice.
- **User-scoped** dimension: attached to the user, sticky across the
  session/property until overwritten. Use for: `plan_tier`,
  `account_age_bucket`, `experiment_assignment` (sticky), `signup_cohort`.
  Caps are tighter (25 vs 50 on Standard).
- **Item-scoped**: attached to ecommerce `items[]` entries. Use for
  product-catalog attributes (`item_brand`, `item_category`,
  `item_variant`). Only valid inside `items[]`.

Don't promote an event-scoped dimension to user-scoped to "get
persistence" — that's how you blow the user-dimension cap with values
that should have been event params.

## Custom definition caps (current, verify before locking)

| | Standard | 360 |
| --- | --- | --- |
| Event-scoped custom dimensions | 50 | 125 |
| User-scoped custom dimensions | 25 | 100 |
| Item-scoped custom dimensions | 10 | 25 |
| Event-scoped custom metrics | 50 | 125 |
| Audiences | 100 | 400 |
| Conversions (key events) | 30 | 50 |

Once registered, a custom dimension cannot be deleted (only archived).
Archiving doesn't reclaim the slot fully — be deliberate.

## Cardinality — the silent killer

GA4 has a daily cardinality limit per dimension (~500 unique values
per day on Standard). Exceed it and GA4 collapses excess values into
`(other)` for that day. Reports across that dimension become unusable
for the high-cardinality tail.

**High-cardinality traps — don't register as a dimension:**

- `user_id` (use the User-ID property field instead).
- `session_id`.
- `order_id` / `transaction_id` (use `transaction_id` in the purchase
  event params — GA4 indexes it without you registering a dimension).
- `client_id`.
- Full URLs with unique query strings (use `page_location` with query
  stripped, or a `page_template` dimension).
- Raw search queries (use a bucketed `search_term_category` instead).
- Free-text user content.

**Safe-cardinality candidates:**

- `plan_tier` (handful of values).
- `feature_area` (one of ~20 product areas).
- `experiment_variant` (a / b / control).
- `locale` (under 200 values normally).
- `referrer_domain` (bounded if you bucket "(other)" yourself first).

If you need high-cardinality analysis (per-user, per-order), use the
**BigQuery export**, not custom dimensions. That's what BQ export is
for.

## Registration table (the artifact you hand to the implementer)

The plan must include a table the implementer pastes into Admin →
Property → Custom Definitions. Format:

| Display name | Parameter name | Scope | Description | Unit |
| --- | --- | --- | --- | --- |
| Plan tier | `plan_tier` | User | Subscription tier at event time | — |
| Feature area | `feature_area` | Event | Top-level product area | — |
| Latency | `latency_ms` | Event (metric) | Server response time | ms |
| Experiment variant | `experiment_variant` | User | A/B test cell | — |

For metrics, specify the unit so the GA4 UI labels reports correctly:
`Standard`, `Currency`, `Feet`, `Miles`, `Meters`, `Kilometers`,
`Milliseconds`, `Seconds`, `Minutes`, `Hours`.

## What NOT to register

- Anything GA4 already provides as a built-in dimension (`page_path`,
  `page_referrer`, `device_category`, `country`, `browser`,
  `operating_system`, `landing_page`, `session_source_medium`,
  `first_user_source_medium`). Registering custom-dimension duplicates
  wastes slots and produces conflicting reports.
- IDs and tokens (cardinality, already covered).
- Parameters you only fire on 1–2 events and won't filter or group by
  — leave them as plain event parameters. You can still see them in
  DebugView and pull them via BigQuery export.

## Conversions (now "key events")

GA4 renamed "conversions" to "key events" in 2024. The mechanism is
unchanged: mark up to 30 events as key events (Standard), and they
populate Conversion-style reports + can drive audiences.

Pick deliberately. A key event should be the moment that satisfies a
goal stated in step 1.1 of the plan (a decision the data drives), not
"every signup-adjacent event we have".

## Audiences

Build audiences from registered dimensions + key events. Limits:

- 100 audiences (Standard), 400 (360).
- Lookback window: up to 540 days.
- Membership is sticky to the user until exit conditions trigger.

Audiences feed Google Ads if linked. If the property is linked to ads,
the privacy posture (Consent Mode v2, `ad_user_data` signal) gates
which users actually feed the ads audience. Don't promise marketing
audiences will be full — they'll be modeled-only for denied-consent
traffic.

## Reporting Identity setting

Admin → Property → Reporting Identity. Three options:

- **Blended** (recommended for most): uses User-ID, then signals, then
  device. Most stitching, modeled gaps.
- **Observed**: User-ID + device only. No modeling. Less complete.
- **Device-based**: device only. Highest privacy posture, least
  stitching.

Pick deliberately in the plan; the user often inherits whatever the
default was at property creation.
