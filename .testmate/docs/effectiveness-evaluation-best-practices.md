# Effectiveness Evaluation Best Practices for AI-Native Quality Gates

This document defines practical, intellectually honest best practices for evaluating AI-native quality, review, and gating systems similar to TestMate.

The scope is not a generic LLM chatbot. The target system analyzes code changes, runs deterministic preflight checks, routes work to specialist agents, produces a structured decision contract, writes audit logs, and supports review, merge, and release decisions through statuses such as `PASS`, `WARNING`, `BLOCK`, and `NEED_INFO`.

## What Effectiveness Means

Effectiveness has two different layers that must not be collapsed into a single score.

1. **Runtime decision quality**: whether a specific `PASS`, `WARNING`, `BLOCK`, or `NEED_INFO` decision was correct, explainable, reproducible enough, and useful at the time it was made.
2. **Product and business effectiveness**: whether the system changed engineering behavior in a valuable way: fewer risky merges, better test coverage for meaningful risks, faster or clearer review decisions, more explicit risk acceptance, and better release confidence.

A system is not effective because it produces many findings. It is effective when it helps teams make better engineering decisions at an acceptable cost in latency, attention, money, and trust.

## Metric Types

Use explicit labels for metric confidence.

- **Measured metrics**: directly observed facts, such as runtime, decision status, schema validity, waiver count, tests added, or whether a `BLOCK` was resolved before merge.
- **Estimated metrics**: reasoned approximations, such as likely avoided late-cycle defects or time saved based on sampled evidence.
- **Inferred metrics**: indirect conclusions from patterns, such as risk reduction, improved review leverage, or behavior change across teams.

Do not present estimated or inferred metrics as measured facts.

## Report Language

Effectiveness reports are product artifacts and should follow the language of the user request that generated them.

- If the request is in English, generate the report in English.
- If the request is in Russian, generate the report in Russian.
- Keep stable machine-facing identifiers unchanged, including event types, JSON keys, file paths, modes, and decision statuses.
- Do not translate taxonomy values such as `tests_added_after_decision`, `pre_mr`, `WARNING`, or `.testmate/state/effectiveness.jsonl`.

## Product Value Measurement

| Best practice | Why it matters | What to measure | What not to do | Early stage | Mature stage |
| --- | --- | --- | --- | --- | --- |
| Measure behavior change, not tool activity | Separates "the system said something" from "the team changed behavior" | Measured: tests added, bugs fixed, PR changed, waiver created, merge delayed, merge blocked | Do not treat run count or finding count as product value | Critical | Critical |
| Track the decision-to-outcome chain | Connects gate decisions to real workflow outcomes | Measured: decision -> follow-up action -> merge outcome -> post-merge issue. Estimated: prevented defect value | Do not claim prevented defects without evidence or counterfactual humility | Manual tracking | Automated tracking |
| Separate adoption from value | Usage does not prove usefulness | Measured: run frequency and repeated team use. Separately: action rate and accepted findings | Do not treat DAU/MAU as quality impact | Useful | Required |
| Measure review leverage | Shows where the system reduces senior engineering burden | Measured: actionable findings accepted without extended manual investigation; review comments replaced by structured gate output | Do not claim linear time savings without baseline | Interviews and samples | PR analytics and sampling |
| Track avoided escalation honestly | Gives business context without fake precision | Estimated: avoided late-cycle defect range using historical incident classes | Do not publish exact dollar ROI without credible attribution | Qualitative ranges | Confidence-banded ranges |
| Segment by workflow mode | `pre_commit`, `pre_mr`, `pre_merge`, and `pre_release` have different value models | Measured: latency, block rate, override rate, and action rate per mode | Do not blend local pre-commit and release gates into one score | Required | Required |
| Measure user trust explicitly | A gate without trust becomes noise | Measured: override reasons, waiver quality, repeated disablement, maintainer feedback | Do not assume lack of complaints means trust | Lightweight feedback | Trust dashboard |

## Engineering and Operational Measurement

