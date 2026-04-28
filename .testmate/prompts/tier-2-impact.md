# Prompt: Tier 2 - Integrity (AFFECTED)

Use `.testmate/AGENTS.md` and `.testmate/agents/web-testing-orchestrator.md`.

Tier: 2 (Integrity).
Analysis Scope: AFFECTED.

## State Protocol

Treat the preflight summary as the starting state, not as background prose.

Trust preflight when `preflightConfidence >= 0.7` unless concrete diff evidence contradicts it.
Use `relatedTests`, `riskTriggers`, `candidateAgents`, `skippedAgents`, and `decisionFactors` as routing state.
If you expand or shrink routing, explain the exact adjacent file, import, script, or diff evidence.

## Scope

Analyze:

1. Directly changed files.
2. Adjacent modules, components, configs, tests, or CI paths affected by those changes.
3. Transitive behavior only where there is concrete evidence.
4. Whether skipped agents are still safely skipped.

Do not turn Tier 2 into release-wide prose.

## Budget

- Token budget: medium.
- Findings budget: maximum 5 material findings.
- Recommended tests budget: maximum 5 commands or tests.
- Prioritize adjacency and integration risk over restating the diff.

## Escalation Gates

Escalate only when:

- preflight confidence is below 0.7;
- adjacency shows a HIGH/CRITICAL path not selected by preflight;
- API, auth, permission, cache, routing, form submit, file upload, or CI behavior is affected;
- related tests are missing for a non-trivial affected area;
- deleted/skipped/focused tests or deterministic blockers are present.

## Stop Conditions

Return `PASS` and stop when:

- preflight route is adequate;
- affected areas are known;
- related tests/checks pass or are not applicable;
- skipped agents have clear reasons;
- no actionable missing coverage remains.

Return `WARNING` only for non-critical residual risk with manual QA or follow-up.
Return `NEED_INFO` only when a missing fact blocks a high-impact affected-area decision.

## Confidence Gates

- `PASS`: confidence >= 0.75 and no blocking high-risk coverage gap.
- `WARNING`: confidence >= 0.6, explicit residual risk, no unresolved auth/security/mutation/critical-journey gap.
- `BLOCK`: any blocking rule triggers, or HIGH/CRITICAL impact has `coverageGap = BLOCKING`.
- `NEED_INFO`: maximum 3 questions, each tied to `interaction.blockedDecision`.

## Return

- Structured JSON decision.
- Impact analysis report listing adjacent segments actually verified.
- Existing coverage vs missing coverage.
- Smallest reliable integration or affected-area test set.
