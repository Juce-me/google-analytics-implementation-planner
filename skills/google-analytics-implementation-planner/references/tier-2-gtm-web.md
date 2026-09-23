# Tier 2 (advanced) — GTM web container

A Google Tag Manager web container owns the tags; your code owns a `dataLayer`
contract. Tier 2 contains all of [tier 1](tier-1-ga4-direct.md)'s GA4 property,
data stream, and custom-definition work — only the send path changes.

Authoritative docs. The URL and its topic were verified on the date shown;
re-verify claim details before locking a plan.

- CONFIRMED 2026-07-28: <https://developers.google.com/analytics/devguides/collection/ga4/measure-spa-gtm>
- CONFIRMED 2026-07-28: <https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications>
- CONFIRMED 2026-06-21: <https://developers.google.com/tag-platform/tag-manager>
- CONFIRMED 2026-06-21: <https://developers.google.com/tag-platform/tag-manager/datalayer>
- CONFIRMED 2026-06-21: <https://support.google.com/tagmanager/answer/9442095>
- CONFIRMED 2026-06-21: <https://support.google.com/tagmanager/answer/7182738>
- CONFIRMED 2026-06-21: <https://support.google.com/tagmanager/answer/7683056>
- CONFIRMED 2026-06-21: <https://support.google.com/analytics/answer/9539598>
- CONFIRMED 2026-06-21: <https://developers.google.com/analytics/devguides/collection/ga4/ecommerce>
- CONFIRMED 2026-06-21: <https://developers.google.com/tag-platform/security/concepts/consent-mode>

## Choose tier 2 when

- Marketing needs to fire pixels (Meta, LinkedIn, TikTok, Reddit) without a
  script tag per network and without a deploy per change.
- An A/B platform wants its own pixel.
- Conversion events must fire from surfaces engineering doesn't own — the CMS,
  the landing-page builder.

Not a reason: "GTM is free." Adding a container you don't need buys complexity,
a second debugging surface, and no ad-blocker resistance. If none of the three
bullets holds, stay on tier 1 and say so in the plan.

**Terminology:** the GTM web container is not a GA4 object. Its Google tag / GA4
Event tags send to the web data stream's Measurement ID / Google tag ID
(`G-...`). Never ask for a `web_stream_id` for classic GTM web setup; stream
resource ids matter only when Admin API automation mutates stream-level settings.

## The `userevent` dataLayer contract

One dataLayer event name for all normal analytics, with two filtered reusable
trigger/tag paths. Built-ins first: do not push custom page, click, device, geo,
campaign, or traffic-source properties when GA4 or GTM already provides them.
Reserve dataLayer keys for app-owned semantics GA4/GTM cannot infer.

```js
window.dataLayer = window.dataLayer || [];

window.dataLayer.push({
  event: 'userevent',
  trigger: 'userevent',
  event_type: 'pageview',
  feature_name: 'marketing',
  screen_name: 'pricing',
  userParams: {
    page_name: 'pricing',
  }
});

window.dataLayer.push({
  event: 'userevent',
  trigger: 'userevent',
  event_type: 'event',
  event_name: 'sign_up',
  feature_name: 'auth',
  screen_name: 'signup',
  userParams: {
    page_name: 'signup'
  },
  eventParams: {
    method: 'password',
    plan_tier: 'team'
  }
});
```

GTM fires on the top-level `event` key; `trigger` stays in the payload as
canonical audit metadata so tests and the contract doc match across tiers.

Container setup for normal analytics:

| GTM trigger | Condition | GTM tag | GA4 event name | Params |
| --- | --- | --- | --- | --- |
| Custom Event `userevent` | `event_type = pageview` | GA4 Event `GA4 - Page View` | `page_view` | GTM built-ins first; map `userParams.page_name` only if a logical page name is needed |
| Custom Event `userevent` | `event_type = event` | GA4 Event `GA4 - User Event` | `{{DLV - event_name}}` | Explicit DLV mappings from the event catalog |

Rules:

- Adding a normal event updates code, tests, and the taxonomy **only**. It does
  not create another trigger or a per-event tag. The container changes only when
  a genuinely new app-owned data layer variable is needed, a parameter is
  retired, or ecommerce is introduced.
- One `dataLayer.push` = one analytics occurrence. Never batch multiple GA4
  events into one push; GTM processes each pushed message and fires the tags
  matching that message.
- `eventParams.*` / `userParams.*` are documentation shorthand, never executable
  mappings. GTM needs one Data Layer Variable per nested field (Version 2) and
  one GA4 parameter row per sent parameter — `eventParams.method` → GA4
  parameter `method`.
- Use Data Layer Variables and GTM's native Google tag / GA4 Event tags. Do not
  paste `gtag.js` sends into Custom HTML tags.

**Planner-facing built-in allowlist** for MCP execution specs: `Page URL`,
`Page Path`, `Page Hostname`, `Referrer`, `Event`. Never `Page Title` — GA4
collects the page title automatically from `document.title`; use `page_name` for
logical page identity. In hand-configured containers you may additionally enable
click, scroll, form, and History built-ins as the plan requires.

## `page_view` in a SPA (React, Vue, any History-API router)