| Best practice | Why it matters | What to measure | What not to do | Early stage | Mature stage |
| --- | --- | --- | --- | --- | --- |
| Define latency budgets per mode | Quality gates must not break developer flow | Measured: p50, p90, and p95 runtime by mode, repository size, and diff size | Do not optimize only average runtime | Critical | Critical |
| Monitor deterministic preflight health | Deterministic checks are the foundation of reliable decisions | Measured: parse failures, missing diff data, CI metadata failures, changed-file detection errors | Do not hide preflight failures inside LLM prose | Critical | Critical |
| Evaluate routing correctness | Wrong routing causes missed risks or unnecessary work | Measured: expected agents vs selected agents on labeled samples | Do not treat "more agents ran" as better quality | Sample-based | Regression suite |
| Track cost per useful decision | Keeps platform economics grounded | Measured: runtime cost, token cost, compute cost. Derived: cost per accepted finding or actioned decision | Do not track cost per run without usefulness | Basic cost view | Optimization target |
| Enforce structured contract reliability | Gate output must be machine-checkable | Measured: JSON schema pass rate, missing fields, invalid statuses, audit log creation rate | Do not accept free-form output as a production gate | Critical | Critical |
| Track false stops and infrastructure failures | Operational failures should not be confused with legitimate `NEED_INFO` | Measured: failed runs, partial runs, tool errors, missing logs | Do not mix infra failures with valid uncertainty | Required | Required |
| Test the gate itself | The quality system can regress too | Measured: golden fixtures, known PR replays, stable output checks | Do not test only happy paths | Start in v1 | Required |

## Decision Quality Measurement

| Best practice | Why it matters | What to measure | What not to do | Early stage | Mature stage |
| --- | --- | --- | --- | --- | --- |
| Build a confusion matrix by decision class | Shows whether `PASS`, `WARNING`, `BLOCK`, and `NEED_INFO` are calibrated | Measured on labeled samples: true block, false block, missed block, correct pass | Do not collapse quality into one accuracy score | Sample-based | Continuous eval |
| Use severity-weighted evaluation | Missing an auth bug is worse than a noisy CSS warning | Measured: correctness weighted by risk level and affected area | Do not give every finding equal weight | Required | Required |
| Evaluate test impact analysis accuracy | This is core value for a TestMate-like system | Measured: predicted affected areas vs actual files and tests changed after review | Do not reward vague recommendations | Required | Required |
| Measure actionability | Findings should produce clear next steps | Measured: accepted findings, clarified findings, ignored findings with reason | Do not reward long reports | Critical | Critical |
| Interpret overrides and waivers carefully | Overrides are not always failures | Measured: override reason, approver role, later outcome, repeated patterns | Do not count every override as a false positive | Required | Required |
| Track regression test follow-through | Bug fixes should lead to regression coverage or explicit waivers | Measured: tests added after `BLOCK` or `WARNING`; waiver if no test was added | Do not force low-value tests just to close a gate | Required | Required |
| Measure `NEED_INFO` precision | `NEED_INFO` is useful only when specific context is truly missing | Measured: resolution rate, unnecessary `NEED_INFO` rate, time to resolution | Do not use `NEED_INFO` as a safe escape hatch | Required | Required |
| Run missed-risk postmortems | Escaped defects are the best evaluation data | Measured: post-merge defects mapped back to original gate decision | Do not turn this into blame | Manual RCA | Formal feedback loop |

## Governance, Trust, and Auditability

| Best practice | Why it matters | What to measure | What not to do | Early stage | Mature stage |
| --- | --- | --- | --- | --- | --- |
| Write immutable audit logs | Decisions must be inspectable later | Measured: log completeness, inputs, agents run, commands, status, waiver data | Do not store only the final summary | Critical | Critical |
| Preserve decision provenance | Teams must know what came from deterministic logic vs LLM reasoning | Measured: source attribution per finding: rule, preflight, LLM, test output, human override | Do not mix evidence and speculation | Required | Required |
| Keep blocking policy as code | `BLOCK` must be predictable and governable | Measured: policy version, triggered rule, exception path | Do not let the LLM invent blocking policy | Critical | Critical |
| Govern human overrides | Teams need an escape hatch, but not an invisible one | Measured: who overrode, why, risk level, expiry, follow-up issue | Do not make override either impossible or untracked | Required | Required |
| Support replay and reproducibility | Enables debugging disputed decisions | Measured: ability to replay same diff, context, policy, and model version | Do not expect full determinism from LLM output without snapshotting | v2 | Required |
| Monitor model and prompt drift | Model behavior can change | Measured: golden eval deltas by model, prompt, and policy version | Do not change model or prompt without a baseline | Manual | Required |
| Make explanations evidence-based | Leaders need traceable reasoning, not confident prose | Measured: rationale quality, evidence links, affected files, tests, policy references | Do not generate certainty without evidence | Required | Required |

## Metrics to Collect in v1

The v1 measurement system should be small, reliable, and outcome-oriented.

