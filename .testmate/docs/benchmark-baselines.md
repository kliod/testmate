# Benchmark Baselines

TestMate benchmark fixtures are meant to answer a practical question: does a routing or slicing change keep the pipeline healthy for known scenario types?

The benchmark command is:

```bash
node .testmate/testmate.mjs --benchmark-fixtures
```

## How To Read It

- `diffReductionPercent` measures how much raw diff text was removed before prompt assembly.
- `promptReductionPercent` measures the actual prompt-size reduction after prompts, policy, and cards are included.
- `baseline.status` is the review signal for each fixture:
  - `OK`: current routing/slicing meets the fixture baseline.
  - `ATTENTION`: at least one expected routing or reduction check regressed.

Small diffs may legitimately show `0%` prompt reduction. That is not automatically a regression when the fixture baseline expects no slicing.

## Current Intent By Fixture

- `docs-only`: stay quiet; no slicing required; no specialist routing expected.
- `runtime-package`: slice large config/runtime diffs and keep core routing agents selected.
- `auth-guard`: keep auth/security routing and high risk classification.
- `api-mutation`: keep API/integration/cache routing and high risk classification.
- `release-relocation`: show strong slicing on large relocation-style diffs.
- `mirrored-tests`: keep related test discovery working across `tests/` and nested `__tests__/` layouts.

## Review Checklist

When benchmark output changes, review in this order:

1. Did any fixture move from `baseline.status = OK` to `ATTENTION`?
2. Did a high-risk fixture lose a required agent or drop below its minimum risk level?
3. Did a large diff fixture stop slicing?
4. Did `promptReductionPercent` materially drop for `runtime-package` or `release-relocation`?
5. If a change is intentional, update `.testmate/benchmark-baselines.json` and explain why in the working plan or audit report.

## Why The Average Prompt Reduction Is Still Modest

Prompt reduction is currently dominated by fixed prompt/policy overhead on small fixtures. The benchmark layer is still useful because it tells us whether large-diff slicing regressed and whether routing stayed relevant.
