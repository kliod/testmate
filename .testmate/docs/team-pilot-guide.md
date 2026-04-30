# TestMate Team Pilot Guide

This guide describes how to try TestMate in a real engineering team without pretending it is already an enterprise-wide mandatory gate.

For the current product focus and near-term action plan, see `docs/current-action-plan.md`.
For ready-to-use AI IDE prompts, see `docs/ai-ide-prompts.md`.
For fixture strategy, see `docs/fixture-calibration.md`.

## Pilot Goal

Use TestMate to make frontend and web regression risk explicit before merge:

- identify high-risk changes;
- require meaningful tests for risky behavior;
- document waivers and overrides;
- collect early effectiveness signals without fake ROI claims.

## Recommended Pilot Modes

| Mode | API Required | Blocks Work | Best For |
| --- | --- | --- | --- |
| Local advisory | No | No | Day-to-day work in Cursor, Claude Code, Codex, or similar AI IDEs |
| Non-blocking CI | Optional | No | First team adoption, dry runs, pull request visibility |
| Blocking CI | Yes | Yes | Protected branches, production repositories, mature teams |

## Phase 1 - Local Advisory

Use this first. It does not require `OPENAI_API_KEY` because the developer asks the AI IDE to apply the TestMate policy directly.

Recommended local prompt:

```text
Run a TestMate Tier 1 check for my current diff. Identify missing regression coverage and suggest the lowest reliable test layer.
```

For higher-risk work:

```text
Run a TestMate Tier 2 check for this change. Include affected areas, missing coverage, and whether this should be PASS, WARNING, BLOCK, or NEED_INFO.
```

Use local advisory for:

- bug fixes;
- form changes;
- routing changes;
- auth/permission changes;
- cache/refetch behavior;
- risky UI behavior changes before opening a PR.

Do not create audit logs for ordinary local advisory work.

## Phase 2 - Non-Blocking CI

Use non-blocking CI while the team is learning whether TestMate findings are useful.

The provided GitHub workflow currently uses:

```yaml
TESTMATE_REQUIRE_API_KEY: "false"
```

With this setting:

- if `OPENAI_API_KEY` is configured, TestMate runs the CI quality gate;
- if `OPENAI_API_KEY` is missing, the workflow skips the AI check and does not fail the PR.

This is appropriate for:

- early rollout;
- open-source or fork-friendly repositories;
- teams that want visibility before enforcement;
- repositories where the API key is not configured yet.

## Phase 3 - Blocking CI

Enable blocking CI only after the team agrees that the signal is useful and the policy is understood.

Set:

```yaml
TESTMATE_REQUIRE_API_KEY: "true"
```

Configure the GitHub secret:

```text
OPENAI_API_KEY
```

Blocking CI is appropriate for:

- protected branches;
- production applications;
- release branches;
- teams that have agreed on waiver and override rules.

## Suggested Pull Request Workflow

1. Developer runs local advisory review in the AI IDE.
2. Developer adds regression tests or documents a waiver.
3. PR opens with normal lint, typecheck, and tests.
4. Non-blocking TestMate CI runs during pilot.
5. Team reviews TestMate output and tracks useful findings.
6. After calibration, switch selected branches to blocking CI.

## Waivers

A waiver is accepted risk. It should be rare, explicit, and time-bound.

Use a waiver when:

- the risk is understood;
- a test is temporarily impractical;
- manual QA or a follow-up issue exists;
- an accountable reviewer approves it.

Minimum waiver fields:

```json
{
  "reason": "Release hotfix with manual QA coverage.",
  "riskLevel": "HIGH",
  "approvedBy": "team-lead@example.com",
  "expiresAt": "2026-05-06",
  "followUp": "Add regression test for failed submit state.",
  "issue": "QA-123"
}
```

A waiver should not turn a real risk into `PASS`. Prefer `WARNING` with documented residual risk.

## Overrides

An override means the team overruled TestMate's decision.

Track overrides separately from waivers because they can mean different things:

- TestMate produced a false positive;
- policy needs refinement;
- business urgency outweighed engineering risk;
- context was missing during the original decision.

Minimum override fields:

```json
{
  "originalStatus": "BLOCK",
  "newStatus": "WARNING",
  "reason": "Existing integration suite already covers this flow.",
  "approvedBy": "tech-lead@example.com",
  "followUp": "Add fixture to prevent future false positives."
}
```

## Pilot Success Criteria

Track measured behavior, not vibes.

Useful early signals:

- tests added after TestMate findings;
- real coverage gaps detected before merge;
- `BLOCK` decisions resolved before merge;
- `NEED_INFO` questions resolved quickly;
- low override rate with clear reasons;
- waivers have follow-up issues and expiry dates.

When recording follow-up events, include quality metadata where possible:

```bash
node scripts/testmate.mjs --record-effectiveness-event=waiver_used --run-id=<runId> --decision-status=WARNING --meaningfulness=meaningful --reason-code=accepted_risk --follow-up-issue=QA-123 --reviewed-by=team-lead@example.com --notes="Temporary waiver approved for hotfix."
```

Recommended fields:

| Field | Purpose |
| --- | --- |
| `meaningfulness` | Whether the action was `meaningful`, `not_meaningful`, or `unknown` |
| `reason-code` | Why the action happened, such as `accepted_risk`, `false_positive`, `test_added`, or `block_resolved` |
| `evidence-link` | Link to PR, issue, CI run, or review evidence |
| `follow-up-issue` | Tracking issue for deferred work |
| `reviewed-by` | Reviewer who confirmed the action quality |

Do not claim:

- exact ROI;
- defects prevented without evidence;
- universal correctness of `BLOCK`;
- productivity gains without baseline comparison.

## Maintainer Fixture Replay

TestMate maintainers should run the local fixture replay when changing policy, schema, CLI, or preflight logic.

```bash
npm run testmate:replay-fixtures
```

This command:

- does not call the OpenAI API;
- does not create audit logs;
- checks deterministic quality-gate scenarios in `fixtures/golden/`.

Most product teams piloting TestMate do not need to run fixture replay during normal feature development.

## Commands

| Task | Command |
| --- | --- |
| Run unit tests for TestMate itself | `npm test` |
| Replay maintainer fixtures | `npm run testmate:replay-fixtures` |
| Run targeted CLI gate | `npm run testmate:targeted` |
| Run MR/integrity CLI gate | `npm run testmate:integrity` |
| Show local effectiveness summary | `npm run testmate:effectiveness` |

## Cost Telemetry

Formal CLI runs record basic cost telemetry when the provider returns usage data.

Tracked fields include:

- `model`;
- `inputTokens`;
- `outputTokens`;
- `cachedInputTokens`;
- `totalTokens`;
- `estimatedModelCostUsd`;
- `actualModelCostUsd`.

Token counts are measured from provider usage payloads when available. Cost fields remain `null` unless explicitly supplied or calculated by a future pricing layer. Do not use these fields as ROI. They are operating-cost telemetry only.

## When To Move From Pilot To Enforcement

Move from non-blocking to blocking only when:

- the team understands `PASS`, `WARNING`, `BLOCK`, and `NEED_INFO`;
- waiver and override rules are documented;
- false positives are reviewed and used to improve fixtures or policy;
- high-risk changes consistently receive meaningful tests;
- CI has stable access to `OPENAI_API_KEY`;
- leadership understands that effectiveness metrics are measured or estimated, not magic ROI.