| Metric | Type | Why it belongs in v1 |
| --- | --- | --- |
| Decision status distribution: `PASS`, `WARNING`, `BLOCK`, `NEED_INFO` | measured | Establishes baseline gate behavior |
| Risk level distribution | measured | Shows where the system detects risk |
| Runtime p50, p90, p95 by mode | measured | Protects developer experience |
| Audit log creation success rate | measured | Minimum governance requirement |
| Structured contract schema validity | measured | Production readiness requirement |
| Follow-up action rate after non-`PASS` decisions | measured | Early value signal |
| Override and waiver rate with reason | measured | Calibration and trust signal |
| Tests added after decision | measured | Strong evidence of changed engineering behavior |
| `BLOCK` resolved before merge | measured | Direct workflow impact |
| `NEED_INFO` resolution rate | measured | Validates whether uncertainty is useful |
| Manual sample review of decisions | measured | Most honest early decision-quality evaluation |

## Phase 1 Instrumentation Baseline

The first implementation phase should make the decision-to-outcome chain observable without trying to prove full ROI. It should create stable local records that later support `--show-effectiveness`, manual review, and product reporting.

### Local Event Streams

Keep technical run metrics and outcome events separate.

| Stream | Suggested path | Purpose |
| --- | --- | --- |
| Runtime metrics | `.testmate/state/metrics.jsonl` | Records formal run facts, decision status, duration, schema validity, and audit log metadata |
| Effectiveness events | `.testmate/state/effectiveness.jsonl` | Records follow-up outcomes after a decision: tests added, overrides, waivers, clarifications, and fixes |

Both streams should be append-only and privacy-safe. They must not store raw prompts, raw model responses, raw diffs, secrets, or customer payloads.

### Minimal Runtime Record

Each formal run should emit one runtime record after the decision is known.

```json
{
  "recordType": "runtime_run",
  "schemaVersion": 1,
  "runId": "local-stable-id",
  "timestamp": "2026-04-28T00:00:00.000Z",
  "mode": "pre_mr",
  "analysisScope": "AFFECTED",
  "decisionStatus": "WARNING",
  "riskLevel": "HIGH",
  "durationMs": 120000,
  "schemaValid": true,
  "auditLogPath": "logs/pre_mr_2026-04-28T00-00-00.md",
  "changedFilesCount": 4,
  "toolErrorsCount": 0
}
```

### Minimal Effectiveness Event

Follow-up outcomes should be recorded explicitly rather than inferred whenever possible.

```json
{
  "recordType": "effectiveness_event",
  "schemaVersion": 1,
  "eventId": "local-stable-event-id",
  "runId": "local-stable-id",
  "timestamp": "2026-04-28T00:10:00.000Z",
  "decisionStatus": "WARNING",
  "eventType": "tests_added_after_decision",
  "source": "manual",
  "meaningfulness": "unknown",
  "preMerge": true,
  "notes": "Regression test added for validation path."
}
```

Supported v1 event types:

- `coverage_gap_detected`
- `tests_added_after_decision`
- `manual_qa_added`
- `follow_up_fix_required`
- `follow_up_fix_completed`
- `decision_overridden`
- `waiver_used`
- `clarification_required`
- `clarification_resolved`
- `issue_prevented`
- `post_decision_action_taken`
- `release_drift_caught`

### Required Guardrails

- Use closed event type enums instead of unbounded free-form labels.
- Mark estimated and inferred values explicitly.
- Allow `meaningfulness` to be `true`, `false`, or `unknown`; do not pretend every action is useful.
- Treat `issue_prevented` as inferred unless a manual review or incident taxonomy supports it.
- Preserve local-only operation as the default.

### Minimum Phase 1 Summary

The first summary output should be able to report:

- total formal runs;
- decision distribution by `PASS`, `WARNING`, `BLOCK`, and `NEED_INFO`;
- count of each effectiveness event type;
- number of non-`PASS` decisions with at least one follow-up action;
- number of `BLOCK` decisions with completed follow-up fixes;
- number of `WARNING` decisions with tests or manual QA added;
- number of `NEED_INFO` decisions resolved;
- explicit notes that value estimates are heuristic, not financial ROI.

## Metrics to Defer to v2 or v3

