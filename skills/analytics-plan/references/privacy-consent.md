# Privacy, consent, and the legal floor

Authoritative refs:
- <https://developers.google.com/tag-platform/security/guides/consent>
  (Consent Mode v2)
- <https://support.google.com/analytics/answer/9019185> (data-deletion
  request)
- <https://support.google.com/analytics/answer/12017362> (User-Deletion
  API)
- EU GDPR Art. 5 (data minimization), Art. 25 (privacy by design), Art.
  17 (right to erasure).
- US: COPPA (under 13), CCPA / CPRA (California opt-out / sensitive PI).

This file is a floor, not a substitute for counsel. If the audience
includes minors, health data, financial data, or EU residents at scale,
escalate.

## The non-negotiable rules

1. **No raw PII ever leaves the process boundary.** Forbidden inputs to
   any analytics call: raw email, name, IP address (Google strips IP
   on receipt but you should never send it as a param), free-text
   user input, OAuth tokens, API keys, session cookies, URL query
   strings that may contain tokens.
2. **Hash + pepper any identifier you send.** Plain SHA-256 of an email
   is reversible with a small user list (rainbow tables, leaked
   breaches). Pepper with a server-only secret rotated quarterly. Treat
   the hashed id as pseudonymous personal data (still PII under GDPR).
3. **Deny by default in EU.** Consent Mode v2 defaults must be `denied`
   for `ad_storage`, `analytics_storage`, `ad_user_data`,
   `ad_personalization` on first paint for EU traffic. Granting happens
   only after explicit opt-in.
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
| `analytics_storage` | Whether `_ga` cookies set + GA4 ingest |
| `ad_user_data` | Whether user data may be sent to Google for ads (v2 new) |
| `ad_personalization` | Whether ads may be personalized (v2 new) |

For server-side Measurement Protocol calls, mirror the same `consent`
object in the payload. GA4 will model conversions for traffic with
`denied` if the property is enrolled.

The default snippet (place inline in `<head>` BEFORE any tag loader):

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
ip
ip_address
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
```

If a value matches any regex, drop the param entirely (do not redact in
place — partial values still leak format).

## URLs as parameters: extra care

`page_location` is a recommended GA4 param and is allow-listed for 500
chars, but URLs routinely carry tokens (reset links, magic-login links,
shared invites). Before sending:

1. Strip the query string entirely OR allowlist known-safe params
   (`utm_*`, `ref`, `page`, etc.).
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
- Escalate. This requires counsel, not a templated plan.

## Data residency reality

- GA4 lets you choose ingestion region (US, EU). Choose EU for EU
  audiences.
- After ingestion, Google operates globally — the data may be
  processed/cached/served from infrastructure outside your chosen
  region. Don't claim "EU-only" in your privacy policy; claim "EU
  ingestion".
- BigQuery export region is separate — set it explicitly per dataset.

## Right to erasure pipeline

When a user deletes their account, you must remove their data from:

1. **GA4** — User-Deletion API call with the hashed `user_id` + all
   known `client_id` values you've stored.
2. **BigQuery export** — DELETE on the linked dataset within 60 days.
3. **Any sGTM logs** — purge per your log retention policy.
4. **Any downstream warehouse / CDP** — propagate the deletion event.

Document the runtime of this pipeline. "Within 30 days of request" is
the GDPR ceiling; aim for 7.

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
- [ ] Consent default test: with consent denied, asserting zero
      outbound network calls to `*.google-analytics.com` or
      `*.analytics.google.com`.
- [ ] Account-deletion smoke test: deletion triggers User-Deletion API
      call within the documented SLA.
