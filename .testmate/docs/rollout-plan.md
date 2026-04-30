# Rollout Plan

Current v1 focus: individual AI IDE users using TestMate as a copied policy kit.

Use `.testmate/docs/current-action-plan.md` for the near-term product plan, `.testmate/docs/ai-ide-prompts.md` for ready-to-use advisory prompts, `.testmate/docs/fixture-calibration.md` for the fixture strategy, and `.testmate/docs/cli-ci-telemetry-todo.md` for deferred CLI, CI, and telemetry work. CI, telemetry export, and hosted collection are follow-on paths, not the first onboarding experience.

## Phase 1: Policy

Deliver:

- AGENTS.md
- agent prompts
- PR template
- coverage matrix

## Phase 2: Local Gates

Deliver:

- quality scripts
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
- CLI/CI/telemetry TODO: `.testmate/docs/cli-ci-telemetry-todo.md`

## Current Working Artifacts

- `WORKING_V2_PLAN.md` is the active implementation plan.
- `AUDIT_REPORT.md` is the current branch audit status.
- `RELEASE_CHECKLIST.md` is the release gate for TestMate itself.
- `.testmate/docs/current-action-plan.md` is the current v1 AI IDE copied-kit action plan.
- `.testmate/docs/fixture-calibration.md` defines calibration fixture strategy.
- `.testmate/docs/cli-ci-telemetry-todo.md` collects deferred CLI, CI, telemetry, and cost-principle work.
- `.testmate/docs/waiver-policy.md` defines accepted waiver evidence.
- `.testmate/docs/runtime-validation-roadmap.md` defines schema/runtime validation and versioning work.
