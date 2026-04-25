# Prompt: Tier 1 - Targeted (DIFF)

Use AGENTS.md and agents/web-testing-orchestrator.md.

Tier: 1 (Targeted).
Analysis Scope: DIFF.

Analyze ONLY the directly changed files in the current diff.

Goal: Fast, focused verification of the immediate changes.

Return:
- Structured JSON decisions.
- Human summary of "Is this change correct in isolation?".
- Minimal required tests for these specific files.
