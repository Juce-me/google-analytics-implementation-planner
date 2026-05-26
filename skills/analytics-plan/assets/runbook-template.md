Status: planned
Type: feature
Author: <your-handle>

# GA4 Setup Runbook

> The **how**, not the **why**. The **why** lives in the design plan
> (sibling artifact). When something here changes (a click-path
> screenshot, a new admin step), update this file — don't drift the
> plan.

## Revision history

| Date | Pass | Author | What changed |
| --- | --- | --- | --- |
| YYYY-MM-DD | 1 | <handle> | Initial draft |

## 0. Prerequisites

- [ ] Google account with Editor permission on the GA4 property (or
      create-property permission on the target organization).
- [ ] Access to the codebase (commit + PR).
- [ ] Access to the CMP admin panel (if applicable).
- [ ] Secret-manager access to write the `PEPPER` for user-id hashing.
- [ ] If sGTM: GCP project + billing + Cloud Run deploy permissions.

## 1. Create / configure the GA4 property

Admin (gear icon, bottom left) → Property column.

1. **Property → Property Details:** name, timezone, currency. (Currency
   here defines the report-level conversion target — set even if you
   don't have ecommerce.)
2. **Data Streams → Web** (or App):
   - Stream name, URL, stream id.
   - Enhanced Measurement → toggle: keep ON for `page_view`,
     `scroll`, `outbound click`, `site search`, `video engagement`,
     `file download`. **Turn OFF anything you'll re-emit manually**
     (avoid double counts).
   - Configure tag settings → Domains → list of cross-domain
     destinations.
   - Configure tag settings → Internal traffic → add IP rules for the
     office / VPN to exclude.
3. **Property → Reporting Identity:** choose Blended / Observed /
   Device-based per plan §4.
4. **Property → Data Settings → Data Retention:** 14 months (max on
   Standard; longer requires 360). Reset user data on new activity:
   ON.
5. **Property → Data Settings → Data Collection → Google Signals:**
   ON if marketing needs demographics & cross-device; OFF if audience
   includes minors or strict-privacy use cases.

## 2. Register custom definitions

Admin → Property → **Custom Definitions**.

Custom dimensions tab → Create custom dimension. Paste rows from
plan §6:

| Display name | Scope | Description | Event parameter / User property |
| --- | --- | --- | --- |
| Plan tier | User | Subscription tier at event time | `plan_tier` |
| Feature area | Event | Top-level product area | `feature_area` |
| Experiment variant | User | A/B test cell | `experiment_variant` |
| ... | | | |

Custom metrics tab → Create custom metric. Specify **unit** correctly:

| Display name | Scope | Description | Parameter | Unit of measurement |
| --- | --- | --- | --- | --- |
| Latency | Event | Server response time | `latency_ms` | Milliseconds |
| ... | | | | |

> **Cannot be deleted** once created — only archived. Double-check
> spelling and case of the parameter name BEFORE saving.

## 3. Mark key events (conversions)

Admin → Property → **Events** → after the event has fired at least once
(or after manual creation), toggle **Mark as key event**. For events
that have never fired yet:

- Admin → Property → **Key events** → Create → enter event name
  exactly as it will fire.

Per plan §6: `sign_up`, `purchase`, `<other>`.

## 4. Measurement Protocol API secret (if server-side)

Admin → Data Streams → <stream> → Measurement Protocol API secrets →
**Create**.

- Name: `<env>-server` (e.g., `prod-server`).
- Copy the secret immediately — it's only shown once.
- Store in secret manager. Reference from server config as
  `GA4_MP_API_SECRET`.

Repeat per environment. Never share secrets across envs.

## 5. Consent Mode v2 (web)

Place the **default snippet** inline in `<head>` of every server-
rendered page, BEFORE any tag loader. Example:

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

For EU traffic the defaults are `denied`. For non-EU traffic the
choice is documented in plan §7.

Wire your CMP's "Accept" / "Reject" callbacks to call
`gtag('consent', 'update', {…})` with the user's choice.

## 6. (If using GTM) container setup

GTM admin → Workspace.

1. Create new container per environment. Never share across envs.
2. Tags → New → Google Analytics: GA4 Event (or Configuration) tag.
3. Triggers → All Pages for the Configuration tag, specific event
   triggers for Event tags.
4. **Consent settings** on every tag — set required consent to
   `analytics_storage` (and `ad_storage` for ads tags) so it respects
   defaults.
5. Variables → enable built-ins (Page Path, Click ID, Click URL).
6. Preview before publishing. Publish only after Tag Assistant green
   for every test path.
7. Lock prod container — only the analytics lead has publish rights.

## 7. (If using sGTM) server-side container

1. Create server container in GTM.
2. Tagging Server → Provisioning → Manually provision (Cloud Run /
   App Engine). Document the GCP project, region, scaling settings.
3. Map a first-party subdomain (`analytics.example.com`) → server
   container.
4. Web container points to the sGTM endpoint instead of
   `google-analytics.com` directly.
5. GA4 client tag inside the sGTM container forwards to GA4 with the
   measurement id.
6. Health checks + alerting on the Cloud Run service. Document the
   on-call.

## 8. Validation

### DebugView

1. Admin → Property → **DebugView**.
2. To stream a device into DebugView: install GA Debugger Chrome
   extension, OR pass `debug_mode: true` on the gtag config (web) or
   `?debug_mode=1` to the Measurement Protocol endpoint (server-side).
3. Fire each event in plan §5. Confirm it appears within seconds with
   ALL expected parameters and correct types.

### Measurement Protocol debug endpoint

For server-side, validate payload shape BEFORE switching to the live
endpoint:

```bash
curl -X POST \
  "https://www.google-analytics.com/debug/mp/collect?measurement_id=G-XXX&api_secret=$GA4_MP_API_SECRET" \
  -H "Content-Type: application/json" \
  -d @event.json
```

Expected response: `{"validationMessages": []}`. Any messages indicate
malformed payload — fix before live calls.

### Realtime report

Admin → Reports → **Realtime**. Fire a test event; confirm it appears
within 30 seconds and the params show in the "Event count by Event
name" card.

### Custom dimension / metric population

DebugView → click the event → the parameter row shows the value AND a
chip indicating "Custom dimension: <name>" once registered. If the
chip is missing, the dimension is registered with a wrong parameter
key.

## 9. Data export to BigQuery (if applicable)

Admin → Property → **BigQuery Links** → Link.

1. Select GCP project.
2. Data location: **EU** for EU residents (or as documented in plan §7).
3. Frequency: Daily (free), Streaming (paid).
4. Include advertising identifiers: per plan §7.

## 10. Ongoing operations

- **Drift check in CI** — `scripts/check_analytics.ts` compares code
  event names to plan §5 catalog. Fails CI on drift.
- **Quarterly review** — re-read plan §1 decisions. Have they changed?
  Cut events that no longer serve a decision.
- **Pepper rotation** — quarterly cadence. Backfill stored hashes
  during the rotation window.
- **Cardinality watch** — Reports → Explore → "(other)" appearing in
  any dimension is the alarm; investigate the registration.

## 11. Rollback

If the live deploy creates a problem:

1. **Web (gtag.js / GTM):** revert the container publish (GTM → Admin
   → Versions → publish a previous version). For gtag.js, revert the
   code commit.
2. **Server-side (MP):** flip a feature flag to disable analytics
   sends. The queue drains, drop counter goes to 100%, no user impact.
3. **Custom dimensions:** cannot be deleted; archive instead.
4. **Communicate** — note the rollback in the design plan's revision
   header.
