# Web Testing Orchestrator Kit

Minimal public package for AI-assisted web testing in AI IDEs.

Goal: give Cursor, Claude Code, Codex, and similar AI IDEs a compact operating model for testing web apps before commit, pull request, merge, and release.

The agent does not merely generate tests. It makes a quality decision:

- `PASS` - safe to continue
- `WARNING` - acceptable with documented risk
- `BLOCK` - must fix before moving forward
- `NEED_INFO` - cannot safely decide without a focused clarification loop

## Contents

```txt
.testmate/                        All TestMate logic and prompts
  AGENTS.md                       Core project policy for AI IDEs
  agents/                         Specialist agent prompts
  prompts/                        Mode-specific prompts
  docs/                           Compact policy docs
  testmate.mjs                    Core orchestrator script
  github/                         GitHub Actions + PR template
  gitlab-ci.yml                   GitLab CI config
  cursor-rules/                   Cursor-ready rules
  examples/                       Example scripts
```

## Dual Workflow Architecture

TestMate operates on two distinct planes to provide safety without slowing down local development.

### 1. Local Workflow (AI IDE Native)

Best for: interactive development and auto-remediation.

If you use Cursor, Claude Code, Codex, or similar tools, your IDE reads `.testmate/AGENTS.md` and the specialist prompts in `.testmate/agents/`.

Workflow:

1. Write your code.
2. Open IDE chat.
3. Ask for the required tier check, for example: `Run Tier 2 using .testmate/AGENTS.md rules.`

LLM chat execution rule:

When working inside an AI IDE or LLM chat, do not launch the Node.js runner. The chat agent should execute TestMate natively:

1. read `.testmate/AGENTS.md`;
2. read the requested tier prompt, for example `.testmate/prompts/tier-3-full.md`;
3. inspect the repository, changed files, scripts, tests, and relevant docs directly;
4. run only the concrete project commands needed to verify the decision;
5. return the TestMate decision and create the required audit log.

In chat-native mode, the LLM already is the orchestrator.

### 2. CI/CD Workflow (Server CLI)

Best for: rigid quality gates and pull request validation.

Servers use `.testmate/testmate.mjs`.

Workflow:

```bash
node .testmate/testmate.mjs tier-2-impact
```

> [!WARNING]
> The CLI workflow is still a transitional interface. It is usable today, including resumable `NEED_INFO` via saved state and `answers-file`, but the long-term primary experience is intended to be IDE/chat-native.

## Installation And Setup

1. Clone the repo into your project or add it as a submodule.
2. Ensure `OPENAI_API_KEY` is available in the environment for CLI/CI use.
3. Optionally set `AI_MODEL` to override the default runner model.
4. Run locally:

   ```bash
   npm install
   node .testmate/testmate.mjs tier-1-targeted
   ```

If TestMate pauses with `NEED_INFO`, it will save a resume state and generate an answers template under `.testmate/state/`, then print the exact resume command to run next.

## `NEED_INFO` Behavior

`NEED_INFO` is a first-class status, not an error fallback.

- In chat-native mode, the assistant should ask up to three sharp questions and continue after the user answers, without switching to the CLI runner.
- In CLI/CI mode, the runner persists resume state so the same analysis can continue without a cold restart.

Related docs:

- `.testmate/docs/chat-native-resume.md`
- `.testmate/docs/waiver-policy.md`

## CI/CD Integration

- GitHub: copy the template from `.testmate/github/workflows` into your root `.github/workflows`.
- GitLab: copy the template from `.testmate/gitlab-ci.yml` into your root `.gitlab-ci.yml`.
- Ensure `OPENAI_API_KEY` is configured in CI variables.

## Project Documents

- `WORKING_V2_PLAN.md` tracks the current v2 implementation state.
- `AUDIT_REPORT.md` tracks current unresolved findings and residual technical notes.
- `RELEASE_CHECKLIST.md` lists the commands and package-content checks required before publishing or merging a TestMate release.
- `V2_NEXT_WORK_PLAN.md` is the archived execution plan for the v2 implementation work that has already been completed.
- `PIPELINE_IMPROVEMENT_REPORT.md` captures strategic background and historical rationale behind the v2 architecture.
- `.testmate/docs/runtime-validation-roadmap.md` tracks runtime validation and contract evolution.
- `.testmate/docs/chat-native-resume.md` defines how chat agents pause and continue `NEED_INFO` checks without invoking the CLI runner.
- `.testmate/docs/analytics.md` documents local aggregate metrics written by CLI/CI runs.

## Prime Rules

- Every non-trivial change requires test impact analysis.
- Every bug fix requires a regression test or documented waiver.
- Every high-risk change requires meaningful automated coverage.
- Test user behavior, not implementation details.
- Use the lowest reliable test layer.
- Do not create flaky tests.
