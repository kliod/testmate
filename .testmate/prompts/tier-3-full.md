# Prompt: Tier 3 - Stability (FULL)

Use `.testmate/AGENTS.md` and `.testmate/agents/web-testing-orchestrator.md`.

Tier: 3 (Stability).
Analysis Scope: FULL.

## State Protocol

Treat the preflight summary as release state, not as background prose.

Trust preflight when `preflightConfidence >= 0.7` unless concrete release evidence contradicts it.
Use `riskTriggers`, `candidateAgents`, `skippedAgents`, `relatedTests`, `decisionFactors`, package scripts, and CI config as the release-readiness baseline.
If release-critical routing is missing, explain the exact file, journey, config, or evidence.

## Scope

Analyze:

1. All changes in this release/branch.
2. Critical user journeys or package/runtime journeys.
3. System-wide regressions that can be inferred from changed files, scripts, CI, tests, docs, and package contents.
4. Whether preflight selected the correct release-critical agents.

Do not produce exhaustive prose. Leadership should understand the decision in under one minute.

## Budget

- Token budget: medium, leadership-oriented.
- Findings budget: maximum 7 material findings.
- Recommended tests budget: maximum 7 commands or tests.
- Manual QA budget: only high-risk or release-critical areas.

## Escalation Gates

Escalate when:

- release packaging, CI, auth, permissions, mutation, cache, routing, file upload, or critical journey behavior changed;
- required checks fail or are missing;
- release artifacts omit runtime files or include local state/secrets;
- preflight confidence is below 0.7;
- HIGH/CRITICAL risk lacks meaningful automated coverage.

## Stop Conditions

Return `PASS` and stop when:

- required release checks pass;
- package/runtime artifacts are present;
- local state and audit logs are excluded from package output;
- release-critical routes/agents are covered or safely skipped;
- residual risks are documented and non-blocking.

Return `BLOCK` for failed required checks, missing runtime package contents, unverified critical journeys, or blocking high-risk coverage gaps.
Return `NEED_INFO` only when release readiness depends on missing external context.

## Confidence Gates

- `PASS`: confidence >= 0.75 and no blocking high-risk coverage gap.
- `WARNING`: confidence >= 0.6, explicit residual risk, no unresolved auth/security/mutation/critical-journey gap.
- `BLOCK`: any blocking rule triggers, or HIGH/CRITICAL impact has `coverageGap = BLOCKING`.
- `NEED_INFO`: maximum 3 questions, each tied to `interaction.blockedDecision`.

## Return

- Structured JSON decision.
- Final release readiness decision.
- Regression sweep report.
- Critical path verification status.
- Manual QA checklist only for high-risk areas.
