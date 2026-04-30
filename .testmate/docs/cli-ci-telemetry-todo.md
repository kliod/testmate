# CLI, CI, And Telemetry TODO

This document tracks infrastructure work around TestMate's CLI adapter, CI quality-gate usage, and telemetry/effectiveness pipeline.

It is intentionally separate from the v1 copied-kit product focus. The first user remains the individual AI IDE user. CLI, CI, and telemetry are supporting systems that should evolve without making the policy kit harder to copy, read, or use.

This is not a formal TestMate evaluation run. Do not create audit logs for TODO maintenance.

## Guiding Principles

- The policy kit must remain model-agnostic.
- The CLI is a reference adapter, not the whole product.
- CI should start non-blocking and become blocking only after calibration.
- Telemetry must be privacy-safe, explicit, and source-labeled.
- Local developer records are private source material, not team truth.
- CI artifacts are reproducible team evidence.
- Collector, daemon, dashboards, and hosted storage are future layers, not v1 onboarding.
- Measured, estimated, inferred, and unavailable values must stay separate.
- Do not store raw prompts, raw diffs, secrets, customer payloads, or full file contents in telemetry.

## Current Baseline

Implemented:

- CLI mode mapping for `tier-*` aliases and formal `pre_*` modes.
- Deterministic preflight summary.
- Output contract validation.
- Audit log path sanitization and immutability guard.
- Runtime metrics records in `.testmate/state/metrics.jsonl`.
- Effectiveness events in `.testmate/state/effectiveness.jsonl`.
- `--show-effectiveness`.
- `--record-effectiveness-event`.
- Golden fixture replay.
- Mocked provider path through `TESTMATE_MOCK_OPENAI_RESPONSE`.
- CLI tests for `PASS`, `BLOCK`, `NEED_INFO`, unparseable output, and schema-invalid output.
- GitHub Actions example with non-blocking API-key behavior.

Known limits:

- CLI directly calls OpenAI Chat Completions.
- No provider adapter abstraction yet.
- No CI artifact export/upload for logs or telemetry.
- No telemetry export/rollup commands.
- No `agent_work_run` normalized event stream yet.
- No collector, daemon, dashboard, retention, or centralized storage.
- No mocked tests for provider network failures, rate limits, malformed provider envelopes, or missing `choices`.
- No full release-gate CI story.

## P0 - CLI Reliability And Adapter Boundaries

These tasks make the current CLI adapter predictable enough to keep as a reference implementation.

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Document the CLI as an OpenAI reference adapter | Prevents users from thinking the whole product is OpenAI-only. | `docs/adapter-boundaries.md` or README section |
| TODO | Define provider adapter interface | Keeps future Anthropic/OpenAI-compatible/local adapters from forking policy logic. | `scripts/providers/*` or documented interface |
| TODO | Move OpenAI request code out of `testmate.mjs` | Makes provider behavior testable without spawning the whole CLI. | Provider module |
| TODO | Add provider error classification | Network errors, 401, 429, 5xx, invalid envelopes, and empty choices should produce clear failures. | CLI code + tests |
| TODO | Add tests for missing or malformed provider envelopes | Current tests cover unparseable content, not all bad API shapes. | `scripts/testmate-cli.test.mjs` |
| TODO | Document `TESTMATE_MOCK_OPENAI_RESPONSE` | Maintainers need an obvious local testing hook. | README or maintainer docs |
| TODO | Add `--dry-run-payload` or equivalent debug mode | Lets maintainers inspect prompt payload without calling a provider or writing audit logs. | CLI option |
| TODO | Make model/provider config explicit | `AI_MODEL` exists; provider identity and endpoint config need a home. | Env docs |
| TODO | Support OpenAI-compatible endpoint configuration | Required for local or proxy runtimes without changing policy. | `OPENAI_BASE_URL` or provider config |
| TODO | Keep invalid provider output as a failing gate result | Formal gate should not silently pass when the provider fails contract. | Existing behavior + regression test |

