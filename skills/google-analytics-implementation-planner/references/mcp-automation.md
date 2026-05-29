# MCP automation handoff

## Boundary

This repo is a planner skill. It decides what GA4/GTM configuration should
exist and emits a machine-readable desired-state artifact. It does not
implement an MCP server, call Google APIs, or mutate live GA4/GTM settings.

The MCP execution spec is the handoff between the planner and a separate,
custom, write-capable MCP server. The planner owns approved desired state:
target placeholders, source-artifact links, GA4 Admin desired state, GTM
web desired state, optional sGTM placeholders, validation rules, and
publish gates. The MCP server owns safe application of that desired state
against Google Analytics 4 and Google Tag Manager.

The official Google Analytics MCP server is read-only for Analytics
reporting and exploration. It must not be described as able to edit GA4 or
GTM configuration. Write-side configuration requires a custom MCP wrapper
around the Google Tag Manager API and Google Analytics Admin API.

The custom MCP may use the GTM API for accounts, containers, workspaces,
tags, triggers, built-in variables, variables, clients, versions, and
environments. It may use the GA Admin API for GA4 properties, streams,
Measurement Protocol secrets, key events, custom dimensions, and custom
metrics where supported. Some GA Admin API areas are Alpha/Beta, so write
operations must stay conservative and explicit.

## Allowed MCP actions

- Read current GA4/GTM state.
- Validate the `*.mcp-execution.yaml` schema and guardrails.
- Reject executable wildcard placeholders such as `eventParams.*`,
  `userParams.*`, or `<approved_param>`; the spec must contain concrete
  Data Layer Variables and tag params from the approved event catalog.
- Produce a dry-run diff.
- Check GTM workspace capacity before creating a new workspace.
- Create a GTM workspace when capacity is available.
- Upsert GTM built-in variables, data-layer variables, reusable triggers,
  and reusable GA4 event tags inside the new workspace.
- Create a GTM preview/checkpoint artifact for Tag Assistant validation.
- Create a GTM container version only after explicit operator approval.
- Create or update GA4 custom dimensions, custom metrics, and key events
  where supported by the GA Admin API.
- Request Measurement Protocol secret creation without writing the real
  secret into the spec. Return newly created secret values only through the
  operator's secure secret channel.

## Dangerous or gated actions

These actions are disabled by default and require separate explicit
approval:

- Publishing a GTM version.
- Creating a GTM container version. The API creates a version from the
  workspace and removes that workspace, so this is not a dry-run step.
- Deleting GTM entities.
- Archiving GA4 custom definitions.
- Modifying existing production tags directly instead of working in a new
  workspace.
- Creating or changing consent settings.
- Storing, echoing, or committing raw secrets.

## Default flow

1. Read `docs/agents/features/PLANNED-ga4-instrumentation.mcp-execution.yaml`.
2. Validate schema and guardrails.
3. Read current GA4/GTM state.
4. Check GTM workspace capacity.
5. Produce a dry-run diff.
6. Apply changes to a new GTM workspace only.
7. Produce a preview/checkpoint artifact.
8. Validate in Tag Assistant and GA4 DebugView.
9. Return the validation checklist.
10. Create a GTM container version only after explicit approval.
11. Publish only after separate explicit approval.

## Anti-patterns to preserve

- No Universal Analytics-style `event_category`, `event_action`, or
  `event_label`.
- No fake ecommerce `purchase` with `value: 0`.
- No high-cardinality custom dimensions such as `user_id`, `session_id`,
  or `transaction_id`.
- No per-event GTM trigger/tag explosion for normal product events.
  Normal web tracking uses the reusable `userevent` pageview and event
  paths, one `dataLayer.push` per analytics occurrence, and no batched
  GA4 events inside a single push; ecommerce stays separate only when
  deliberately active.
- No secrets in specs.
- No full URLs with query strings as event parameters or custom
  dimensions.
- No consent changes unless explicitly approved in the design plan.

## Sources

Authoritative docs last checked: 2026-05-28.

- CONFIRMED: https://developers.google.com/tag-platform/tag-manager/api/v2
- CONFIRMED: https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces/create_version
- CONFIRMED: https://support.google.com/tagmanager/answer/7059647
- CONFIRMED: https://developers.google.com/analytics/devguides/config/admin/v1
- CONFIRMED: https://developers.google.com/analytics/devguides/MCP
- CONFIRMED: https://support.google.com/tagmanager/answer/6107056
- CONFIRMED: https://support.google.com/tagmanager/answer/10718549
