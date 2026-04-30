# Rollout Plan

Current v1 focus: individual AI IDE users using TestMate as a copied policy kit.

Use `docs/current-action-plan.md` for the near-term product plan, `docs/ai-ide-prompts.md` for ready-to-use advisory prompts, `docs/fixture-calibration.md` for the fixture strategy, and `docs/cli-ci-telemetry-todo.md` for deferred infrastructure work. CI, telemetry export, and hosted collection are follow-on paths, not the first onboarding experience.

## Phase 1: Policy

Deliver:

- AGENTS.md
- agent prompts
- PR template
- coverage matrix

## Phase 2: Local Gates

Deliver:

- copied-kit usage
- AI IDE prompts
- pre-commit advisory usage
- pre-MR advisory prompt
- basic AI IDE workflow
- model-agnostic output contract

## Phase 3: Pull Request Gate

Deliver:

- MR quality summary
- regression auditor
- blocking rules for high-risk changes
- CI integration

## Phase 4: Release Gate

Deliver:

- critical E2E suite
- release prompt
- visual/a11y checks where relevant
- manual QA checklist

## Phase 5: Orchestration

Deliver:

- multi-agent workflow
- structured JSON output
- calibration fixtures
- optional dashboard/metrics
- flaky test triage process
- CLI/CI/telemetry TODO: `docs/cli-ci-telemetry-todo.md`
