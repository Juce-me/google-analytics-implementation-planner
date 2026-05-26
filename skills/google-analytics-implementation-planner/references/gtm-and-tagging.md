# GTM and tagging — when, which, why

Authoritative docs:
- <https://developers.google.com/tag-platform/tag-manager>
- <https://developers.google.com/tag-platform/tag-manager/server-side>
- <https://developers.google.com/tag-platform/gtagjs>

## Decision matrix

| | gtag.js direct | GTM web container | Server-side GTM (sGTM) |
| --- | --- | --- | --- |
| Time to ship | hours | day | week+ |
| Non-engineer can edit tags | no | yes | yes (with care) |
| Ad-blocker resistant | no | no | yes |
| Cost (Google Cloud / hosting) | $0 | $0 | $$ (Cloud Run / App Engine) |
| Modeled conversions (Consent Mode v2) | yes | yes | yes |
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

Container hygiene if you add it:

- One container per environment (dev/staging/prod). Never one container
  switching by hostname — variables drift.
- Lock the prod container — only the analytics lead has publish rights,
  changes go through review.
- Every tag has a firing trigger AND a blocking trigger for the consent
  state it needs (`analytics_storage=denied` blocks measurement tags).
- Use Built-In Variables (Page Path, Click ID) over scraping the DOM.
- Workspaces for changes; never edit in the default workspace.

## When to add server-side GTM (sGTM)

Only when ad blockers / cookie deprecation are eating enough data that
the deficit costs more than the sGTM infrastructure. Concretely:

- Paid acquisition spend > $10k/month and reported ROAS is clearly low
  vs. backend truth.
- Modeled conversions (the Consent Mode v2 fallback) aren't enough
  because consent rate is low.
- Strict privacy posture (medical, finance, EU regulated) where third-
  party beacons are a legal liability.

What sGTM buys you:

- Browser sends to your domain (`analytics.example.com`), your container
  forwards to GA4 / Meta / etc.
- You control the data leaving your domain — drop, enrich, hash.
- Ad-blocker bypass for first-party traffic.

What sGTM costs:

- A Google Cloud Run / App Engine deployment to maintain.
- Custom domain + cert.
- A staging container + prod container, both versioned.
- Engineers who can debug a Node-based tag server.

If the user is asking for "GTM" and the project is a side project / MVP
/ pre-paid-acquisition, push back: sGTM is the wrong answer.

## Tag sequencing on the page

Consent Mode v2 must load BEFORE any measurement tag, or GA4 logs the
event under the default state (which is `denied` in EU) and you lose
modeled conversions for it. Order:

1. Consent default snippet (synchronous, top of `<head>`).
2. gtag.js / GTM container (async).
3. CMP (cookie banner) — when user interacts, calls `gtag('consent',
   'update', …)`.
4. Application code firing events.

A common bug: CMP loaded by GTM. Then on first paint, no consent
defaults exist, events log under `granted` by accident, EU compliance
breaks. Always put defaults in HTML directly.

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
