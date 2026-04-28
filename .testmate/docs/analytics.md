# Local Analytics

TestMate may write local aggregate metrics to `.testmate/state/metrics.jsonl` during CLI/CI runs.

## Purpose

The analytics file helps evaluate whether v2 is reducing prompt size, latency, noisy routing, and retry rates.

## Stored Fields

Each line is a JSON object containing only aggregate metadata:

- timestamp;
- status;
- mode;
- analysis scope;
- risk level;
- change type;
- audit log path;
- changed file count;
- selected agent count;
- risk triggers;
- runtime milliseconds;
- model;
- prompt character count;
- response character count;
- retry count.

## Privacy Constraints

The analytics file must not contain:

- raw diff;
- raw prompt;
- model response content;
- secrets;
- PII;
- API payloads;
- user answers.

## Storage

`.testmate/state/` is ignored by Git and excluded from npm packages. Analytics are local operational data, not a policy source of truth.

## Summary Command

Show a local aggregate summary with:

```bash
node .testmate/testmate.mjs --show-metrics
```

The summary reports counts and averages only. It does not print raw diffs, prompts, responses, user answers, or secrets.

## Benchmark Command

Show benchmark measurements for fixed fixture scenarios with:

```bash
node .testmate/testmate.mjs --benchmark-fixtures
```

This command does not call the LLM. It measures deterministic preflight and prompt/diff slicing using repository fixtures.

Current benchmark fixtures:

- `docs-only`
- `runtime-package`
- `auth-guard`
- `api-mutation`
- `release-relocation`
- `mirrored-tests`

Per-fixture interpretation lives in `.testmate/benchmark-baselines.json` and `.testmate/docs/benchmark-baselines.md`.