## P1 - CLI Mode And Contract Hardening

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Add command help output | Users need discoverable modes and flags. | `node scripts/testmate.mjs --help` |
| TODO | Add explicit `--mode=` parsing | Positional mode is simple but brittle as flags grow. | CLI parser |
| TODO | Add `--format=json|markdown` for formal results where safe | CI and humans need different output shapes. | CLI option |
| TODO | Validate mode before reading provider config | Unsupported modes should fail before unrelated setup. | CLI flow |
| TODO | Improve base branch diagnostics | CI users need clearer base-ref guidance. | CLI output + docs |
| TODO | Add tests for base branch fallback | Prevents regressions in changed-file detection. | CLI/core tests |
| TODO | Add tests for audit log collision | Full CLI collision behavior should be tested. | CLI test |
| TODO | Add JSON Schema strictness review | `additionalProperties: true` is flexible; decide if/when to tighten. | Schema decision |
| TODO | Add schema examples | Valid `PASS`, `WARNING`, `BLOCK`, `NEED_INFO` examples help adapter authors. | `examples/contracts/` |

## P1 - CI Quality Gate Readiness

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Split CI docs into non-blocking and blocking recipes | Early pilots and protected branches need different defaults. | `docs/ci-usage.md` |
| TODO | Upload audit logs as CI artifacts | Formal CI decisions need reproducible team evidence. | GitHub/GitLab config |
| TODO | Upload telemetry export artifacts when implemented | Enables later aggregation without committing local event streams. | CI config |
| TODO | Add GitHub Action summary output | PR reviewers need readable output without digging through logs. | Workflow step |
| TODO | Add GitLab CI summary guidance | GitLab users need equivalent MR visibility. | `.gitlab-ci.yml` docs |
| TODO | Support `TESTMATE_REQUIRE_API_KEY` documentation | Current workflow implements it; docs should explain rollout tradeoff. | README/CI docs |
| TODO | Add CI examples for base branch selection | Forks, PRs, and MRs differ in base ref behavior. | CI docs |
| TODO | Add CI examples for test logs and coverage summary inputs | The CLI has flags; CI docs should show how to feed them. | CI docs |
| TODO | Add CI failure semantics table | Clarify exit codes for `PASS`, `WARNING`, `BLOCK`, `NEED_INFO`, infra failure, invalid provider output. | CI docs |
| TODO | Add CI fixture replay job for maintainers | Policy/schema changes should replay fixtures without provider calls. | Workflow job |
| TODO | Decide whether `WARNING` should ever fail CI | Usually no for pilot; maybe configurable later. | Policy/config decision |
| TODO | Add branch-protection guidance | Blocking CI should require calibration and waiver/override process. | Team pilot docs |

## P2 - Release Gate And Temporal Drift

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Define `pre_release` required inputs | Release gate needs more than a diff. | Release docs |
| TODO | Add critical journey checklist format | Release confidence depends on explicit user journeys. | `docs/release-gate.md` |
| TODO | Add visual/a11y evidence handling | Release gates often require non-unit evidence. | Docs + contract examples |
| TODO | Add release drift fixture examples | `pre_merge`/`pre_release` need temporal drift calibration. | Fixtures |
| TODO | Add manual QA evidence examples | Avoid vague "manual QA done" claims. | Examples |
| TODO | Decide when `NEED_INFO` blocks release | Release policy should be stricter than local advisory. | Policy docs |

## P0 - Local Telemetry Safety

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Document local state files | Users should know what `.testmate/state/*.jsonl` contains. | README/docs |
| TODO | Confirm `.testmate/state` is gitignored | Prevent accidental commit of local records. | `.gitignore` |
| TODO | Add privacy validation for recorded events | Ensure no raw prompt/diff/payload fields appear in telemetry records. | Tests |
| TODO | Add event schema validation | Invalid local records are counted, but creation should also be validated. | Effectiveness tests |
| TODO | Add local state pruning or retention guidance | Append-only files can grow forever. | Docs or CLI command |
| TODO | Document empty-state behavior | `--show-effectiveness` should be understandable before any runs. | README/docs |
| TODO | Add `--state-dir` for tests and advanced users | Avoid writing test data into project state. | CLI option |

