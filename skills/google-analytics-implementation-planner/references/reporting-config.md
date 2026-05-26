# GA4 reporting config — dimensions, metrics, custom definitions

Authoritative refs:
- CONFIRMED: <https://support.google.com/analytics/answer/14240153> (custom dimensions & metrics)
- CONFIRMED: <https://support.google.com/analytics/answer/9355671> (cardinality)
- CONFIRMED: <https://support.google.com/analytics/answer/14071986> (Explorations limits)
- CONFIRMED: <https://support.google.com/analytics/table/13594742> (event parameters and prebuilt dimensions/metrics)
- CONFIRMED: <https://support.google.com/analytics/answer/12229021> (custom events and parameter cardinality)

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

## Predefined-first rule

Custom definitions are scarce and sticky. Before proposing any custom
dimension or metric, check whether GA4 already provides the answer via:

- automatically collected or enhanced-measurement events
- recommended-event parameters
- predefined dimensions/metrics such as page/screen, traffic source,
  device, geo, campaign, browser, operating system, landing page, and
  session source/medium
- User-ID, transaction ID, or ecommerce `items[]` semantics

Only create a custom definition when a named decision cannot be answered
from those built-ins. The registration table must include the predefined
alternative that was checked. A first-pass implementation should usually
stay in single digits; more than 10 custom definitions needs explicit
justification. Never generate 50-ish dimensions from "all params we might
want someday."

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

Custom definitions can be archived to free quota for new definitions,
but archiving breaks dependent audiences, explorations, reports, and ads
integrations. Be deliberate.

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

## Missing values and boolean flags

Do not create boolean presence dimensions like `geo_exists`,
`has_referrer`, `search_has_results`, or `error_has_stack`. They add
slots without adding meaning.

Use one meaningful parameter whose absence is meaningful:

- Internal contract/tests: `geo: null`, `referrer_domain: null`,
  `result_count_bucket: "zero" | "1_10" | "11_100" | "100_plus"`.
- GA4 payload: send the normalized value when present; omit null values
  before sending. Missing then shows as absent / `(not set)` in GA4 and
  as null/missing in exports.

Only use a boolean when the decision is genuinely boolean and the name
describes the state itself, not the presence of another field (for
example, `is_trial_account` may be valid; `trial_account_exists` is not).

## Group-specific dimensions

GA4 does not need a generic category/action/label triplet. For each
event group, define the specific low-cardinality parameters that make
that group's reports useful, then register only the parameters the team
will actually group/filter by. Treat "event group" as planning
taxonomy; don't log a generic `event_group` parameter just to recreate
Universal Analytics categories. Prefer built-ins first: for geo, device,
campaign, page/screen, and traffic source questions, use GA4's predefined
dimensions unless the plan proves they cannot answer the decision.

Examples:

- Auth: `method`, `login_result`, `account_type`.
- Search: `search_location`, `result_count_bucket`.
- Content: `content_type`, `feature_area`.
- Funnel: `funnel_name`, `funnel_step`, `plan_tier`.
- Errors: `error_class`, `surface`, `severity`.

If a parameter is useful only for debugging one event, leave it as an
unregistered event parameter. If it will appear in reports across a
group, include it in the custom-definition registration table.

## Registration table (the artifact you hand to the implementer)

The plan must include a table the implementer pastes into Admin →
Property → Custom Definitions. Format:

Dimensions:

| Display name | Parameter/User property | Scope | Event group(s) | GA4 predefined alternative checked | Description | Decision/use |
| --- | --- | --- | --- | --- | --- | --- |
| Plan tier | `plan_tier` | User | auth, funnel | none | Subscription tier at event time | D1, D3 |
| Feature area | `feature_area` | Event | content, system | Page path/screen name is too broad | Top-level product area | D1 |
| Search location | `search_location` | Event | search | Search term is not enough | UI surface that initiated search | D2 |
| Experiment variant | `experiment_variant` | User | all | none | A/B test cell | D4 |

Metrics:

| Display name | Parameter | Scope | Event group(s) | GA4 predefined alternative checked | Description | Unit | Decision/use |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Latency | `latency_ms` | Event | system | no equivalent for app-specific timing | Server response time | ms | D5 |

For metrics, specify the unit so the GA4 UI labels reports correctly:
`Standard`, `Currency`, `Feet`, `Miles`, `Meters`, `Kilometers`,
`Milliseconds`, `Seconds`, `Minutes`, `Hours`.

## What NOT to register

- Anything GA4 already provides as a built-in dimension (`page_path`,
  `page_referrer`, `device_category`, `country`, `browser`,
  `operating_system`, `landing_page`, `session_source_medium`,
  `first_user_source_medium`). Registering custom-dimension duplicates
  wastes slots and produces conflicting reports.
- Boolean presence flags (`*_exists`, `has_*`) that only restate whether
  another parameter was populated.
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
