# Web Testing Orchestrator Kit

Minimal public package for AI-assisted web testing in AI IDEs.

Goal: give Cursor / Claude Code / Codex / Antigravity a compact operating model for testing web apps before commit, pull request, merge, and release.

The agent does not merely generate tests. It makes a quality decision:

- `PASS` - safe to continue
- `WARNING` - acceptable with documented risk
- `BLOCK` - must fix before moving forward

## Contents

```txt
AGENTS.md                         Core project policy for AI IDEs
agents/                           Specialist agent prompts
prompts/                          Mode-specific prompts
docs/                             Compact policy docs
scripts/                          Example quality gate scripts/schema
.github/                          GitHub Actions + PR template
cursor-rules/                     Cursor-ready rules
examples/                         Example package scripts
```

## Current Product Focus

TestMate v1 is first a copied AI IDE policy kit for individual developers.

The core product surface is model-agnostic:

- `AGENTS.md`
- specialist agent prompts
- mode prompts
- the structured decision contract
- calibration fixtures
- compact docs for waivers, overrides, and rollout

These artifacts should work across Cursor, Codex, Claude Code, ChatGPT, OpenAI-backed CLI flows, OpenAI-compatible runtimes, and local-model workflows where the surrounding IDE or agent can read repository files and follow the contract.

The Node CLI is a reference adapter for CI/CD and scripted quality gates. It currently calls OpenAI Chat Completions directly. Other model/API adapters are expected to preserve the same policy, preflight concepts, and output contract rather than fork the rulebook.

## Dual Workflow Architecture

TestMate operates on two distinct planes to provide maximum safety without slowing down local development.

### 1. The Local Workflow (AI IDE Native)
**Best for**: Interactive development and Auto-Remediation.
If you use Cursor, Claude Code, or Antigravity, **do not use the console script**. 
Your IDE natively reads `.cursor-rules/testing.mdc` and the `AGENTS.md` rulebook. 
* **Workflow**: Write your code. Open the IDE Chat and type: *"Run Tier-1 checks and auto-fix any missing tests."*
* **Why**: The IDE will act as the Orchestrator, identify the missing tests, and use its native file-editing capabilities to write the tests and patch your files immediately. 

### 2. The CI/CD Workflow (Server CLI)
**Best for**: Rigid Quality Gates and Pull Request validation.
Servers don't have IDE interfaces, so we provide `scripts/testmate.mjs`.

* **Workflow**: Add a step to your `.github/workflows` or `.gitlab-ci.yml`:
  `npm run testmate:integrity`
* **Why**: It acts as a strict, read-only analyzer. If a developer bypassed the Local IDE checks, the script will output a Markdown list of errors, return `exit 1`, and Block the merge. 

## Installation & Setup

1. **Clone the repo** into your project or add it as a submodule.
2. **Set up Environment**:
   - Local advisory work in an AI IDE does not require `OPENAI_API_KEY`.
   - CLI quality-gate runs require `OPENAI_API_KEY` because `scripts/testmate.mjs` calls the OpenAI API.
3. **Run Locally**:
   ```bash
   npm install
   npm run testmate:targeted
   ```
4. **CI/CD Integration**:
   - **GitHub**: Use the provided actions in `.github/workflows`.
   - **GitLab**: Use the provided `.gitlab-ci.yml`. Ensure `OPENAI_API_KEY` is set in CI/CD Variables.

The provided GitHub quality gate is currently configured for non-blocking adoption:

```yaml
TESTMATE_REQUIRE_API_KEY: "false"
```

With this setting, CI skips the AI quality gate when `OPENAI_API_KEY` is not configured.
For production repositories, protected branches, or serious quality-gate enforcement, set:

```yaml
TESTMATE_REQUIRE_API_KEY: "true"
```

That makes a missing `OPENAI_API_KEY` fail the workflow instead of silently skipping TestMate.

## CLI Modes

The CLI accepts both workflow-oriented formal modes and legacy tier aliases.

| CLI input | Formal mode | Analysis scope |
| --- | --- | --- |
| `pre_commit` or `tier-1-targeted` | `pre_commit` | `DIFF` |
| `pre_mr` or `tier-2-impact` | `pre_mr` | `AFFECTED` |
| `pre_merge` | `pre_merge` | `AFFECTED` |
| `pre_release` or `tier-3-full` | `pre_release` | `FULL` |

Formal audit logs and runtime metrics always use the formal `pre_*` mode names.

## Golden Fixture Replay

TestMate includes a local maintainer replay suite for deterministic quality-gate fixtures.
This does not call the OpenAI API and does not create audit logs.

```bash
npm run testmate:replay-fixtures
```

Fixtures live in `fixtures/golden/` and cover starter scenarios such as static copy, form submit risk, auth guard risk, focused tests, and explicit waivers.
Most product teams do not need to run this during normal feature development.

Fixtures are calibration examples, not new rules. Add a fixture when a realistic scenario should test the existing policy language across models or IDEs. Add a new policy rule only when multiple fixtures expose a repeated risk that cannot be honestly covered by the current core policy.

## AI IDE Prompts

For ready-to-use advisory prompts, see `docs/ai-ide-prompts.md`.

## Team Pilot

For rollout guidance, see `docs/team-pilot-guide.md`.

## Prime rules

- Every non-trivial change requires test impact analysis.
- Every bug fix requires a regression test or documented waiver.
- Every high-risk change requires meaningful automated coverage.
- Test user behavior, not implementation details.
- Use the lowest reliable test layer.
- Do not create flaky tests.

## Effectiveness Metrics Phase 1

TestMate records lightweight local effectiveness data for formal quality gate runs.

- Runtime records are written to `.testmate/state/metrics.jsonl`.
- Follow-up outcome events are written to `.testmate/state/effectiveness.jsonl`.
- The data is local, append-only, and should not contain raw prompts, raw diffs, secrets, or customer payloads.

Show the current effectiveness summary:

```bash
npm run testmate:effectiveness
```

Show a human-readable summary:

```bash
node scripts/testmate.mjs --show-effectiveness --format=markdown
```

Limit the summary to a recent time window:

```bash
node scripts/testmate.mjs --show-effectiveness --days=30
```

Record a follow-up event after a decision:

```bash
node scripts/testmate.mjs --record-effectiveness-event=tests_added_after_decision --run-id=<runId> --decision-status=WARNING --meaningfulness=meaningful --reason-code=test_added --follow-up-issue=QA-123 --reviewed-by=lead@example.com --notes="Regression test added"
```

Supported event types include:

- `coverage_gap_detected`
- `tests_added_after_decision`
- `manual_qa_added`
- `follow_up_fix_required`
- `follow_up_fix_completed`
- `decision_overridden`
- `waiver_used`
- `clarification_required`
- `clarification_resolved`
- `issue_prevented`
- `post_decision_action_taken`
- `release_drift_caught`

The summary reports measured counts and ratios separately from estimated value. Estimated review minutes are heuristic ranges, not financial ROI.
Use `reasonCode`, `evidenceLink`, `followUpIssue`, and `reviewedBy` when recording follow-up events so waiver, override, and action quality can be interpreted later.
Runtime records include cost telemetry fields such as `model`, `inputTokens`, `outputTokens`, `cachedInputTokens`, and `totalTokens` when the provider returns usage data. Missing cost values are left empty rather than guessed.

Effectiveness reports are product artifacts. They should be generated in the language of the user request while preserving stable identifiers such as event types, JSON keys, modes, statuses, and file paths.
