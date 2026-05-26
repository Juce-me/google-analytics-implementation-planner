# Privacy, consent, and the legal floor

Authoritative refs (last checked: 2026-05-26):
- CONFIRMED: <https://developers.google.com/tag-platform/security/concepts/consent-mode>
- CONFIRMED: <https://developers.google.com/tag-platform/security/guides/consent>
  (Consent Mode v2)
- CONFIRMED: <https://support.google.com/analytics/answer/9019185> (data-deletion
  request)
- CONFIRMED: <https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1alpha/properties/submitUserDeletion>
  (GA4 Admin API user deletion)
- CONFIRMED: <https://support.google.com/analytics/answer/11598602> (EU-focused
  data and privacy)
- CONFIRMED: <https://support.google.com/analytics/answer/13297105> (HIPAA and
  Google Analytics)
- EU GDPR Art. 5 (data minimization), Art. 25 (privacy by design), Art.
  17 (right to erasure).
- US: COPPA (under 13), CCPA / CPRA (California opt-out / sensitive PI).

This file is a floor, not a substitute for counsel. If the audience
includes minors, health data, financial data, or EEA/UK/Swiss residents at
scale, escalate. Google Analytics does not offer a HIPAA Business
Associate Agreement; HIPAA-regulated entities must not expose PHI to GA.

## The non-negotiable rules

1. **No raw personal data in explicit analytics payloads.** Forbidden
   inputs to any event param, user property, MP body, or sGTM-enriched
   payload: raw email, name, IP address, raw user-agent, raw referrer,
   free-text user input, OAuth tokens, API keys, session cookies, URL
   query strings that may contain tokens. Web/app SDK pings can still
   include passive headers and connection metadata; cite vendor behavior
   instead of claiming no metadata leaves the app.
2. **Hash + pepper any identifier you send.** Plain SHA-256 of an email
   is reversible with a small user list (rainbow tables, leaked
   breaches). Pepper with a server-only secret rotated quarterly. Treat
   the hashed id as pseudonymous personal data under GDPR / personal
   information under some US state laws.
3. **Deny by default for EEA, UK, and Switzerland.** Consent Mode v2 defaults must be `denied`
   for `ad_storage`, `analytics_storage`, `ad_user_data`,
   `ad_personalization` on first paint for traffic covered by Google's EU
   User Consent Policy. Granting happens only after explicit opt-in.
4. **Equal-prominence reject.** A "Reject all" button must be as easy
   to find and click as "Accept all". EU regulators (CNIL, Garante)
   have already fined organizations for hiding it.
5. **Scrub at the source AND at the processor.** Defense in depth — the
   call-site SDK wrapper drops forbidden keys, and a downstream
   processor (sGTM, Cloud Function before BigQuery export) drops them
   again. One layer fails open eventually.

## Consent Mode v2 — the gates

| Signal | Controls |
| --- | --- |
| `ad_storage` | Whether ad cookies set |
| `analytics_storage` | Whether analytics storage/cookies and device identifiers may be used |
| `ad_user_data` | Whether user data may be sent to Google for ads (v2 new) |
| `ad_personalization` | Whether ads may be personalized (v2 new) |

For server-side Measurement Protocol calls, mirror the same `consent`
decision in the payload where MP supports it. MP supports only
`ad_user_data` and `ad_personalization`; `analytics_storage` and
`ad_storage` are web tag Consent Mode signals, not MP payload fields.

Pick and document one Consent Mode posture:

- **Basic consent mode:** block Google tags until consent. If consent is
  denied, no data is sent to Google. This matches the strict
  "zero third-party analytics sends" posture below.
- **Advanced consent mode:** Google tags load with denied defaults and
  send cookieless measurements while denied. This can improve modeling,
  but it is not "zero sends" and needs explicit legal/product approval.

The web default snippet (place inline in `<head>` BEFORE any tag loader):

```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });
</script>
```

After CMP interaction:

```js
gtag('consent', 'update', {
  analytics_storage: granted ? 'granted' : 'denied',
  // ...
});
```

For iOS/Android apps, use Firebase SDK controls instead of the web snippet:
disable collection before consent where required, call SDK `setConsent`
for `adStorage`, `analyticsStorage`, `adUserData`, and
`adPersonalization`, and document `setAnalyticsCollectionEnabled`
persistence/override behavior.

## Forbidden-keys starter list

Copy into `assets/forbidden-keys.md` and extend per project. The
scrubber rejects events containing any of these as parameter keys (or
matching the regex) BEFORE they leave the process.

### Exact names

