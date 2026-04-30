# Current Action Plan

This is an advisory product plan for the current TestMate stage. It is not a formal TestMate evaluation run and must not create audit logs.

## Product Decision

The first target user is an individual AI IDE user.

TestMate should therefore optimize first for:

- a copied policy kit that is easy to drop into a repository;
- clear prompts for Cursor, Codex, Claude Code, ChatGPT, and similar AI IDEs;
- a compact, stable rulebook;
- model-agnostic interpretation through a shared output contract;
- calibration fixtures that prevent drift without expanding the rulebook.

CI, blocking gates, telemetry export, and hosted collection remain important follow-on paths, but they should not dominate v1 onboarding.

## Do Now

1. DONE - Clarify in public docs that TestMate v1 is an AI IDE copied kit first and a CI adapter second.
2. DONE - Preserve the compact core policy. Do not add one-off rules for every scenario.
3. DONE - Add a fixture calibration model that explains how examples test existing rules.
4. DONE - Add a small set of realistic calibration fixtures after the fixture model is stable.
5. DONE - Keep CLI and replay tests passing after every policy/schema/docs change.

## Do Next

1. DONE - Create 3-5 polished AI IDE prompts:
   - current diff Tier 1 check;
   - risky form/auth/API change Tier 2 check;
   - bug fix regression coverage check;
   - "no noise" low-risk change check;
   - waiver/override review check.
2. DONE - Add a realistic fixture pack for high-value scenarios:
   - static copy should pass;
   - form submit missing invalid-state coverage should block;
   - auth guard missing denied-role coverage should block;
   - API mutation missing error-path coverage should block;
   - cache invalidation missing stale-data coverage should block or request info;
   - focused/skipped test should block.
3. DONE - Add a full CLI test with mocked OpenAI responses for:
   - valid `PASS`;
   - valid `BLOCK`;
   - valid `NEED_INFO`;
   - invalid JSON;
   - schema-invalid JSON.

## Next Candidate Work

1. Add an install/update story for the copied kit:
   - document manual copy boundaries;
   - decide whether an npm-based copier is worth building;
   - avoid hosted or enterprise assumptions.
2. Add adapter boundary documentation:
   - policy kit is model-agnostic;
   - OpenAI CLI is a reference adapter;
   - future adapters must preserve the shared contract.
3. Expand calibration only from evidence:
   - collect real AI IDE runs;
   - add fixtures for repeated false positives or missed risks;
   - avoid adding new core rules unless they pass `docs/fixture-calibration.md`.
4. Improve CLI adapter hardening:
   - test API failure/rate-limit handling;
   - document `TESTMATE_MOCK_OPENAI_RESPONSE` for maintainers;
   - keep invalid provider output as a failing gate result.

For deferred CLI, CI, and telemetry work, use `docs/cli-ci-telemetry-todo.md`. Keep that infrastructure TODO separate from the individual AI IDE copied-kit product focus.

## Defer

1. Hosted collector.
2. Enterprise telemetry daemon.
3. Team-level dashboards.
4. ROI claims.
5. CI artifact aggregation beyond a simple future-ready design.

## Product Guardrails

- Model compatibility is a v1 requirement for the policy kit, not necessarily for every CLI adapter.
- Fixtures are calibration evidence, not policy bloat.
- New rules require repeated evidence across scenarios.
- Blocking CI requires real calibration examples and team agreement.
- Local advisory work should not create audit logs.
- Effectiveness metrics should remain measured/estimated/inferred rather than a single score.
