# TestMate Agent Work Telemetry Architecture

## Executive Summary

- Team-level TestMate telemetry should use normalized `agent_work_run` records as the reporting source, not raw local developer files.
- Local developer data is private source material; CI artifacts are reproducible team evidence; collector and aggregator outputs are the actual reporting layer.
- Data enters team metrics only through explicit export, CI artifact publication, or policy-governed upload.
- Every metric must preserve its source and confidence label: measured, estimated, user-reported, inferred, or unavailable.
- TestMate should report evidence-aware quality work, not fake ROI, developer surveillance, or token accounting dressed up as business value.

## Core Recommendation

Use a staged hybrid architecture. In v1, keep developer-local append-only records and publish formal CI gate artifacts. Add a scheduled or manual aggregator that validates, deduplicates, and rolls those records into sanitized reports. In v2, add a lightweight collector API for authenticated batch upload. In enterprise, add tenant-scoped storage, retention controls, admin policy, IDE integrations, and dashboard/reporting layers. The architecture should treat local records, CI artifacts, normalized event storage, rollups, and published reports as separate layers with different trust and privacy properties.

## Why Runtime Token Tracking Is Not Enough

Token usage only answers one narrow question: how much model input/output was visible to a specific runtime. It does not tell the team whether TestMate prevented a regression, whether a warning was valid, whether a high-risk change had meaningful coverage, whether a test was added after a finding, or whether the data came from a provider, a tool, a user, or an estimate.

TestMate work can happen in CLI, CI, ChatGPT, Codex, Cursor, other AI IDEs, local models, and manual follow-up. Some surfaces expose provider-reported usage. Some expose only duration. Some expose nothing useful. The telemetry system must therefore model work, evidence, risk, outcomes, and visibility separately.

## Execution Surface Taxonomy

| Surface | What Can Be Measured | What Is Estimated | What May Be Unavailable | Recommended Handling |
| --- | --- | --- | --- | --- |
| `cli_api` | Run ID, mode, scope, duration, decision, risk, rules, model, provider usage | Model cost via pricing table, human supervision | Actual invoice cost, post-run human effort | Emit structured `agent_work_run` automatically. |
| `github_actions` | CI duration, PR metadata, formal decision, artifacts, exit status | Allocated CI cost, model cost when routed through CLI | Human time, provider usage if hidden | Publish workflow artifacts; optionally upload to collector. |
| `gitlab_ci` | Pipeline/job duration, MR metadata, formal decision, artifacts, exit status | Allocated CI cost, model cost | Human time, hidden provider usage | Publish job artifacts; optionally upload to collector. |
| `chatgpt_ui` | Manual summary, surface, outcome, follow-up link | Human time bucket, perceived risk | Tokens, actual compute cost, raw session metadata | Manual record only; never infer exact usage. |
| `codex_desktop` | Tool-reported summary if available, duration if platform-visible | Human supervision, cost if billing unavailable | Raw token usage, actual platform cost, prompts | Manual or opt-in integration; label confidence. |
| `cursor` | Plugin-reported session metadata if integrated | Credits, cost, accepted work time | Exact provider usage, hidden IDE pricing | Plugin later; manual entry in v1. |
| `claude_code` | CLI/session duration, tool calls if wrapped | Tokens/cost when not provider-reported | Actual billing, prompts | Wrapper/export integration; mark source. |
| `ai_ide_other` | Manual surface and outcome | Duration, cost, risk | Tokens, model, exact workflow | Generic advisory record with low confidence. |
| `local_model` | Wall time, runtime, model name, hardware class | Energy/hardware allocation, token estimates | Actual cost, reliable token count | Report runtime/hardware separately; avoid default dollarization. |
| `local_openai_compatible` | Endpoint duration, model string, maybe usage | Provider identity, cost table | Actual billing if endpoint masks provider | Store as compatible endpoint unless configured otherwise. |
| `manual_entry` | User-reported workflow, outcome, follow-up | Risk, duration, impact | Tokens, compute, exact metadata | Accept with `user_reported` label. |
| `unknown` | Timestamp and safe known fields | Almost everything | Surface, provider, tokens, cost, duration | Accept only if useful; disclose unknown rate. |

