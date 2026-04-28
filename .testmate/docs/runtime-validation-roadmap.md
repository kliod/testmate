# Runtime Validation And Versioning Roadmap

This document tracks the work needed to make the structured TestMate contract enforceable and auditable.

## Current State

- `.testmate/ai-quality-output.schema.json` defines the intended output contract.
- `.testmate/testmate.mjs` performs a lightweight manual required-field validation.
- Runner retries once when parsing/validation fails.
- Audit logs contain decision factors and preflight data, but not prompt/policy hashes.

## Target State

- The schema is the runtime source of truth.
- Invalid model output fails validation with an actionable retry prompt.
- Audit logs record enough version metadata to reproduce decision context.
- Metrics make compact payload improvements measurable.

## P0: Enforce The Contract

Implementation options:

- add a small dependency such as `ajv` and validate against `.testmate/ai-quality-output.schema.json`;
- or keep zero dependencies and expand the internal validator to cover enums, arrays, interaction shape, decision factors, and finding shape.

Required tests:

- valid `PASS` output is accepted;
- valid `NEED_INFO` output is accepted;
- missing required field is rejected;
- invalid enum is rejected;
- invalid `interaction.answersExpected` shape is rejected.

## P1: Add Version Metadata

Add hashes for:

- `.testmate/AGENTS.md`;
- `.testmate/policy-summary.json`;
- `.testmate/agent-cards.json`;
- selected tier prompt;
- `.testmate/agents/web-testing-orchestrator.md`;
- git diff.

Suggested output shape:

```json
{
  "metrics": {
    "runtimeMs": 1200,
    "selectedAgents": 3,
    "changedFiles": 5,
    "model": "gpt-4o",
    "promptChars": 42000,
    "responseChars": 6000,
    "retryCount": 0
  },
  "versioning": {
    "policyHash": "sha256:...",
    "agentCardsHash": "sha256:...",
    "tierPromptHash": "sha256:...",
    "orchestratorHash": "sha256:...",
    "diffHash": "sha256:..."
  }
}
```

If `versioning` is added to the output contract, update `.testmate/ai-quality-output.schema.json` and smoke tests in the same change.

## P2: Metrics For Economics

Start with deterministic approximations:

- `promptChars`;
- `responseChars`;
- `selectedAgents`;
- `changedFiles`;
- `retryCount`;
- `runtimeMs`;
- `model`.

Later, add provider-reported tokens if the API response exposes usage data.
