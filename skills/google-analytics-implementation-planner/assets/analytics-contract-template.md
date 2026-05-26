# Analytics Contract

This is the durable source of truth for production analytics after launch.
Temporary design plans live under `docs/agents/features/`; this file is what
future feature work updates.

## Scope

- Analytics vendor: Google Analytics 4 / Google Tag Manager / Measurement
  Protocol.
- Active architecture: <gtag.js direct | GTM web | Measurement Protocol |
  sGTM | hybrid, with endpoint/path>.
- Privacy floor: no raw email, name, phone, free text, token, full URL
  query, raw user agent, or full IP leaves the app.

## Future-feature rule

Every user-visible feature PR must answer:

- What decision will this feature's analytics support?
- Which event name, category, action, and typed params are added or changed?
- Which test asserts the event and required params?
- Which row in the taxonomy changed?
- Did any GA4 admin, GTM, Measurement Protocol, consent, or runbook step
  change?

If no analytics event is needed, add an allowlist row with the reason.

## Event taxonomy

| Event name | Category | Action | Required params | Trigger | File/line anchor | Server/browser side | Decision/use |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `sign_up` | auth | created | `method` | Successful account creation | `src/auth/signup.ts:42` | browser | Signup funnel conversion |

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

| Display name | Param | Scope | Decision/use |
| --- | --- | --- | --- |

### Metrics

| Display name | Param | Scope | Unit | Decision/use |
| --- | --- | --- | --- | --- |

## Privacy rules

- Scrub forbidden keys and value shapes at the source and processing layer.
- Consent denied sends zero third-party analytics events.
- Minor or age-unclassified users send zero analytics events.
- User identifiers are pseudonymous and hashed with a server-only pepper.
- IP/geo behavior: <local enrichment | precise truncation rule | disabled>.

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
