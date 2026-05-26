# GTM and tagging — when, which, why

Authoritative docs (last checked: 2026-05-26):
- CONFIRMED: <https://developers.google.com/tag-platform/tag-manager>
- CONFIRMED: <https://developers.google.com/tag-platform/tag-manager/datalayer>
- CONFIRMED: <https://developers.google.com/tag-platform/tag-manager/server-side>
- CONFIRMED: <https://developers.google.com/tag-platform/gtagjs>
- CONFIRMED: <https://developers.google.com/tag-platform/security/concepts/consent-mode>
- CONFIRMED: <https://developers.google.com/analytics/devguides/collection/ga4/events>
- CONFIRMED: <https://developers.google.com/analytics/devguides/collection/ga4/ecommerce>

## Decision matrix

| | gtag.js direct | GTM web container | Server-side GTM (sGTM) |
| --- | --- | --- | --- |
| Time to ship | hours | day | week+ |
| Non-engineer can edit tags | no | yes | yes (with care) |
| Ad-blocker resistant | no | no | yes |
| Cost (Google Cloud / hosting) | $0 | $0 | $$ (Cloud Run / App Engine) |
| Consent Mode support | yes | yes | yes |
| Maintenance burden | low | medium | high |
| Right for | simple sites, side projects, MVP | marketing-heavy site, multiple ad networks | enterprise, paid acquisition spend > GTM cost, strict privacy posture |

**Default to the leftmost option that meets the need.** Moving right is
a real cost, both in build and in ops.

## When gtag.js direct is enough

- Single GA4 property, no other ad pixels.
- Engineering owns instrumentation — marketing isn't editing tags.
- Audience is fine with ad blockers reducing data 5–20%.
- No regulatory requirement to keep beacons off third-party domains.

Implementation: a single `<script>` tag in the layout, one `gtag('event',
…)` call per tracked surface. Consent Mode v2 wraps the calls.

## When to add GTM web container

- Marketing needs to fire pixels (Meta, LinkedIn, TikTok, Reddit) and
  you don't want a script tag per network.
- A/B test platform that wants its own pixel.
- You need to fire conversion events from places engineering doesn't
  own (the CMS, the landing-page builder).

## Simple GA4 dataLayer contract for GTM web

First ask whether GTM web will be used. If not, do not invent container
setup. If yes, default to a low-configuration dataLayer contract:

```js
window.dataLayer = window.dataLayer || [];

window.dataLayer.push({
  event: 'ga4_page_view',
  page_location: location.href,
  page_title: document.title,
  page_referrer: document.referrer || null,
  logical_page: 'pricing',
  feature_area: 'marketing'
});

window.dataLayer.push({
  event: 'ga4_user_event',
  ga4_event_name: 'sign_up',
  event_group: 'auth',
  logical_page: 'signup',
  method: 'password',
  plan_tier: 'team'
});
```

Container setup for normal analytics:

| GTM trigger | GTM tag | GA4 event name | Params |
| --- | --- | --- | --- |
| Custom Event `ga4_page_view` | GA4 Event `GA4 - Page View` | `page_view` | Page-view data layer variables |
| Custom Event `ga4_user_event` | GA4 Event `GA4 - User Event` | `{{DLV - ga4_event_name}}` | Shared + event-specific data layer variables |

Adding a normal event should update code, tests, and the taxonomy only.
It should not require another GTM trigger or tag. GTM changes only when a
new shared/event-specific data layer variable must be parsed, when a
parameter is retired, or when ecommerce is introduced.

If the page-view tag emits `page_view`, disable duplicate automatic
page-view sends from the Google tag / Enhanced Measurement source of
truth, especially for SPAs where route changes are manual.

Ecommerce is separate. Use GA4 recommended ecommerce event names
(`view_item`, `add_to_cart`, `purchase`, `refund`, etc.) and a dedicated
Custom Event trigger/tag such as `ga4_ecommerce`; map `currency`, `value`,
`transaction_id`, coupon/tax/shipping where applicable, and `items[]`.
Every item needs `item_id` or `item_name`. Do not send ecommerce through
the generic user-event tag unless the plan documents why the GTM container
can still preserve GA4 ecommerce semantics.

Use Data Layer Variables and GTM's native Google tag / GA4 Event tags.
Do not paste gtag.js sends into Custom HTML tags.

Container hygiene if you add it:

- One container per environment (dev/staging/prod). Never one container
  switching by hostname — variables drift.
- Lock the prod container — only the analytics lead has publish rights,
  changes go through review.
- Google tags have built-in consent checks. Add extra required consent or
  blocking triggers only when deliberately implementing **basic consent
  mode**; otherwise you suppress advanced-mode cookieless pings/modeling.
- Use Built-In Variables (Page Path, Click ID) over scraping the DOM.
- Workspaces for changes; never edit in the default workspace.

## When to add server-side GTM (sGTM)

Only when ad blockers / cookie deprecation are eating enough data that
the deficit costs more than the sGTM infrastructure. Concretely:

- Paid acquisition spend > $10k/month and reported ROAS is clearly low
  vs. backend truth.
- Advanced Consent Mode modeling is approved but still not enough
  because observable paid-conversion gaps remain.
- Strict privacy posture (medical, finance, EEA/UK/Swiss regulated) where
  third-party beacons are a legal liability.

What sGTM buys you:

- Browser sends to your domain (`analytics.example.com`), your container
  forwards to GA4 / Meta / etc.
- You control the data leaving your domain — drop, enrich, hash.
- Ad-blocker bypass for first-party traffic.

Be precise about the path: routing browser Google tags through an sGTM
endpoint is different from sending backend MP-format requests to an sGTM
Measurement Protocol client. The latter does not use the GA4 MP endpoint
and needs its own client/tag/debug contract.

What sGTM costs:

- A Google Cloud Run / App Engine deployment to maintain.
- Custom domain + cert.
- A staging container + prod container, both versioned.
- Engineers who can debug a Node-based tag server.

If the user is asking for "GTM" and the project is a side project / MVP
/ pre-paid-acquisition, push back: sGTM is the wrong answer.

## Tag sequencing on the page

Consent Mode v2 defaults must load BEFORE any measurement tag, or GA4 can
log early events under the wrong consent state. Order:

1. Consent default snippet (synchronous, top of `<head>`).
2. gtag.js / GTM container (async).
3. CMP (cookie banner) — when user interacts, calls `gtag('consent',
   'update', …)`.
4. Application code firing events.

A common bug: CMP loaded by GTM. Then on first paint, no consent
  defaults exist, events log under `granted` by accident, consent
  compliance breaks. Always put defaults in HTML directly.

## Multi-domain / subdomain stitching

- Same eTLD+1 (`app.example.com` ↔ `www.example.com`): set the
  `_ga` cookie domain to `.example.com` and stitching works.
- Cross-domain (`example.com` ↔ `checkout.partner.com`): add the
  partner domain to Data Stream → Configure Tag Settings → Domains.
  gtag.js will append `_gl` to the URL on outbound clicks; the partner
  reads it and continues the session.
- Sites behind a reverse proxy with a different brand at the top —
  treat as cross-domain even if it feels the same to the user.

## Anti-patterns

- One GTM container shared across dev / staging / prod — variables drift
  silently, prod gets dev tag bugs.
- "GTM is free, so let's add it" without a marketing or pixel need —
  added complexity, zero benefit, ad-blocker exposure unchanged.
- sGTM without a documented cost / benefit comparison.
- Loading the CMP from inside GTM — defaults race the first event.
- Custom HTML tags pasting in third-party SDK code without a content-
  security-policy review.
