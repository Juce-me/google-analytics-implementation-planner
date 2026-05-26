# google-analytics-implementation-planner

A portable agent **skill** that produces a privacy-first, codebase-anchored
Google Analytics 4 (GA4) instrumentation plan — and a separate setup
runbook — for any web, server-side, or hybrid application.

Built to work across coding agents that read the [AGENTS.md](https://agents.md)
standard (Claude Code, Codex, Cursor, Windsurf, Copilot, Aider, Devin,
Amp, Gemini CLI). The Superpowers skills framework is the primary
integration target; the skill degrades cleanly on agents without
Superpowers.

## What this skill does

Given a repo and a vague analytics ask ("add GA4", "what should we
track", "set up Google Analytics"), the skill produces:

1. **A design plan** — the **why**. Decisions the data must drive, the
   chosen architecture, the event catalog (with `file:line` anchors),
   identity and session strategy, consent and legal floor, the
   registration table for custom dimensions and metrics, and a
   verification checklist.
2. **A setup runbook** — the **how**. GA4 admin click-paths, GTM
   container configuration (if applicable), the Measurement Protocol
   payload contract (if server-side), Consent Mode v2 defaults
   snippet, DebugView validation, BigQuery export setup, rollback.

The two artifacts are kept separate by design — they drift if merged.
The skill also tells the target repo to maintain a durable
`docs/README_ANALYTICS.md` contract and an `AGENTS.md` analytics-impact
rule for future features.

## What this skill is NOT

- Not a generic "track everything" event list. Every event in the
  output traces to a stated decision; surfaces with no decision get
  cut.
- Not a vendor-agnostic planner. This skill is **GA4-deep**. Other
  vendors (Segment, PostHog, Plausible, Amplitude) need a different
  skill. Mentions of those vendors trigger a scope check, not a
  non-GA4 implementation plan.
- Not a counsel substitute. For minors (COPPA / EU), health (HIPAA),
  finance (PCI / regulated), or large-scale EU monitoring, the skill
  **escalates** instead of producing a templated plan.

## Repo layout

```
google-analytics-skill/
├── AGENTS.md                  # Agent operating instructions (root)
├── CLAUDE.md → AGENTS.md
├── GEMINI.md → AGENTS.md
├── README.md                  # this file
├── docs/
│   ├── agents.md              # Where agent work artifacts live
│   └── ...                    # Per-class subfolders created on first use
├── postmortem/                # Incident records
└── skills/
    └── google-analytics-implementation-planner/
        ├── agents/
        │   └── openai.yaml     # Codex / OpenAI skill UI metadata
        ├── SKILL.md           # Skill entry point (frontmatter + body)
        ├── references/        # Deep-dive docs the skill points to on demand
        │   ├── ga4-event-schema.md
        │   ├── ga4-server-side.md
        │   ├── gtm-and-tagging.md
        │   ├── privacy-consent.md
        │   ├── identity-sessions.md
        │   ├── reporting-config.md
        │   └── surface-checklist.md
        ├── assets/            # Output templates
        │   ├── analytics-contract-template.md
        │   ├── plan-template.md
        │   ├── runbook-template.md
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
ln -s /Users/juce/Documents/devs/google-analytics-skill/skills/google-analytics-implementation-planner \
  ~/.codex/skills/google-analytics-implementation-planner
```

For a project-local Codex use, copy or symlink the same folder into the
target repo's `skills/` directory and ask Codex to use
`$google-analytics-implementation-planner`.

### Claude Code

For a personal Claude Code install:

```bash
mkdir -p ~/.claude/skills
ln -s /Users/juce/Documents/devs/google-analytics-skill/skills/google-analytics-implementation-planner \
  ~/.claude/skills/google-analytics-implementation-planner
```

For a project-local Claude Code install:

```bash
mkdir -p .claude/skills
ln -s /Users/juce/Documents/devs/google-analytics-skill/skills/google-analytics-implementation-planner \
  .claude/skills/google-analytics-implementation-planner
```

Claude Code discovers personal skills from `~/.claude/skills/<skill>/SKILL.md`
and project skills from `.claude/skills/<skill>/SKILL.md`; see the
[Claude Code skills docs](https://docs.claude.com/en/docs/claude-code/skills).

## Usage

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

The starter `evals.json` contains four realistic prompts (greenfield
SaaS, child-audience escalation case, ecommerce migration to server-side,
and broad-vendor scope guarding) — extend it as the skill matures.

## Contributing

- Match the existing voice and structure when adding reference docs.
- New reference files live under `skills/google-analytics-implementation-planner/references/`
  and must be pointed at from `SKILL.md`. Orphan reference files are
  dead weight — either link them or delete them.
- Verifiable claims about GA4 / GTM / Measurement Protocol must
  include a vendor doc URL inline. Mark each claim CONFIRMED /
  REFUTED / PARTIAL / NOT-FOUND.
- See [AGENTS.md](AGENTS.md) for the operating rules that apply to
  all changes in this repo.

## Status

Initial release. The SKILL.md and reference docs are the load-bearing
content; the templates in `assets/` and the eval prompts in `evals/`
are starting points expected to evolve with use.

Last verified against GA4 + Consent Mode v2 + Measurement Protocol
docs: see header notes in each reference file.