## P1 - Normalized Telemetry Model

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Decide whether to migrate `runtime_run` to `agent_work_run` | Current implementation and architecture docs use different record names. | Schema decision |
| TODO | Define `agent_work_run` schema v1 in code | Docs describe it; code needs a validator before export. | Schema module |
| TODO | Add `executionSurface` | Needed to distinguish CLI, CI, AI IDE, manual entry, local model. | Runtime record field |
| TODO | Add `workflowType` | Needed to separate formal gates, local advisory, fixture replay, follow-up recording. | Runtime record field |
| TODO | Add privacy fields | `rawPromptStored`, `rawDiffStored`, `customerPayloadStored` should be explicit. | Runtime record field |
| TODO | Add usage visibility fields | Provider-reported, tool-reported, estimated, unavailable must not be mixed. | Runtime record field |
| TODO | Add cost source fields | Actual, estimated, allocated, unavailable must remain separate. | Runtime/cost schema |
| TODO | Add `toolCallsCount` when available | Useful operational metric, nullable when unavailable. | Runtime record field |
| TODO | Add `parentRunId` or attempt metadata | Needed for reruns and CI retry dedupe. | Runtime record field |

## P1 - Telemetry Export And Rollups

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Add `--export-telemetry --out <path>` | Enables explicit, privacy-safe export from local/CI state. | CLI command |
| TODO | Add `--rollup-telemetry --out <path>` | Enables CI artifacts and team summaries without raw event streams. | CLI command |
| TODO | Add export batch schema | Batches need `exportId`, schema version, source, record count, records. | Schema module |
| TODO | Add rollup schema | Rollups should be safer to publish than event streams. | Schema module |
| TODO | Add export privacy preview | Show records count and confirm no prompts/diffs/payloads before export. | CLI output |
| TODO | Add export tests | Validate schema, privacy checks, and output paths. | Tests |
| TODO | Add duplicate/dedupe strategy | `runId` and `exportId` should prevent inflated metrics. | Export docs/code |
| TODO | Add CI artifact examples after export exists | Avoid docs that promise commands not implemented yet. | CI docs |

## P2 - Collector, Aggregator, And Daemon

These are future systems. Do not build before local export and CI artifacts exist.

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Define collector API contract | Needed before any daemon/upload work. | API docs |
| TODO | Define auth model for telemetry upload | Prevents accidental unauthenticated ingestion. | Security design |
| TODO | Define tenant/team/repo identifiers | Required for team-level reporting. | Data model |
| TODO | Define retention policy | Telemetry without retention rules becomes risky. | Governance docs |
| TODO | Define deletion/export controls | Enterprise requirement, later. | Governance docs |
| TODO | Design policy-governed daemon | Daemon must read only safe local buffers. | Design doc |
| TODO | Add daemon consent policy | Advisory records require explicit consent. | Policy config |
| TODO | Add retry and ack semantics | Upload state should update only after accepted records. | Daemon design |
| TODO | Add collector dedupe by `exportId` and `runId` | Prevents retry inflation. | Collector design |
| TODO | Build scheduled artifact aggregator first if possible | Lower risk than hosted collector. | Script/job |

## P1 - Cost Telemetry

Cost measurement should remain operational accounting, not a value or ROI claim.

Principles:

- Measure cost separately from value.
- Keep direct automation cost, infrastructure cost, human supervision cost, follow-up engineering cost, and maintenance/governance cost as separate layers.
- Keep actual, estimated, allocated, and unavailable values separate.
- Do not treat the cost of fixing a real defect as the cost of TestMate.
- Do not report exact ROI without baseline, attribution, and incident taxonomy.
- Do not use `tokens / findings` as a usefulness metric.
- Prefer coarse review and follow-up effort buckets over fake minute-level precision.
- Report cost beside outcome metrics, not instead of outcome metrics.

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Record provider token usage when available | Already partially implemented; keep stable. | Runtime record |
| TODO | Add pricing-table hook as optional config | Estimated cost should be explicit and configurable. | Config/module |
| TODO | Keep actual and estimated cost separate | Prevents fake precision. | Schema/tests |
| TODO | Add CI duration fields where available | Infra cost starts with runtime/CI duration. | CI/runtime record |
| TODO | Add optional review time bucket | Human supervision cost should be coarse and explicit. | Event schema |
| TODO | Add follow-up effort bucket | Follow-up engineering effort should not be guessed. | Event schema |
| TODO | Add cost report beside effectiveness summary | Useful for maintainers, but not a product-value claim. | Report mode |
| TODO | Add cost layer fields | Direct automation, infra, supervision, follow-up, and governance costs should not collapse into one unlabeled total. | Runtime/event schema |
| TODO | Add cost metrics to avoid to public docs | Prevent `tokens / findings` or fake ROI formulas from becoming product claims. | README/docs |