| Metric or practice | Type | Why to defer |
| --- | --- | --- |
| Severity-weighted escaped defect reduction | inferred / estimated | Requires enough historical defect data |
| Cost of avoided defects | estimated | Requires mature incident taxonomy |
| Full confusion matrix by repo and team | measured | Requires labeled datasets |
| Model drift dashboard | measured | Useful after prompt and model policy stabilize |
| Automated counterfactual analysis | inferred | Easy to make pseudo-scientific |
| Predictive risk scoring | inferred | Dangerous before enough validated data exists |
| Team-level productivity impact | estimated | Many confounding variables |
| Cross-repository benchmarks | inferred | Repositories and team processes are often not comparable |

## Metrics That Are Usually Misleading

| Metric | Why it misleads |
| --- | --- |
| Number of issues found | Rewards noise and long reports |
| `BLOCK` rate as a success metric | High block rate may mean poor calibration |
| Single LLM accuracy score | Hides severity, risk class, false negatives, and actionability |
| Tokens used without outcome context | Cost metric, not value metric |
| Time saved without baseline and sampling | Often becomes fictional ROI |
| Developer satisfaction without behavioral data | Sentiment can hide process problems |
| Pass rate | May mean either good code quality or a blind gate |
| Accepted findings by count | One auth finding can matter more than many cosmetic comments |

## Best Practices for Hybrid Deterministic and LLM-Driven Systems

### Separate Deterministic and LLM Decision Layers

Every important decision element should have provenance.

| Decision element | Preferred source |
| --- | --- |
| Changed files | Deterministic diff parser |
| Package and test runner detection | Deterministic preflight |
| Policy trigger | Deterministic rules |
| Risk classification | Rules plus LLM reasoning |
| Missing coverage explanation | LLM grounded in deterministic evidence |
| Final `BLOCK` eligibility | Policy-as-code |

LLM reasoning can recommend, explain, classify, and synthesize. Blocking policy should be explicit and versioned.

### Treat `BLOCK`, `WARNING`, and `NEED_INFO` as Different Products

`BLOCK` should be rare, explainable, policy-backed, and include a clear unblock path.

Measure:
- upheld block rate;
- resolved-before-merge rate;
- false block rate;
- override reason.

`WARNING` should be actionable, not decorative.

Measure:
- action rate;
- ignored-with-reason rate;
- repeated warning fatigue.

`NEED_INFO` should specify exactly what context is missing.

Measure:
- resolution rate;
- unnecessary `NEED_INFO` rate;
- time to resolution.

Avoid using `WARNING` as a dumping ground for uncertain LLM observations.

### Treat Follow-Up Actions as Part of the Decision

The decision is not complete when the JSON is emitted. Track what happened next:

- tests added after the decision;
- code changed after a finding;
- waiver created;
- waiver expired or converted into an issue;
- `BLOCK` resolved;
- `WARNING` ignored with a reason;
- post-merge defect linked back to the original decision.

Without follow-up tracking, the system measures its own speech rather than its effect on engineering behavior.

### Interpret Overrides and Waivers Carefully

An override can mean several things:

- false positive;
- acceptable business risk;
- risk covered elsewhere;
- urgent hotfix;
- test infeasible now;
- incorrect context;
- duplicate finding;
- policy disagreement.

Override rate without reason taxonomy is weak evidence. It should not be interpreted as automatic failure or automatic success.

### Evaluate Tests Added After Decision

Tests added after a `BLOCK`, `WARNING`, or `NEED_INFO` are one of the strongest early value signals.

Measure:
- whether a unit, component, integration, or e2e test was added;
- whether the test covers the risk identified by the system;
- whether it was added before merge or after merge;
- whether it was required, recommended, or manually chosen.

Do not count any new test as automatic success. Low-value tests written only to satisfy the gate can reduce trust.

## Measuring Outcome After a Decision

Use a decision-to-outcome chain:

```text
Change submitted
-> TestMate decision
-> Human or team action
-> Merge or release decision
-> Post-merge or post-release outcome
-> Feedback into policy and evaluation
```

Track each stage.

| Stage | What to record |
| --- | --- |
| Decision | status, risk, affected areas, required coverage, evidence |
| Action | code changed, tests added, waiver, override, no-op |
| Merge | merged, delayed, rejected, split PR, hotfix exception |
| After merge | incident, rollback, flaky failure, QA bug, no known issue |
| Feedback | true positive, false positive, false negative, policy adjustment |

The key distinction:

- "The system said X" is not impact.
- "Because the system said X, the team did Y, and risk Z was reduced or explicitly accepted" is impact.

## Measuring Usefulness Without Analytics Theater

Avoid large dashboards that do not support decisions. Use a few evidence loops.

### Monthly Decision Review Sample

Review 20 to 50 decisions with a senior engineer and product or quality owner.

