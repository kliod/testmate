# Prompt: Tier 2 - Integrity (AFFECTED)

Use AGENTS.md and agents/web-testing-orchestrator.md.

Tier: 2 (Integrity).
Analysis Scope: AFFECTED.

Analyze:
1. Directly changed files.
2. Adjacent segments: Identify modules, components, or features that depend on or are affected by these changes.
3. Transitive risks.

Goal: Ensure that these changes do not break existing functionality elsewhere in the system.

Return:
- Structured JSON decisions.
- Impact Analysis Report (List of adjacent segments verified).
- Recommended integration tests.