## Proposed Architecture

### Phase 1: Local Records + CI Artifact Aggregation

Phase 1 should work without a central server.

Local files remain private and gitignored:

```text
.testmate/state/agent_work.jsonl
.testmate/state/metrics.jsonl
.testmate/state/effectiveness.jsonl
.testmate/state/telemetry-upload-state.json
```

Formal CI gates export artifacts:

```text
.testmate/export/testmate-agent-work.ndjson
.testmate/export/testmate-rollup.json
logs/
```

A scheduled aggregation job or manual script downloads CI artifacts, optionally accepts explicit local exports, validates records, deduplicates by `runId`, and produces sanitized weekly/monthly reports.

### Phase 2: Central Telemetry Collector

Phase 2 adds an authenticated collector endpoint:

```text
POST /v1/telemetry/batches
```

The collector accepts batches from CI, CLI, and future IDE plugins. It validates schema, enforces privacy rules, deduplicates by `exportId` and `runId`, stores normalized records, and returns an ingestion result.

### Phase 3: Enterprise Telemetry Platform

Enterprise readiness requires tenant-scoped storage, SSO/OIDC/SAML, scoped API tokens, retention policies, admin telemetry modes, export/delete controls, GitHub/GitLab integrations, IDE integrations, provider cost configuration, and leadership reporting.

## Unified Agent Work Schema

```json
{
  "recordType": "agent_work_run",
  "schemaVersion": 1,
  "runId": "string",
  "parentRunId": "string | null",
  "timestamp": "ISO-8601",
  "teamId": "string | null",
  "repoId": "string | null",
  "projectId": "string | null",
  "actorHash": "string | null",
  "executionSurface": "cli_api | github_actions | gitlab_ci | chatgpt_ui | codex_desktop | cursor | claude_code | ai_ide_other | local_model | local_openai_compatible | manual_entry | unknown",
  "workflowType": "formal_gate | local_advisory | fixture_replay | follow_up_recording | manual_review",
  "mode": "pre_commit | pre_mr | pre_merge | pre_release | advisory | unknown",
  "analysisScope": "DIFF | AFFECTED | FULL | unknown",
  "decisionStatus": "PASS | WARNING | BLOCK | NEED_INFO | not_applicable",
  "riskLevel": "LOW | MEDIUM | HIGH | CRITICAL | unknown",
  "policyRulesTriggered": [],
  "modelProvider": "openai | anthropic | google | ollama | llama_cpp | lmstudio | vllm | local_openai_compatible | unknown",
  "model": "string | null",
  "isLocalModel": false,
  "inputTokens": null,
  "outputTokens": null,
  "cachedInputTokens": null,
  "totalTokens": null,
  "tokenSource": "provider_reported | tokenizer_estimated | user_reported | unavailable",
  "usageVisibility": "provider_reported | tool_reported | user_reported | estimated | unavailable",
  "durationMs": null,
  "toolCallsCount": null,
  "ciProvider": "github_actions | gitlab_ci | local | unknown",
  "ciDurationMs": null,
  "hardwareClass": "developer_laptop | ci_runner | gpu_workstation | cloud_runner | unknown",
  "computeCostUsd": null,
  "computeCostType": "actual | estimated | allocated | unavailable",
  "humanSupervisionMinutes": null,
  "humanTimeSource": "user_reported | reviewer_sample | estimated | unavailable",
  "privacyMode": "local_only | ci_aggregated | centralized | manual_export",
  "rawPromptStored": false,
  "rawDiffStored": false,
  "customerPayloadStored": false,
  "auditLogPath": "string | null",
  "toolErrorsCount": 0,
  "notes": "string | null"
}
```

Required fields are the identity, timestamp, surface, workflow, privacy, and visibility fields. Formal gates also require mode, scope, decision, risk, policy rules, and audit log reference when applicable. Token, cost, duration, hardware, and human time fields are nullable and must remain null when unavailable.

## Telemetry Storage Layers

