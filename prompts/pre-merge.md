# Prompt: Pre-Merge

Use AGENTS.md and agents/web-testing-orchestrator.md.

Tier: 2 (Integrity).
Mode: pre_merge.
Analysis Scope: AFFECTED.

Analyze:
1. The branch diff against origin/main.
2. Temporal drift: Identify what has changed in origin/main since this branch was created.

Goal: Ensure that the combination of your changes and recent changes in main does not create a regression or integration failure.

Run the logical subagents:
- Change Impact Analyst (include transitive impacts)
- Test Strategy Agent
- Regression Auditor
- plus specialist agents required by the change

Return:
- structured JSON
- Merge readiness decision
- Temporal drift risk assessment
- Transitive affected areas verified
- blockers
- recommended tests
- manual QA

Block if the drift from main introduces unverified risks or if transitive impacts lack coverage.