Classify each decision:
- correct, partially correct, or incorrect;
- actionable or not actionable;
- changed behavior or did not change behavior;
- false positive, false negative, or acceptable judgment call;
- policy issue, model issue, routing issue, or missing-context issue.

### Outcome-Linked Metrics Only

A useful dashboard should answer: what changed after the decision?

Prefer:
- follow-up action rate;
- tests added;
- block resolution;
- waiver reason;
- missed-risk register.

Avoid:
- raw finding count;
- raw run count;
- single quality score;
- unqualified time-saved claims.

### Use Ranges for Estimated Value

Acceptable:

```text
Estimated: the system likely helped prevent 2-4 late-cycle defects this month, based on accepted BLOCK/WARNING findings that were fixed before merge.
Confidence: medium, because post-merge defect attribution is still manually reviewed.
```

Not acceptable:

```text
Saved $48,231 this month.
```

### Maintain False Positive and False Negative Registers

These are more valuable than a polished aggregate score.

The registers should feed back into:
- deterministic rules;
- routing;
- prompt and model evaluation fixtures;
- policy thresholds;
- documentation and team education.

### Use Qualitative Evidence Responsibly

A concrete example from a staff engineer tied to a specific PR and outcome can be more honest than a weak metric.

Qualitative evidence should not replace measurement, but it can explain why measured impact matters.

## Explainable ROI Narrative

A credible ROI narrative should be causal, range-based, and evidence-backed.

Example:

```text
In the last month, TestMate ran on 143 PRs.
It produced 18 BLOCK decisions and 41 WARNING decisions.

Of those non-PASS decisions, 27 led to concrete follow-up actions:
- 14 regression tests added
- 8 code fixes before merge
- 3 explicit waivers
- 2 PRs split due to risk

In sampled review, 21 of 27 actions were judged meaningful by maintainers.

Estimated value: reduced late-cycle defect risk in auth, forms, and cache-sensitive areas.
Confidence: medium.
Limitation: post-merge defect attribution is still manual.
```

This separates:
- measured facts;
- estimated value;
- confidence;
- limitations.

Do not use pseudo-precise ROI math when the causal chain is not strong enough.

## Recommended Minimum Evaluation Framework

This is the minimum set of practices that can be implemented without overloading the team.

### 1. Instrument Every Run

Record:
- mode;
- scope;
- status;
- risk level;
- affected areas;
- subagents or rules triggered;
- required coverage;
- blockers and warnings;
- audit log path;
- deterministic vs LLM provenance.

### 2. Track Five Outcome Metrics

| Metric | Type |
| --- | --- |
| Follow-up action rate after non-`PASS` | measured |
| Tests added after decision | measured |
| Override or waiver rate with reason | measured |
| `BLOCK` resolved before merge | measured |
| `NEED_INFO` resolved vs abandoned | measured |

### 3. Review Samples Weekly or Biweekly

For 20 to 30 decisions, classify:
- correct / partially correct / incorrect;
- actionable / not actionable;
- changed behavior / no behavior change;
- false positive / false negative;
- policy issue / model issue / missing context.

### 4. Maintain Two Registers

Maintain:
- false positives and noisy findings;
- missed risks and escaped defects.

Use both to improve:
- deterministic preflight;
- routing;
- policies;
- prompts;
- test fixtures;
- documentation.

### 5. Keep `BLOCK` Policy Deterministic

The LLM may recommend, classify, and explain. A blocking decision should map to explicit policy and evidence.

### 6. Report Value as an Evidence Narrative

Monthly reporting should include:
- measured outcomes;
- estimated impact ranges;
- representative examples;
- known limitations;
- next improvements to policy, routing, or model behavior.

## Executive Summary

1. Evaluate TestMate-like systems by outcomes after decisions, not by number of findings or LLM activity.
2. Keep runtime decision quality separate from product and business effectiveness.
3. The best v1 metrics are follow-up actions, tests added, overrides and waivers with reasons, `BLOCK` resolution, `NEED_INFO` resolution, schema validity, and audit reliability.
4. Treat `BLOCK`, `WARNING`, and `NEED_INFO` as separate decision products with different quality bars.
5. Deterministic logic should own policy, preflight, routing evidence, and auditability; LLM reasoning should assist classification, explanation, and synthesis.
6. ROI should be evidence-based and range-based: measured facts first, estimated value second, confidence and limitations always visible.
7. A practical minimum framework is: instrument every run, review sampled decisions, track outcomes, maintain false-positive and false-negative registers, and evolve policy from evidence.
