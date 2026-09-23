# google-analytics-implementation-planner

A portable agent **skill** that produces a privacy-first, codebase-anchored
Google Analytics 4 (GA4) instrumentation plan, separate setup runbook,
durable analytics contract, future-feature analytics rule, and optional
MCP execution spec for any web, mobile app, server-side, or hybrid
application.

Built to work across coding agents that read the [AGENTS.md](https://agents.md)
standard (Claude Code, Codex, Cursor, Windsurf, Copilot, Aider, Devin,
Amp, Gemini CLI). The Superpowers skills framework is the primary
integration target; the skill degrades cleanly on agents without
Superpowers.

## What this skill does

Given a repo and a vague analytics ask ("add GA4", "what should we
track", "set up Google Analytics"), the skill first **asks** — a blocking
five-block intake questionnaire (goal and decisions, audience and legal,
platform and stack, tier and ownership, existing GA4/GTM state), one block
per message. Nothing is produced while a required answer is missing, and
nothing in the output is inferred: every value traces to the user, to the
repo with a `file:line` citation, or to a cited vendor doc. See
[`assets/intake-questionnaire.md`](skills/google-analytics-implementation-planner/assets/intake-questionnaire.md).

Then it produces:

1. **A design plan** — the **why**. Decisions the data must drive, the
   chosen architecture, the event catalog (with `file:line` anchors),
   identity and session strategy, consent and legal floor, the
   registration table for custom dimensions and metrics, and a
   verification checklist.
2. **A setup runbook** — the **how**. GA4 admin click-paths, GTM
   container configuration (if applicable), the Measurement Protocol
   payload contract (if server-side), Consent Mode v2 defaults
   snippet, DebugView validation, conditional BigQuery export setup,
   rollback.
3. **An optional MCP execution spec** — the **automation handoff**.
   Machine-readable desired state for a separate custom MCP server to
   apply approved GA4/GTM configuration safely.

The plan and runbook are kept separate by design — they drift if merged.
The durable `docs/README_ANALYTICS.md` contract and `AGENTS.md`
analytics-impact rule keep future features aligned after launch.

## Three tiers, one per plan

The tier is the transport. It is chosen by the user, recorded in the plan,
and never inferred. Platform (web, React SPA, iOS/Android app, backend) is
a separate question — any platform runs at any tier.

| Tier | What it is | Right when | Ops cost |
| --- | --- | --- | --- |
| **1 — basic** | GA4 direct: the Google tag (`gtag.js`) on web, the Firebase Analytics SDK on app | engineering owns instrumentation, one property, no ad pixels | none |
| **2 — advanced** | GTM web container + the `userevent` dataLayer contract | non-engineers must ship tags without a deploy | container ownership |
| **3 — hyper** | Server-side: sGTM tagging server and/or Measurement Protocol | ad-blocker loss costs more than the infra, or the server holds the truth | you run infra |

Tier 2 contains tier 1's GA4 property work; tier 3 always layers on top of
a client tier and never replaces automatic collection. Each tier reference
ends with an explicit upgrade path — what carries over, what changes shape,
what must be migrated, and the cost delta.

**React is a first-class target.** The skill decides and records the mount
point, the single owner of `page_view` (Enhanced Measurement history events
or a manual router send — never both), and the consent gate, for Next.js
App Router, Next.js Pages Router, Vite + react-router, React Native +
Firebase, Vue/Svelte, and Turbo/htmx.

## What this skill is NOT

- Not a generic "track everything" event list. Every event in the
  output traces to a stated decision; surfaces with no decision get
  cut.
- Not a one-shot generator. It asks first and blocks on missing answers,
  because an invented property id or consent posture becomes a production
  defect that GA4 will not let you un-collect.
- Not a vendor-agnostic planner. This skill is **GA4-deep**. Other
  vendors (Segment, PostHog, Plausible, Amplitude) need a different
  skill. Mentions of those vendors trigger a scope check, not a
  non-GA4 implementation plan.
- Not a counsel substitute. For minors (COPPA / EU), health (HIPAA),
  finance (PCI / regulated), or large-scale EU monitoring, the skill
  **escalates** instead of producing a templated plan. Google Analytics
  does not offer a HIPAA BAA, so HIPAA-regulated PHI must not be exposed
  to GA.

## Repo layout

```
google-analytics-skill/
├── AGENTS.md                  # Agent operating instructions (root)
├── CLAUDE.md → AGENTS.md
├── GEMINI.md → AGENTS.md
├── README.md                  # this file
├── docs/
│   ├── AGENTS.md              # Where agent work artifacts live
│   └── ...                    # Per-class subfolders created on first use
├── postmortem/                # Incident records
└── skills/
    └── google-analytics-implementation-planner/
        ├── agents/
        │   └── openai.yaml     # Codex / OpenAI skill UI metadata
        ├── SKILL.md           # Skill entry point: intake gate, tier choice, process
        ├── references/        # Deep-dive docs the skill points to on demand
        │   ├── tier-1-ga4-direct.md
        │   ├── tier-2-gtm-web.md
        │   ├── tier-3-server-side.md
        │   ├── framework-integration.md
        │   ├── ga4-event-schema.md
        │   ├── identity-sessions.md
        │   ├── mcp-automation.md
        │   ├── privacy-consent.md
        │   ├── reporting-config.md
        │   └── surface-checklist.md
        ├── assets/            # Intake script + output templates
        │   ├── intake-questionnaire.md
        │   ├── plan-template.md
        │   ├── runbook-template.md
        │   ├── analytics-contract-template.md
        │   ├── mcp-execution-spec-template.yaml
        │   └── forbidden-keys.md
        └── evals/
            └── evals.json     # Starter test prompts for the skill-creator loop
```

The skill follows the standard three-level progressive-disclosure
shape used by Claude Code and Anthropic skills:

| Level | What loads | When |
| --- | --- | --- |
| 1 | YAML frontmatter (`name`, `description`) | Always — used to decide whether to trigger |
| 2 | SKILL.md body | When the skill triggers |
| 3 | `references/*.md`, `assets/*.md` | On demand, by name, only when the relevant step needs them |

## Installation

Use either a personal install (available in every repo) or a project-local
install (available only in that repo). The skill folder to install is:

```text
skills/google-analytics-implementation-planner/
```

### Codex

For a personal Codex install from this checkout:

```bash
mkdir -p ~/.codex/skills
ln -s "$(pwd)/skills/google-analytics-implementation-planner" \
  ~/.codex/skills/google-analytics-implementation-planner
```

For a project-local Codex use, copy or symlink the same folder into the
target repo's `skills/` directory and ask Codex to use
`$google-analytics-implementation-planner`.

### Claude Code

For a personal Claude Code install:

```bash
mkdir -p ~/.claude/skills
ln -s "$(pwd)/skills/google-analytics-implementation-planner" \
  ~/.claude/skills/google-analytics-implementation-planner
```

For a project-local Claude Code install:

```bash
mkdir -p .claude/skills
ln -s "$(pwd)/skills/google-analytics-implementation-planner" \
  .claude/skills/google-analytics-implementation-planner
```

Claude Code discovers personal skills from `~/.claude/skills/<skill>/SKILL.md`
and project skills from `.claude/skills/<skill>/SKILL.md`; see the
[Claude Code skills docs](https://docs.claude.com/en/docs/claude-code/skills).

## Usage

### What to expect on the first run

The first response is questions, not a plan. Expect up to five short
question blocks; answer them in any level of detail you have. Three answers
are always acceptable:

- the real answer;
- "you decide" — the skill recommends one and records your confirmation;
- "I don't know yet" — the skill marks the item `OPEN`, says exactly what it
  blocks, and continues with everything that doesn't depend on it.

What you will not get is a plausible-looking guess. If a plan arrives with a
`G-` Measurement ID you never supplied, that is a bug worth reporting.

### MCP automation handoff

When the user asks for MCP-based GA4/GTM configuration, the skill still
produces the human design plan and setup runbook first. It then produces
a machine-readable `*.mcp-execution.yaml` desired-state artifact for a
separate custom MCP server.

This repo does not implement the MCP server. The official Google
Analytics MCP server is read-only, so write-side configuration requires
a custom MCP wrapper around Google Tag Manager API and Google Analytics
Admin API.

The execution spec defaults to dry-run mode, creates changes in a GTM
workspace, checks workspace capacity before applying changes, and blocks
version creation/publish unless explicitly approved.

### In Claude Code (with the Superpowers framework)

1. Install the skill using one of the Claude Code options above.
2. Ask for a GA4 / GTM analytics plan, for example:
   `Use $google-analytics-implementation-planner to plan GA4 for this app.`
3. The skill will engage `using-superpowers`, then route the work
   through `brainstorming` / `writing-plans` / `verification-before-
   completion` as appropriate.

### In Codex

1. Install the skill using one of the Codex options above.
2. Ask for a GA4 / GTM analytics plan, for example:
   `Use $google-analytics-implementation-planner to audit what this repo should track.`
3. Codex has no guaranteed subagent dispatch, so the SKILL.md is written so each
   process step runs inline. Expect a longer single-context pass; the
   output quality target is the same.

### In other agents

Any agent that reads the [AGENTS.md](https://agents.md) standard will
honor the root operating rules. To make the skill itself discoverable,
either:

- symlink `SKILL.md` into the agent's expected skill location, or
- reference the skill explicitly in your prompt ("Use the skill at
  `skills/google-analytics-implementation-planner/SKILL.md`").

## Iterating on the skill

This repo is itself a skill-development environment. The
[skill-creator workflow](https://github.com/anthropics/skills) loop is:

1. Edit `SKILL.md` or a reference doc.
2. Run the test prompts in `skills/google-analytics-implementation-planner/evals/evals.json`
   against a fresh agent context — once **with** the skill, once
   **without** — and compare outputs.
3. Review the output diffs, capture feedback, and edit the skill
   again.
4. Repeat until the with-skill outputs are reliably better than the
   baseline.

`evals.json` contains twelve realistic prompts: greenfield SaaS,
child-audience escalation, ecommerce migration to server-side,
broad-vendor scope guarding, React Native/Firebase app streams, a GTM web
contract case, MCP execution-spec and publish-guard cases, Measurement-ID
gating, and three that guard the new behavior — intake-gate blocking
(a bare "add GA4" must produce questions, not a plan), Next.js App Router
tier-1 wiring (the `page_view` double-count must be resolved explicitly),
and tier pushback when the requested tier is disproportionate. Extend it as
the skill matures.

## Contributing

- Match the existing voice and structure when adding reference docs.
- New reference files live under `skills/google-analytics-implementation-planner/references/`
  and must be pointed at from `SKILL.md`. Orphan reference files are
  dead weight — either link them or delete them.
- Verifiable claims about GA4 / GTM / Measurement Protocol must be backed
  by vendor docs. Use section-level source lists when a section is sourced
  as a unit, and inline URLs for disputed, surprising, or fast-changing
  claims. Mark sources CONFIRMED / REFUTED / PARTIAL / NOT-FOUND.
- See [AGENTS.md](AGENTS.md) for the operating rules that apply to
  all changes in this repo.

## Status

Initial release. The SKILL.md and reference docs are the load-bearing
content; the templates in `assets/` and the eval prompts in `evals/`
are starting points expected to evolve with use.

Last verified against GA4 + Consent Mode v2 + Measurement Protocol docs:
see dated header notes in each reference file.