## P1 - Effectiveness And Outcome Quality

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Add reason-code examples | Better waiver/override interpretation. | Docs |
| TODO | Add evidence-link examples | Outcome events are stronger when linked to PR/issue/CI evidence. | Docs |
| TODO | Add false-positive event pattern | Overrides need classification without assuming failure. | Event docs |
| TODO | Add false-negative/missed-risk register format | Escaped risks should feed fixtures and policy tuning. | Docs |
| TODO | Add manual sample review template | Human calibration is the honest early eval method. | Docs |
| TODO | Add `--show-effectiveness --format=markdown` docs to CI artifacts later | Human reports can ride with CI outputs. | CI docs |

## P2 - Multi-Model And Multi-Surface Support

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Separate policy compatibility from CLI provider support | The policy kit is multi-model before every CLI adapter exists. | Adapter docs |
| TODO | Add provider adapter test matrix | OpenAI, OpenAI-compatible, local, and future providers need contract checks. | Test plan |
| TODO | Add response-normalization layer | Providers return different envelopes and usage fields. | Provider module |
| TODO | Add usage-normalization tests | Token/cost fields should be nullable and source-labeled. | Tests |
| TODO | Add local model guidance | Local runtime should not be monetized without configured cost model. | Docs |
| TODO | Add AI IDE surface reporting guidance | ChatGPT/Codex/Cursor advisory data should be manual or opt-in, not scraped. | Telemetry docs |

## P3 - Reporting And Dashboards

Do this only after records, exports, and rollups are stable.

| Status | Task | Why It Matters | Artifact |
| --- | --- | --- | --- |
| TODO | Generate static Markdown reports from rollups | Useful before dashboards. | Report command |
| TODO | Generate JSON reports for automation | Lets teams publish or archive metrics. | Report command |
| TODO | Add unknown/unavailable disclosure | Reporting must show data quality limits. | Report schema |
| TODO | Add workflow segmentation | Local advisory, formal gate, and fixture replay should not be mixed. | Rollup/report |
| TODO | Add mode segmentation | `pre_commit`, `pre_mr`, `pre_merge`, `pre_release` have different value models. | Rollup/report |
| TODO | Add dashboard only after report schema stabilizes | Avoid building UI over unstable data. | Future app |

## Definitions Of Done

### CLI Adapter Hardening Done

- `npm.cmd test` passes.
- Mocked provider tests cover `PASS`, `WARNING`, `BLOCK`, `NEED_INFO`, invalid JSON, schema-invalid JSON, provider errors, and missing choices.
- CLI documents all modes and flags.
- Provider-specific code is isolated from policy/schema/preflight logic.
- Invalid provider output fails formal gates.

### CI Readiness Done

- Non-blocking and blocking recipes are documented separately.
- CI uploads audit logs as artifacts for formal runs.
- CI can run fixture replay without provider calls.
- Exit semantics are documented.
- API key behavior is explicit.
- Blocking CI guidance requires calibration and waiver/override ownership.

### Telemetry Export Done

- Local records remain private by default.
- `--export-telemetry` emits a schema-validated batch.
- `--rollup-telemetry` emits a sanitized aggregate.
- Export preview confirms prompts/diffs/payloads are absent.
- CI can publish export and rollup artifacts.
- No individual event stream is committed to git.

### Collector/Daemon Readiness Done

- Collector API is specified.
- Auth, retention, dedupe, and deletion/export controls are specified.
- Daemon policy restricts reads to safe TestMate state files.
- Advisory upload requires explicit consent.
- Retries are idempotent.

## Do Not Do Yet

- Do not build hosted collector before export/rollup exists.
- Do not build dashboards before rollup/report schemas stabilize.
- Do not treat local `.testmate/state` as team truth.
- Do not auto-upload AI IDE advisory records.
- Do not store raw prompts or raw diffs.
- Do not claim prevented defects or ROI from telemetry alone.
- Do not make CLI provider support drive changes to the core policy kit.
