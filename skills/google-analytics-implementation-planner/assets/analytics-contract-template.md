# Analytics Contract

This is the durable source of truth for production analytics after launch.
Temporary design plans live under `docs/agents/features/`; this file is what
future feature work updates.

## Scope

- Analytics vendor: Google Analytics 4 / Google Tag Manager / Measurement
  Protocol.
- Active architecture: <gtag.js direct | Firebase Analytics SDK direct |
  GTM web | Measurement Protocol | sGTM | hybrid, with endpoint/path>.
- Privacy floor: no raw email, name, phone, free text, token, full URL
  query, or explicit IP/user-agent/referrer params or payload fields leave
  the app. Passive SDK/browser metadata is documented separately.
- GA4 events use `event_name` plus specific event parameters. Do not use
  Universal Analytics-style `event_category`, `event_action`, or
  `event_label`.
- Missing values are represented as null/omitted, not boolean presence
  dimensions. Prefer `geo: null` over `geo_exists: false`.

## Future-feature rule

Every user-visible feature PR must answer:

- What decision will this feature's analytics support?
- Which event name, event group, and typed params are added or changed?
- Which GA4/GTM built-in, predefined dimension/metric, recommended
  parameter, or existing dataLayer field was reused before adding a new
  property?
- If a custom definition is added, which GA4 predefined dimension/metric
  or recommended parameter was checked first?
- Which test asserts the event and required params?
- Which row in the taxonomy changed?
- Did any GA4 admin, GTM, Measurement Protocol, consent, or runbook step
  change?

If no analytics event is needed, add an allowlist row with the reason.
Never add bulk custom definitions or boolean presence dimensions such as
`*_exists` / `has_*`.

## GTM web contract

If the active architecture uses GTM web, normal analytics events must use
the existing `ga4_page_view` and `ga4_user_event` Custom Event
triggers/tags. A normal feature PR may add or change app-owned dataLayer
params, taxonomy rows, and tests, but must not create a new GTM
trigger/tag per event or duplicate GTM/GA4 built-ins for page, device,
geo, campaign, traffic-source, or click fields. Ecommerce uses the
separate ecommerce trigger/tag and GA4 ecommerce fields (`currency`,
`value`, `transaction_id`, `items[]`).

## Event taxonomy

| Event name | Event group | Required params | Optional/group params | Trigger | File/line anchor | Server/browser side | Decision/use |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `sign_up` | auth | `method` | `plan_tier` | Successful account creation | `src/auth/signup.ts:42` | browser | Signup funnel conversion |

## Required params

| Event name | Param | Type | Allowed values / shape | Required test |
| --- | --- | --- | --- | --- |
| `sign_up` | `method` | string | `password`, `oauth_google`, `sso` | `tests/analytics/signup.test.ts` |

## Allowlist

State-changing routes without analytics must be documented here.

| Surface | File/line anchor | Reason no event is emitted | Review date |
| --- | --- | --- | --- |

## Custom definitions

### Dimensions

| Display name | Parameter/User property | Scope | Event group(s) | GA4 predefined alternative checked | Description | Decision/use |
| --- | --- | --- | --- | --- | --- | --- |

### Metrics

| Display name | Parameter | Scope | Event group(s) | GA4 predefined alternative checked | Description | Unit | Decision/use |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Privacy rules

- Scrub forbidden keys and value shapes at the source and processing layer.
- Basic consent mode denied sends zero third-party analytics events.
- Advanced consent mode denied sends only explicitly approved cookieless
  pings.
- Minor or age-unclassified users send zero analytics events.
- User identifiers are pseudonymous and hashed with a server-only pepper.
- IP/geo behavior: <local enrichment | precise truncation rule | disabled>.
- App consent behavior: <Firebase `setConsent` mapping and collection
  enablement default, if app streams exist>.

## Drift checks

CI must fail when:

- A state-changing route is neither tracked nor allowlisted.
- Code event names differ from the taxonomy.
- Required params lack tests.
- Captured payloads contain forbidden keys or forbidden value shapes.

## Operations links

- Setup runbook: <path to GA4 setup runbook>
- GA4 property / stream: <admin link or internal reference>
- GTM container: <admin link or internal reference>
- Privacy policy section: <link>
- Deletion workflow: <link>
