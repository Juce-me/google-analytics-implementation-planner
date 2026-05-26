# GA4 event schema — names, parameters, limits

Always verify the current numbers against these sources before locking a
plan:
- CONFIRMED: <https://support.google.com/analytics/answer/9267744>
  (event/parameter limits)
- CONFIRMED: <https://developers.google.com/analytics/devguides/collection/ga4/reference/events>
  (reserved + recommended events)
Numbers below were current at the time this reference was written; treat
them as a starting point, not as gospel.

## Categories of event names

GA4 distinguishes three name buckets. Treat them as load-bearing — the
category determines whether built-in reports populate at all.

### Automatically collected (don't re-implement)

Web data streams collect these without code as long as
**Enhanced Measurement** is on. Re-firing them manually creates double
counts.

- `page_view`
- `session_start`
- `first_visit`
- `user_engagement`
- `scroll` (90% depth)
- `click` (outbound)
- `view_search_results`
- `file_download`
- `video_start` / `video_progress` / `video_complete`
- `form_start` / `form_submit`

App streams (Firebase SDK) collect a parallel set:
`first_open`, `app_remove`, `app_update`, `os_update`, etc.

**Rule:** if your event matches an automatically-collected one, either
turn that Enhanced Measurement toggle off, or don't fire your own — pick
one source of truth.

### Recommended events — fire these by name

GA4's reports key off these names. Reusing the recommended name unlocks
the built-in funnel, retention, and (where applicable) monetization
reports. Pick from this list before inventing.

| Domain | Event name |
| --- | --- |
| Account lifecycle | `sign_up`, `login`, `tutorial_begin`, `tutorial_complete` |
| Content | `select_content`, `view_item`, `view_item_list`, `select_item`, `search`, `view_search_results`, `share` |
| Engagement | `earn_virtual_currency`, `join_group`, `level_up`, `post_score`, `spend_virtual_currency`, `unlock_achievement` |
| Ecommerce | `view_promotion`, `select_promotion`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`, `refund` |
| Subscription / lead | `generate_lead`, `working_lead`, `close_convert_lead`, `disqualify_lead` |
| Ads | `ad_impression` |

Required parameters per recommended event are documented at the link
above and must be passed exactly — `purchase` without `transaction_id`,
`items[]`, and the value/currency pair needed for revenue reporting will
not appear correctly in Monetization reports. Each ecommerce item needs
one of `item_id` or `item_name`.

### Custom events

For anything not covered. Use `snake_case`, max 40 characters, no
leading digit. Don't prefix with `ga_`, `google_`, or `firebase_` —
those namespaces are reserved.

## Parameter caps (verify before locking)

| Limit | Value (approx) |
| --- | --- |
| Event name length | 40 chars |
| Parameter name length | 40 chars |
| Parameter value length | 100 chars (Standard); 500 chars (360) |
| Page parameter value length | `page_location` 1,000 chars; `page_referrer` 420; `page_title` 300 |
| Parameters per event | 25 (excluding automatically logged ones) |
| Items per event (ecommerce) | 200 |
| Custom item-scoped parameters per ecommerce event | 27 |
| Custom dimensions per property | 50 event-scoped + 25 user-scoped (Standard); higher on 360 |
| Custom metrics per property | 50 event-scoped (Standard) |
| Distinct cardinality per dimension per day | ~500 high-card values before "(other)" bucketing |

**Cardinality is the trap.** Registering `user_id`, `order_id`, or any
free-form identifier as a custom dimension collapses your reports into
"(other)" once you exceed ~500 unique values in a day. Use the User-ID
field for `user_id`. Pass `order_id` as an event parameter only, never
register it as a custom dimension.

## Naming rules

- Event names and parameter keys: `snake_case`, ASCII, no spaces.
- Reserved prefixes (do NOT use): `ga_`, `google_`, `firebase_`, `_`.
- Do not use Universal Analytics-style `event_category`,
  `event_action`, or `event_label`. Use a meaningful `event_name` plus
  specific GA4 event parameters, and register reportable parameters as
  custom dimensions/metrics.
- Reserved event names (do NOT re-emit): the automatic-collection list
  above, plus `ad_click`, `ad_query`, `ad_exposure`, `app_clear_data`,
  `app_install`, `app_remove`, `app_update`, `error`, `in_app_purchase`,
  `notification_*`, `os_update`, `screen_view`, `session_start`,
  `user_engagement`, and a handful more — full list at
  <https://support.google.com/analytics/answer/13316687>.
- For non-English UIs: event names and parameter keys stay English /
  ASCII. Localize values (labels, content names) in a separate
  display-name dimension, not in the event name.

## Validation checklist for the plan reviewer

- [ ] Every event in the catalog uses a recommended name where one
      exists, or a custom name that doesn't collide with reserved.
- [ ] Every `purchase` carries `transaction_id`, `items[]`, `currency`
      (ISO-4217), and `value` (Σ of items), and every item has
      `item_id` or `item_name`.
- [ ] No parameter key uses a reserved prefix.
- [ ] No event uses `event_category`, `event_action`, or `event_label`.
- [ ] No parameter value exceeds the documented Standard/360 and
      page-parameter limits.
- [ ] No event exceeds 25 user parameters.
- [ ] No boolean `*_exists` / `has_*` parameter is used only to signal
      whether another parameter is present.
- [ ] No custom dimension is registered for a high-cardinality id.
- [ ] No custom dimension duplicates a GA4 predefined dimension/metric.
- [ ] Enhanced Measurement events are not re-fired manually.
- [ ] Custom-dimension count stays under the property's cap (50 / 25).
