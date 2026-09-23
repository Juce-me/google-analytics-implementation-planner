# Framework integration — where the analytics code actually goes

React is the flagship here because React apps break GA4 in a specific, repeatable
way: the router changes the URL without a page load, so `page_view` either
double-counts or vanishes. Every section below answers the same three questions.

1. **Mount point** — where the tag or container loads, exactly once.
2. **`page_view` ownership** — automatic (Enhanced Measurement) or manual. Never
   both. See [tier-1-ga4-direct.md](tier-1-ga4-direct.md) for the switch names
   and [tier-2-gtm-web.md](tier-2-gtm-web.md) for the GTM variant.
3. **Consent gate** — where the deny-by-default check lives so no event escapes
   before the user answers.

Snippets are adapt-to-your-repo templates, not a library to install. Every one
must land in the plan with a real `file:line` anchor.

Docs. URL and topic verified on the date shown.

- CONFIRMED 2026-07-28: <https://nextjs.org/docs/app/api-reference/components/script>
- CONFIRMED 2026-07-28: <https://nextjs.org/docs/app/api-reference/functions/use-search-params>
- CONFIRMED 2026-07-28: <https://nextjs.org/docs/pages/api-reference/functions/use-router>
- CONFIRMED 2026-07-28: <https://reactrouter.com/api/hooks/useLocation>
- CONFIRMED 2026-07-28: <https://rnfirebase.io/analytics/usage>
- CONFIRMED 2026-07-28: <https://reactnavigation.org/docs/screen-tracking/>
- CONFIRMED 2026-07-28: <https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications>
- CONFIRMED 2026-07-28: <https://firebase.google.com/docs/analytics/screenviews>

## The one boundary that makes tiers swappable

Components never call `gtag`, `dataLayer`, or `fetch('/api/analytics')` directly.
They call one module. The tier lives inside that module, so moving tier 1 → 2 → 3
is a change to one file, not to every component.

```ts
// lib/analytics/track.ts
import type { EventName, EventParams } from './contract';

const enabled = () => typeof window !== 'undefined' && window.__analyticsConsent === true;

/** One analytics occurrence. Fields come from the plan's event catalog. */
export function track(
  event_name: EventName,
  ctx: { feature_name: string; screen_name?: string; page_name?: string },
  eventParams: EventParams = {},
) {
  if (!enabled()) return;

  // ── TIER 1: GA4 direct ────────────────────────────────────────────────
  window.gtag?.('event', event_name, { ...ctx, ...eventParams });

  // ── TIER 2: GTM web — replace the call above with this push ───────────
  // window.dataLayer?.push({
  //   event: 'userevent',
  //   trigger: 'userevent',
  //   event_type: 'event',
  //   event_name,
  //   feature_name: ctx.feature_name,
  //   screen_name: ctx.screen_name,
  //   userParams: { page_name: ctx.page_name },
  //   eventParams,
  // });

  // ── TIER 3: server-side — client hands off, server owns the send ──────
  // Only for events the server must own (see tier-3-server-side.md).
  // void fetch('/api/analytics', {
  //   method: 'POST',
  //   keepalive: true,
  //   headers: { 'content-type': 'application/json' },
  //   body: JSON.stringify({ event_name, ...ctx, eventParams }),
  // });
}

export function trackPageView(page_name: string, ctx: { feature_name: string } ) {
  if (!enabled()) return;
  // Tier 1, manual pageviews only — requires send_page_view:false in the tag.
  window.gtag?.('event', 'page_view', { page_name, ...ctx });
}
```

Rules for this module:

- One push / one `gtag` call per occurrence. Never loop and send three events for
  one user action.
- `enabled()` is the consent gate. It returns `false` until the CMP resolves, so
  the deny-by-default posture holds even on the first paint.
- Field names are identical across tiers. The tier changes the envelope, never
  the vocabulary. See [ga4-event-schema.md](ga4-event-schema.md).