```
email
e_mail
emailAddress
email_address
user_email
phone
phoneNumber
phone_number
name
first_name
last_name
full_name
password
pwd
token
access_token
refresh_token
id_token
api_key
apiKey
secret
session
sessionId
cookie
authorization
user_agent
raw_user_agent
ip
ip_address
referer
referrer
page_url
ssn
dob
date_of_birth
credit_card
cc_number
card_number
cvv
postal_code   # in EU, granular postcodes are personal data
```

### Suffix / prefix wildcards

```
*_email
*_token
*_secret
*_password
auth_*
oauth_*
```

### Value-shape regexes (apply to every parameter value)

```
EMAIL       /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
TOKEN_JWT   /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/
BEARER      /\bBearer\s+[A-Za-z0-9._\-+/=]+/i
SSN_US      /\b\d{3}-\d{2}-\d{4}\b/
CC          /\b(?:\d[ -]*?){13,19}\b/
URL_QUERY   /\?.*?(token|key|secret|password|email)=/i
FULL_URL_QUERY /\bhttps?:\/\/[^\s?]+?\?[^\s]+/i
```

If a value matches any regex, drop the param entirely (do not redact in
place — partial values still leak format).

## URLs as parameters: extra care

`page_location` is a recommended GA4 param and has a larger documented
limit than ordinary parameters, but URLs routinely carry tokens (reset
links, magic-login links,
shared invites). Before sending:

1. Strip the query string entirely OR allowlist only project-proven safe
   params. `utm_*` is usually safe; generic `ref` is not, because it often
   carries invite/referral tokens.
2. Replace path segments that look like ids with placeholders:
   `/users/12345/orders/T-9876` → `/users/:user_id/orders/:order_id`.
3. Never send a `Referer` containing the previous page's token.

## Minors (under 13 US COPPA / under 16 some EU states)

- **Hard server-side disable.** Not just a client toggle — checked once
  on every backend send.
- No advertising features. Disable Google Signals on the property.
- No demographics inference. Disable.
- Privacy policy: explicit child-data section.
- Parental consent flow before ANY analytics fires.
- Existing users without age classification remain
  analytics-disabled/unclassified until the gate is answered.
- Escalate. This requires counsel, not a templated plan.

## Regional collection and residency reality

- GA4 regional collection is not a generic UI switch that promises
  "EU-only" processing. Google documents EU-focused regional collection
  behavior and product controls such as Google Signals and granular
  location/device-data settings.
- Measurement Protocol offers a regional endpoint
  `https://region1.google-analytics.com/mp/collect` for EU collection
  requirements.
- After collection, Google operates global infrastructure. Don't claim
  "EU-only" in your privacy policy; describe the documented Google
  controls and your chosen endpoint/configuration.
- BigQuery export region is separate — set it explicitly per dataset.

## Right to erasure pipeline

When a user deletes their account, you must remove their data from:

1. **GA4** — Admin API `properties.submitUserDeletion` call for each
   known identifier. The request accepts one identifier per call:
   `userId`, `clientId`, `appInstanceId`, or `userProvidedData`.
2. **BigQuery export** — DELETE on the linked dataset under your project
   SLA; GA user-deletion requests do not clean up your exported copy.
3. **Any sGTM logs** — purge per your log retention policy.
4. **Any downstream warehouse / CDP** — propagate the deletion event.

Document the runtime of this pipeline as a project SLA. Separately, GA4
data-deletion requests for event/user-property cleanup have a grace period
and processing window; do not present those timings as your GDPR deadline.

## DPIA trigger checklist

A Data Protection Impact Assessment is required (GDPR Art. 35) when
any of these is true. If you check one, escalate before sending
anything.

- [ ] Systematic monitoring of public spaces or large-scale tracking.
- [ ] Processing special-category data (health, biometric, political).
- [ ] Data subjects include children.
- [ ] Combining datasets that, separately, the user didn't expect to
      be combined.
- [ ] Automated decisions with legal or similarly significant effect.

## CI checks (non-negotiable)

- [ ] Lint rule: every analytics call site uses the typed wrapper, not
      raw `gtag` / `fetch('/mp/collect')`.
- [ ] Test that fires every event in the catalog with a fixture user
      and asserts the captured payload contains zero forbidden keys
      and zero values matching forbidden regexes.
- [ ] Consent default test: in basic consent mode with consent denied,
      asserting zero outbound network calls to `*.google-analytics.com`
      or `*.analytics.google.com`. In advanced consent mode, assert only
      approved cookieless pings are sent.
- [ ] Account-deletion smoke test: deletion triggers GA4 Admin API
      `properties.submitUserDeletion` for each known identifier within the
      documented SLA.
