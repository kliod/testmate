# Prompt: Pre-Release

Use `.testmate/AGENTS.md` and `.testmate/agents/web-testing-orchestrator.md`.

Tier: 3 (Stability).
Mode: pre_release.
Analysis Scope: FULL.

Analyze all changes included in the release.

Return:
- release readiness decision
- critical paths to test
- recently fixed bugs requiring regression verification
- visual/a11y checks required
- manual QA checklist
- residual risks
- rollback considerations

Block critical user journeys that are impacted and unverified.