| Layer | Contents | Storage | Forwarded? | Purpose |
| --- | --- | --- | --- | --- |
| Local safe event buffer | Individual safe `agent_work_run` records | `.testmate/state/*.jsonl` | Only via explicit export or policy upload | Local history and export source. |
| Export batch | Sanitized records with batch metadata | `.testmate/export/*.ndjson` or JSON | Yes | Transport unit. |
| CI artifact storage | CI-generated events, rollups, logs | GitHub/GitLab artifact storage | Yes | Reproducible team evidence. |
| Normalized event store | Validated deduplicated records | Collector DB/object storage | Internal | Reporting source. |
| Rollups | Counts and distributions by period/repo/surface | DB/object storage/generated JSON | Yes | Fast reporting. |
| Published reports | Sanitized Markdown/JSON/HTML | `docs/reports/`, artifacts, dashboard | Yes | Human-facing history. |

Local `.testmate/state/*.jsonl` files are not the team source of truth. They are private source material. The team source of truth begins after export/upload, validation, and deduplication.

## Local Developer Telemetry Buffer

Local buffer files should remain gitignored by default:

```text
.testmate/state/agent_work.jsonl
.testmate/state/metrics.jsonl
.testmate/state/effectiveness.jsonl
.testmate/state/telemetry-upload-state.json
```

Rules:

- Append-only where possible.
- No raw prompts.
- No raw diffs.
- No file contents.
- No secrets.
- No customer payloads.
- No automatic team inclusion while `privacyMode` is `local_only`.

## Safe Export Flow

Local data enters the team telemetry pipeline only through a safe export or policy-governed upload.

```text
local state
  -> select eligible records
  -> schema validation
  -> privacy validation
  -> source classification
  -> batch creation
  -> local file or collector upload
```

Example commands:

```bash
testmate telemetry export --out .testmate/export/testmate-agent-work.ndjson
testmate telemetry upload --input .testmate/export/testmate-agent-work.ndjson
```

Before manual export, TestMate should show a preview:

```text
Ready to export:
- records: 14
- prompts: 0
- raw diffs: 0
- customer payloads: 0
- unavailable usage: 9
```

Records that fail privacy validation must be skipped and reported locally.

## CI Artifact Publishing

CI artifact publishing means storing generated files in the CI provider's artifact storage. It does not mean committing files to git and does not mean uploading to TestMate Cloud by default.

For GitHub Actions:

```yaml
- name: TestMate Tier 2 (Integrity)
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    node scripts/testmate.mjs pre_mr
    node scripts/testmate.mjs --export-telemetry --out .testmate/export/testmate-agent-work.ndjson
    node scripts/testmate.mjs --rollup-telemetry --out .testmate/export/testmate-rollup.json

- name: Upload TestMate telemetry artifact
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: testmate-telemetry-${{ github.run_id }}-${{ github.run_attempt }}
    path: |
      .testmate/export/testmate-agent-work.ndjson
      .testmate/export/testmate-rollup.json
      logs/
    retention-days: 30
```

For GitLab CI:

```yaml
testmate-quality-gate:
  stage: quality
  image: node:20-slim
  script:
    - node scripts/testmate.mjs pre_mr
    - node scripts/testmate.mjs --export-telemetry --out .testmate/export/testmate-agent-work.ndjson
    - node scripts/testmate.mjs --rollup-telemetry --out .testmate/export/testmate-rollup.json
  artifacts:
    when: always
    paths:
      - .testmate/export/testmate-agent-work.ndjson
      - .testmate/export/testmate-rollup.json
      - logs/
    expire_in: 30 days
```

CI artifact storage is a temporary technical evidence store. Long-term team metrics require either scheduled aggregation into sanitized reports or a collector/database.

## Collector vs Aggregator

Collector and aggregator are separate roles.

The collector receives telemetry batches:

```text
POST /v1/telemetry/batches
```

It authenticates, validates schema, enforces privacy rules, deduplicates, persists accepted records, and returns an ingestion result.

The aggregator computes metrics:

```text
normalized events
  -> daily/weekly rollups
  -> reports
  -> dashboards
```

In v1, TestMate can skip the collector and run an aggregator over GitLab/GitHub artifacts plus manual exports:

```text
GitLab artifacts + manual exports
  -> scheduled aggregation job
  -> weekly report
```

## Batch Format

Telemetry should move as versioned batches, not arbitrary JSON files.

