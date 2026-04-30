# AI IDE Prompt Pack

These prompts are for individual developers using TestMate as a copied AI IDE policy kit.

They are advisory prompts. They should not create files in `logs/` and should not use the formal TestMate JSON Output Contract unless the user explicitly asks for a formal `pre_commit`, `pre_mr`, `pre_merge`, or `pre_release` quality gate.

## 1. Current Diff Tier 1 Check

```text
Run a TestMate Tier 1 advisory check for my current diff.

Use AGENTS.md as the policy source.
Identify the tech stack and test runner before suggesting commands.
Analyze only directly changed files.
Return PASS if there are no real risks.

Focus on:
- bug fixes without regression coverage;
- focused or skipped tests;
- high-risk behavior in the changed files;
- the lowest reliable test layer.

Do not create audit logs.
Return a concise summary with:
- status: PASS, WARNING, BLOCK, or NEED_INFO;
- affected areas;
- missing coverage;
- recommended tests;
- exact commands to run.
```

## 2. Risky Form/Auth/API Tier 2 Check

```text
Run a TestMate Tier 2 advisory check for this change.

Use AGENTS.md, docs/fixture-calibration.md, and the existing tests as context.
Treat forms with submit, auth/permissions, route guards, API mutations, cache invalidation, and file upload as high risk.
Use existing compact policy rules. Do not invent new rules.

Check:
- changed files;
- adjacent tests;
- likely affected behavior;
- required success, error, denied, validation, or stale-data coverage;
- whether missing context should be NEED_INFO.

Do not create audit logs.
Return:
- status;
- risk level;
- evidence vs inference;
- required coverage;
- existing coverage;
- missing coverage;
- minimal tests to add;
- commands to verify.
```

## 3. Bug Fix Regression Coverage Check

```text
Run a TestMate advisory regression check for this bug fix.

Use AGENTS.md as the policy source.
Every bug fix requires a regression test or a documented waiver.

Determine:
- what behavior was broken;
- what regression would prove it stays fixed;
- whether existing tests already cover the bug;
- whether a waiver is present and valid.

Do not create audit logs.
Return PASS only if regression coverage or a valid waiver exists.
If coverage is missing, use the PRESENT format:
- What
- Why
- Impact
- Measurement
```

## 4. Low-Risk No-Noise Check

```text
Run a TestMate Tier 1 advisory check, optimized for no noise.

Use AGENTS.md as the policy source.
If this is static copy, documentation, comments, or non-interactive style-only change with no behavior risk, return PASS and stop.

Do not create audit logs.
Do not recommend tests just to have tests.
Do not speculate about unrelated areas.

Only report actionable risks grounded in changed files.
```

## 5. Waiver And Override Review

```text
Review this TestMate waiver or override.

Use AGENTS.md and docs/team-pilot-guide.md as policy sources.

Check whether the waiver or override includes:
- reason;
- risk level;
- approver;
- expiry or follow-up;
- issue or evidence link when appropriate;
- residual risk.

Do not erase the risk.
Do not convert a real risk to PASS just because a waiver exists.
Prefer WARNING with documented accepted risk unless policy says otherwise.

Return:
- valid or invalid;
- missing fields;
- residual risk;
- recommended follow-up.
```

