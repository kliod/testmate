# Prompt: Pre-MR

Use `.testmate/AGENTS.md` and `.testmate/agents/web-testing-orchestrator.md`.

Tier: 2 (Integrity).
Mode: pre_mr.
Analysis Scope: DIFF.

Analyze diff against origin/main.

Run the logical subagents:
- Change Impact Analyst
- Test Strategy Agent
- Regression Auditor
- plus specialist agents required by the change

Return:
- structured JSON
- MR quality summary
- blockers
- missing coverage
- recommended tests
- manual QA
- residual risk

Block high-risk changes without meaningful coverage.