```json
{
  "batchType": "testmate_telemetry_export",
  "schemaVersion": 1,
  "exportId": "01HVEXPORT...",
  "createdAt": "2026-04-29T15:00:00Z",
  "teamId": "team_123",
  "repoId": "testmate",
  "privacyMode": "manual_export",
  "recordsCount": 1,
  "records": [
    {
      "recordType": "agent_work_run",
      "schemaVersion": 1,
      "runId": "01HVRUN...",
      "timestamp": "2026-04-29T14:30:00Z",
      "executionSurface": "cli_api",
      "workflowType": "formal_gate",
      "mode": "pre_mr",
      "analysisScope": "AFFECTED",
      "decisionStatus": "WARNING",
      "riskLevel": "HIGH",
      "usageVisibility": "provider_reported",
      "privacyMode": "ci_aggregated",
      "rawPromptStored": false,
      "rawDiffStored": false,
      "customerPayloadStored": false
    }
  ]
}
```

`exportId` is the idempotency key for the batch. `runId` is the deduplication key for individual records.

## Rollup Format

Rollups are derived aggregates. They are safer to publish because they do not contain individual working history.

```json
{
  "recordType": "agent_work_rollup",
  "schemaVersion": 1,
  "rollupId": "team_123:testmate:2026-W18",
  "period": {
    "type": "week",
    "start": "2026-04-27",
    "end": "2026-05-03"
  },
  "teamId": "team_123",
  "repoId": "testmate",
  "runsTotal": 42,
  "byWorkflowType": {
    "formal_gate": 18,
    "local_advisory": 16,
    "follow_up_recording": 8
  },
  "byExecutionSurface": {
    "gitlab_ci": 12,
    "cli_api": 6,
    "codex_desktop": 10,
    "chatgpt_ui": 4,
    "cursor": 2,
    "manual_entry": 8
  },
  "byDecisionStatus": {
    "PASS": 21,
    "WARNING": 11,
    "BLOCK": 4,
    "NEED_INFO": 2,
    "not_applicable": 4
  },
  "usageVisibility": {
    "provider_reported": 12,
    "tool_reported": 6,
    "user_reported": 14,
    "estimated": 3,
    "unavailable": 7
  },
  "costTotalsUsd": {
    "actual": 18.42,
    "estimated": 6.1,
    "allocated": null,
    "unavailableRuns": 20
  },
  "followUp": {
    "testsAdded": 7,
    "issuesOpened": 5,
    "waiversAccepted": 2,
    "overridesRecorded": 1,
    "noActionRecorded": 3
  },
  "dataQuality": {
    "recordsWithEvidenceLink": 19,
    "recordsWithReasonCode": 24,
    "recordsWithReviewedBy": 11,
    "unknownUsageRate": 0.1667
  }
}
```

Actual, estimated, allocated, and unavailable values must remain separate.

## Policy-Governed Telemetry Daemon

The daemon is a policy-governed uploader for safe TestMate telemetry, not an activity monitor.

It should read only TestMate's local safe buffer:

```text
.testmate/state/agent_work.jsonl
.testmate/state/metrics.jsonl
.testmate/state/effectiveness.jsonl
.testmate/state/telemetry-upload-state.json
```

Daemon cycle:

```text
wake up
  -> acquire lock
  -> read safe local records
  -> select non-exported runIds
  -> apply policy
  -> privacy validation
  -> create batch
  -> upload
  -> wait for ack
  -> mark accepted runIds as exported
  -> retry failed records with backoff
```

The daemon must not scan IDE history, chat transcripts, raw git diffs, prompts, file contents, or arbitrary project files.

Example policy:

```json
{
  "telemetry": {
    "mode": "auto_upload",
    "collectorUrl": "https://telemetry.company.dev",
    "autoUpload": {
      "enabled": true,
      "allowedWorkflows": ["formal_gate", "fixture_replay", "follow_up_recording"],
      "requireConsentForAdvisory": true,
      "allowedSurfaces": ["cli_api", "gitlab_ci", "github_actions"],
      "denySurfaces": ["chatgpt_ui", "codex_desktop", "cursor"],
      "maxBatchSize": 100,
      "intervalMinutes": 60
    }
  }
}
```