Exactly one source may be active. GA4's own guidance: **when tags are configured
through Tag Manager, do not enable automatic history-based page views in GA4** —
it double-counts. Concretely, clear Admin → Data Streams → Web → Enhanced
measurement → Page views → advanced settings → *Page changes based on browser
history events*, then pick one of:

**Option A — app-pushed pageview (this skill's default).** The router effect
pushes `userevent` with `event_type: 'pageview'` and a logical `page_name`;
the `GA4 - Page View` tag sends it. Engineering owns the page identity, which is
what makes reports readable (`pricing`, not `/p/12/v2`). Wiring per framework:
[framework-integration.md](framework-integration.md).

**Option B — container-only, no app code.** GTM's History Change trigger fires a
setup Google tag with `page_location: {{Page URL}}` and `update: true`, sequenced
before a `GA4 Event` tag named `page_view`. `update: true` merges config into the
existing tag and suppresses the immediate duplicate `page_view`. Use this when
engineering cannot ship a dataLayer push at all. Note two deliberate deviations
from the vendor tutorial: this skill does **not** add a `page_title`
parameter (GA4 collects it automatically) and does **not** add `page_referrer`
(omitting it lets GA4 populate the previous virtual page as the referrer for
pathing). Option B gives you URLs, not logical names.

Do not run A and B together.

## Ecommerce stays separate

Only when real revenue exists. Use GA4 recommended ecommerce event names
(`view_item`, `add_to_cart`, `purchase`, `refund`) as the dataLayer `event`, with
`trigger: 'ga4_ecommerce'` and an `ecommerce` object. Clear stale ecommerce data
first:

```js
window.dataLayer.push({ ecommerce: null });
window.dataLayer.push({
  event: 'purchase',
  trigger: 'ga4_ecommerce',
  ecommerce: { transaction_id, currency, value, items }
});
```

Configure the GA4 ecommerce tag with Event Name `{{Event}}` and the Data Layer
`ecommerce` object as the data source. Every item needs `item_id` or
`item_name`. Do not route ecommerce through the generic user-event tag unless the
plan documents how GA4 ecommerce semantics survive.

## Container hygiene

- One container per environment (dev/staging/prod). Never one container
  switching on hostname — variables drift.
- Lock the prod container: publish rights with the analytics lead, changes
  reviewed.
- Work in a workspace; never edit the default workspace directly.
- Google tags have built-in consent checks. Add extra required-consent settings
  or blocking triggers only when deliberately implementing **basic consent
  mode** — otherwise you suppress advanced-mode cookieless pings and modeling.
- Prefer Built-In Variables over scraping the DOM.
- Consent defaults still live in the page HTML, not in the container. A CMP
  loaded from inside GTM races the first event; see
  [tier-1-ga4-direct.md](tier-1-ga4-direct.md) for the load order and
  [privacy-consent.md](privacy-consent.md) for the legal floor.

## Multi-domain / subdomain stitching

- Same eTLD+1 (`app.example.com` ↔ `www.example.com`): set the `_ga` cookie
  domain to `.example.com`; stitching works.
- Cross-domain (`example.com` ↔ `checkout.partner.com`): add the partner domain
  in Data Stream → Configure Tag Settings → Domains. The tag appends `_gl` to
  outbound links and the partner continues the session.
- A reverse-proxied site with a different brand at the top is cross-domain even
  when it feels like one site to the user.

## Anti-patterns

- One container shared across dev/staging/prod.
- A trigger or tag per product event.
- Two Google tags on one page (tier-1 snippet left in the layout after the
  container ships) — everything double-counts.
- Automatic history-based page views left on alongside GTM pageviews.
- Loading the CMP from inside GTM.
- Custom HTML tags pasting third-party SDK code without a CSP review.
- `Page Title` as a built-in variable, or full URLs with query strings as event
  parameters.

## Verification for this tier

- [ ] GTM Preview + DebugView: one `page_view` per virtual navigation, five
      routes → five events.
- [ ] Enhanced measurement history-based page views confirmed **off**.
- [ ] No tier-1 `gtag.js` snippet remains in the layout.
- [ ] Every catalog event arrives through the two reusable paths; container has
      no per-event tag.
- [ ] Each DLV in the container maps to a field the event catalog approved.
- [ ] Consent denied → zero Google beacons (basic consent mode).

## Upgrade path → tier 3 (server-side)

What carries over unchanged: the dataLayer contract, the event catalog, custom
definitions, the two reusable tag paths, and consent posture. Client code does
not change.

What changes shape: the container's transport destination becomes your
first-party tagging-server URL, and/or backend events start arriving through
Measurement Protocol. Tier 3 **adds** a path; it never replaces tier 2's
automatic collection.

What must be migrated deliberately: identity plumbing. Server sends need
`client_id` (web) or `app_instance_id` (app) plus `session_id` forwarded from the
browser — see [tier-3-server-side.md](tier-3-server-side.md) and
[identity-sessions.md](identity-sessions.md).

Cost delta: a Cloud Run/App Engine deployment, a custom domain and certificate,
staging + prod containers, and engineers who can debug a Node tag server. Do not
pay it without the trigger conditions in tier 3.