- Tier 3's `/api/analytics` route must forward `client_id` and `session_id`
  obtained from the client tag (`gtag('get', …)`), or the server event lands
  without session attribution.

## React: Next.js App Router

**Mount point** — `app/layout.tsx`, via `next/script` with
`strategy="afterInteractive"`. The consent default snippet must be earlier and
synchronous, so it goes in the same `<head>` **above** the tag, not through
`next/script`.

```tsx
// app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* 1. consent defaults — synchronous, before any measurement tag */}
        <script
          dangerouslySetInnerHTML={{ __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              ad_storage: 'denied', ad_user_data: 'denied',
              ad_personalization: 'denied', analytics_storage: 'denied',
              wait_for_update: 500
            });
          ` }}
        />
      </head>
      <body>
        {children}
        {/* 2. the Google tag (tier 1) or the GTM container (tier 2) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-config" strategy="afterInteractive">{`
          gtag('js', new Date());
          gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
        `}</Script>
      </body>
    </html>
  );
}
```

**`page_view` ownership.** App Router navigation uses the History API, so
Enhanced Measurement's *page changes based on browser history events* already
produces a `page_view` per route change. **Default: leave it on and send nothing
manually.** That is Google's recommended path and it is less code.

Send manually only when you need a *logical* page name that the URL can't
express (`/p/8123/v2` → `checkout_review`). Then, in the same change:
`gtag('config', ID, { send_page_view: false })`, turn off the history-based
Enhanced Measurement option, and add this listener:

```tsx
// app/analytics-page-view.tsx  — client component
'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/analytics/track';
import { pageNameFor } from '@/lib/analytics/contract';

export function AnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    const key = `${pathname}?${searchParams?.toString() ?? ''}`;
    if (lastSent.current === key) return; // StrictMode double-invoke guard
    lastSent.current = key;
    trackPageView(pageNameFor(pathname), { feature_name: 'navigation' });
  }, [pathname, searchParams]);

  return null;
}
```

Two Next.js-specific traps:

- `useSearchParams` in a client component makes the enclosing route dynamic
  unless it sits inside a `<Suspense>` boundary. Wrap
  `<AnalyticsPageView />` in `<Suspense fallback={null}>` in the layout, or drop
  `searchParams` from the dependency list if query strings are not part of page
  identity (usually they are not — and full query strings must never become
  parameters; see [privacy-consent.md](privacy-consent.md)).
- Server Components can't send client events. An event that must fire from a
  server action is a tier-3 event; route it through the server, not through a
  smuggled client call.

## React: Next.js Pages Router

Mount the tag in `pages/_document.tsx` (consent defaults in `<Head>`, tag via
`next/script` in `_app.tsx`). Manual pageviews hook the router event instead of
the pathname:

```tsx
// pages/_app.tsx
useEffect(() => {
  const onDone = (url: string) =>
    trackPageView(pageNameFor(url), { feature_name: 'navigation' });
  router.events.on('routeChangeComplete', onDone);
  return () => router.events.off('routeChangeComplete', onDone);
}, [router.events]);
```

`routeChangeComplete` fires after the URL updates, which is what you want —
`routeChangeStart` reports the page the user is leaving.

## React: Vite / react-router SPA

Mount point is `index.html` (consent defaults, then the tag). The listener uses
`useLocation` inside the router tree:

```tsx
function AnalyticsPageView() {
  const location = useLocation();
  const lastSent = useRef<string | null>(null);
  useEffect(() => {
    if (lastSent.current === location.pathname) return;
    lastSent.current = location.pathname;
    trackPageView(pageNameFor(location.pathname), { feature_name: 'navigation' });
  }, [location.pathname]);
  return null;
}
```

Hash-only routers (`/#/pricing`) are the one case where automatic history
tracking is unreliable and manual sends are the right default: `page_location`
excludes the fragment, so every route looks like the same page.

## React: the hook components actually use

```tsx
// lib/analytics/use-analytics.ts
export function useAnalytics(feature_name: string) {
  return useMemo(() => ({
    track: (name: EventName, params?: EventParams) =>
      track(name, { feature_name }, params),
  }), [feature_name]);
}
```

```tsx
// components/SignupForm.tsx
const analytics = useAnalytics('auth');

async function onSubmit(values: FormValues) {
  const result = await signUp(values);
  if (result.ok) analytics.track('sign_up', { method: 'password' });
}
```

Why a hook rather than raw imports: `feature_name` is bound once per component,
so it can't drift per call site, and the plan's event catalog maps 1:1 to
`useAnalytics('<feature>')` call sites — which makes the CI drift check in
[assets/analytics-contract-template.md](../assets/analytics-contract-template.md)
mechanical.

## React pitfalls that produce wrong data

- **StrictMode double-invokes effects in development.** Every `useEffect` send
  fires twice locally. Use the `lastSent` ref guard above, and never "fix" it by
  removing StrictMode.
- **Never send during render.** Render can run more than once per commit. Sends
  belong in `useEffect` or an event handler.
- **Guard `window`.** Any module-scope `window.gtag` access breaks SSR and
  prerender. The `enabled()` check above covers it.
- **One provider, one mount.** Two `<Script>` tags for the same Measurement ID,
  or a tier-1 snippet left behind after moving to tier 2, double-counts
  everything.
- **Don't fire on unmount for funnel steps.** Unmount also happens on
  navigation-away and on error boundaries; you'll invent steps users never
  reached.
- **`useEffect` dependency arrays are the event contract.** A pageview effect
  depending on an object literal re-fires on every render.

## React Native + Firebase (app streams)

Mount point is app start: the Firebase SDK initializes itself; you configure
collection. This is [tier 1](tier-1-ga4-direct.md) for apps — MP is augmentation
only.

- `logEvent(name, params)` for catalog events.
- `setUserId(hashedPepperedId)` on login, `setUserId(null)` on logout.
- `setConsent({...})` for consent signals;
  `setAnalyticsCollectionEnabled(false)` as the hard off switch for minors or
  unclassified users — set it before the SDK collects anything.
- **Screen views are automatic.** Add manual `logScreenView` only for screens the
  SDK cannot see (a tab swap inside one native screen). If you attach a
  `NavigationContainer` `onStateChange` screen tracker, you own screen reporting
  and must not duplicate what the SDK already sends.

The `track()` boundary still applies: one `lib/analytics/track.ts` whose body
calls the Firebase SDK, so screens and components never import Firebase directly.

## Vue, Svelte, plain JS

Same three answers, different hook names.

- **Vue Router:** `router.afterEach((to) => trackPageView(pageNameFor(to.path)))`.
- **SvelteKit:** subscribe to `page` in the root layout, or use the
  `afterNavigate` lifecycle.
- **Plain multi-page JS:** nothing to do — page loads are the natural
  `page_view`. Leave Enhanced Measurement on and don't invent a router listener.

## Server-rendered apps (Rails, Django, Laravel)

- Mount the tag in the single global layout, not per template.
- Every full-page response is a real `page_view` — Enhanced Measurement handles
  it. Turn nothing off.
- Turbo / Hotwire / htmx swap the body without a page load, which makes them
  SPAs for measurement purposes: pick one owner exactly as above (Turbo emits
  `turbo:load` on each visit).
- Events that only the server knows (a background job finishing, a webhook) are
  tier-3 events, not hidden client calls. See
  [tier-3-server-side.md](tier-3-server-side.md).

## Verification for framework wiring

- [ ] Click through five routes → exactly five `page_view` events in DebugView.
- [ ] Reload a deep link → one `page_view`, not two.
- [ ] Back button → one `page_view`.
- [ ] Dev build with StrictMode → still one event per action.
- [ ] View source: consent defaults appear before the tag, synchronously.
- [ ] Grep the app for direct `gtag(` / `dataLayer.push(` outside
      `lib/analytics/` → zero hits.
- [ ] SSR/prerender build passes with analytics enabled (no `window` access at
      module scope).
