# Prompt: Tier 1 - Targeted (DIFF)

Use `.testmate/AGENTS.md` and `.testmate/agents/web-testing-orchestrator.md`.

Tier: 1 (Targeted).
Analysis Scope: DIFF.

## State Protocol

Treat the preflight summary as the starting state, not as background prose.

Trust preflight when `preflightConfidence >= 0.7` unless concrete diff evidence contradicts it.
Do not rediscover stack, scripts, changed files, candidate agents, or skipped agents when preflight already supplies them.
If you override preflight routing or risk, explain the exact diff evidence.

## Scope

Analyze only directly changed files and directly changed tests.
Do not expand into transitive dependency analysis unless a direct change is HIGH/CRITICAL or the affected area cannot be inferred.

## Budget

- Token budget: small.
- Findings budget: maximum 3 material findings.
- Recommended tests budget: maximum 3 commands or tests.
- Prefer `PASS` with concise evidence when no real risk exists.

## Escalation Gates

Escalate beyond direct files only when:

- `deterministicBlockers` is non-empty;
- risk level is HIGH or CRITICAL;
- tests are deleted, skipped, focused, or weakened;
- auth, permissions, mutation, form submit, file upload, route guard, cache, or critical journey behavior changed;
- direct evidence contradicts preflight.

## Stop Conditions

Return `PASS` and stop when:

- the change is documentation-only, style-only, or package metadata with no behavior risk;
- required direct checks pass or are not applicable;
- no blocking rule is triggered;
- no actionable missing coverage exists.

Return `NEED_INFO` only when a missing fact blocks a high-impact decision. Ask at most 3 questions.

## Confidence Gates

- `PASS`: confidence >= 0.75 and no blocking high-risk coverage gap.
- `WARNING`: confidence >= 0.6, residual risk documented, no unresolved auth/security/mutation/critical-journey gap.
- `BLOCK`: any blocking rule triggers, or HIGH/CRITICAL impact has `coverageGap = BLOCKING`.
- `NEED_INFO`: only for missing information that directly blocks a high-impact decision.

## Return

- Structured JSON decision.
- Short answer to: "Is this change correct in isolation?"
- Direct-file coverage evidence.
- Minimal commands/tests only.
