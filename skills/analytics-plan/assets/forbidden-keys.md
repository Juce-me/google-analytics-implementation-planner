# Forbidden-keys starter

Drop this into the project's analytics layer (e.g.,
`src/analytics/scrub.ts` or equivalent). The scrubber rejects events
containing any of these as parameter keys OR matching any of the
value-shape regexes, BEFORE the event leaves the process.

This is a **starter**, not a finished policy. Extend per project. Do
not remove entries without a written rationale.

## Exact parameter-name blocklist

```
email
e_mail
emailAddress
email_address
user_email
mail
phone
phoneNumber
phone_number
sms
name
firstName
first_name
lastName
last_name
fullName
full_name
displayName
password
pwd
passcode
pin
token
access_token
refresh_token
id_token
api_key
apiKey
secret
session
sessionId
session_id           # exception: GA4 event param needs this; allowlist explicitly in wrapper
cookie
authorization
auth
ip
ip_address
client_ip
ssn
dob
date_of_birth
credit_card
cc_number
cardNumber
card_number
cvv
cvc
iban
swift
postal_code          # in EU, granular postcodes are personal data
zip
zipcode
address
street
geo_precise
lat_lng
```

> The `session_id` parameter is required by GA4 server-side. Allowlist
> it in the wrapper with a strict shape check (numeric UNIX timestamp
> string), and reject any other field named `session_id`.

## Suffix / prefix wildcards

```
*_email
*_phone
*_token
*_secret
*_password
*_passwd
auth_*
oauth_*
*_apikey
*_jwt
```

## Value-shape regexes

Applied to every parameter value, every event. If any value matches
any regex, **drop the event entirely** — do not redact in place,
because partial values still leak shape.

```
EMAIL       /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
PHONE_E164  /\+[1-9]\d{6,14}\b/
JWT         /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/
BEARER      /\bBearer\s+[A-Za-z0-9._\-+/=]+/i
SSN_US      /\b\d{3}-\d{2}-\d{4}\b/
CC          /\b(?:\d[ -]*?){13,19}\b/
CVV         /\bcvv?\s*[:=]?\s*\d{3,4}\b/i
URL_TOKEN   /\?.*?(token|key|secret|password|email|sig|signature)=/i
IPv4        /\b(?:\d{1,3}\.){3}\d{1,3}\b/
GUID        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
```

> The GUID regex will hit some legitimate parameters (object ids that
> happen to be UUIDs). In that case, add an allowlist of param keys
> where GUID values are expected (`order_id`, `transaction_id`,
> `item_id`) and skip the GUID check on those keys.

## Behavior on match

| Match | Action |
| --- | --- |
| Key matches blocklist (exact or wildcard) | Drop the key from the params; if the event has no remaining params besides `engagement_time_msec`, drop the event. Log a counter `analytics.scrubbed.key.<name>`. |
| Value matches a forbidden regex | Drop the entire event. Log `analytics.scrubbed.value.<regex_name>`. Do not retry. |
| Value matches but key is on the per-key allowlist (e.g., GUID on `order_id`) | Pass. |

## CI assertion

```
test('scrub: no forbidden key reaches the wire', () => {
  for (const event of catalog) {
    const payload = buildPayload(event, fixtureUser);
    for (const key of Object.keys(payload.params || {})) {
      expect(blocklist).not.toContain(key);
      for (const wildcard of wildcards) expect(key).not.toMatch(wildcard);
    }
    for (const value of Object.values(payload.params || {})) {
      for (const re of valueRegexes) expect(String(value)).not.toMatch(re);
    }
  }
});
```

## Pepper handling

The `PEPPER` used for hashing `user_id` is itself a forbidden value.
Make sure:

- It's not logged.
- It's not exposed to the client (server-side only).
- It's pulled from a secret manager, not committed.
- Rotation is documented in the design plan §4.
