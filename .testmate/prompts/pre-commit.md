# Prompt: Pre-Commit

Use `.testmate/AGENTS.md` and `.testmate/agents/web-testing-orchestrator.md`.

Tier: 1 (Targeted).
Mode: pre_commit.

Analyze staged changes.

Return:
- PASS/WARNING/BLOCK
- change type
- risk level
- affected areas
- missing tests
- minimal required action
- commands to run

Optimize for speed. Do not require full E2E unless a critical risk is present.