Ack must happen before local exported state is updated. Retries are safe because the collector deduplicates by `exportId` and `runId`.

## Auto-Upload Policy

| Data Source | Auto Export | Auto Upload | Default |
| --- | --- | --- | --- |
| GitLab/GitHub CI gate | Yes | Yes, if collector is configured | Allowed |
| Local CLI formal gate | Yes | Opt-in | Cautious |
| Fixture replay | Yes | Opt-in or CI-only | Allowed |
| Follow-up record | Yes | Opt-in | Cautious |
| ChatGPT/Codex/Cursor advisory | No | Explicit consent only | Manual |
| Raw local state | No | Never | Forbidden |

## End-To-End Pipeline

```text
Developer local work
  -> local safe event buffer
  -> export/upload if policy allows

GitLab/GitHub CI formal gate
  -> CI artifacts
  -> optional collector upload

Collector/Aggregator
  -> schema validation
  -> privacy validation
  -> dedupe by runId/exportId
  -> classify by surface/source
  -> join with follow-up outcomes
  -> build rollups
  -> publish reports
```

The team-level reporting view is built only from validated, deduplicated, source-labeled records.

## Aggregation Rules

1. Validate before ingest.
2. Run privacy checks before upload.
3. Deduplicate records by `runId`.
4. Treat `exportId` as batch idempotency key.
5. Retries must not inflate metrics.
6. Link reruns through `parentRunId` or attempt metadata.
7. Never collapse actual, estimated, allocated, and unavailable cost into one unlabeled total.
8. Keep advisory and formal gate metrics separable.
9. Exclude `local_only` records from team metrics.
10. Commit only sanitized rollups/reports, never individual event streams.

## Privacy And Governance

Required controls:

- No raw prompts.
- No raw diffs.
- No secrets.
- No customer payloads.
- No full file contents.
- No unapproved developer surveillance.
- Pseudonymize actor identifiers with team-controlled salt.
- Support `local_only`, `manual_export`, `ci_aggregated`, and `centralized` modes.
- Separate formal audit logs from aggregate telemetry.
- Support retention, export, and deletion controls.
- Make telemetry disablement explicit.
- Report unknown/unavailable rates.

## Reporting Model

Leadership reporting should include:

- Decision distribution.
- Risk distribution.
- High-risk coverage.
- Waiver and override quality.
- Follow-up conversion.
- Event quality coverage.
- Local advisory vs CI gate split.
- Execution surface distribution.
- Model/provider distribution where known.
- Token usage where available.
- Compute/runtime cost where available.
- Human supervision estimates where available.
- Unknown and unavailable data disclosures.

Reports must separate measured facts, estimated values, inferred conclusions, and unavailable data.

## What To Avoid

- Do not store prompts, diffs, secrets, customer payloads, or full file contents.
- Do not treat local developer buffers as team source of truth.
- Do not infer exact usage for surfaces that do not expose it.
- Do not turn local model runtime into cost unless the team configures a cost model.
- Do not mix measured cost, estimated cost, and unavailable cost in one unlabeled number.
- Do not use telemetry as employee surveillance.
- Do not collapse decision quality, cost, coverage, and follow-up into one score.
- Do not commit individual telemetry event streams to git.

## Recommended Roadmap

### Near Term

1. Define `agent_work_run` schema v1 and validation.
2. Emit CI artifacts for formal gates.
3. Add safe export and rollup commands.
4. Generate static reports from artifacts and manual exports.

### Mid Term

1. Add manual advisory recording.
2. Add scheduled GitLab/GitHub artifact aggregation.
3. Add policy-governed local upload.
4. Add collector API and deduplication.

### Later

1. Add tenant-scoped enterprise storage.
2. Add admin privacy policies and retention controls.
3. Add optional IDE/Codex/Cursor integrations.
4. Add dashboards and signed report exports.

## Final C-Level Readout

Team-level TestMate telemetry should treat local developer data as private source material, CI artifacts as reproducible team evidence, and collector/aggregator outputs as the actual reporting layer. Data enters team metrics only through explicit export, CI artifact publication, or policy-governed upload. Every value must preserve its source and confidence label. This keeps TestMate useful for engineering leadership without turning it into developer surveillance or fake ROI accounting.
