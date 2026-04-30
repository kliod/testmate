# Interaction and Audit Strategy for TestMate

This document defines two core orchestration behaviors for TestMate:

- how the system handles missing context through `NEED_INFO`;
- how the system creates immutable audit logs for formal TestMate evaluation runs.

The goal is to keep TestMate decisions explainable, reviewable, and operationally safe without turning ordinary documentation or implementation work into fake audit events.

## 1. Missing Context and `NEED_INFO`

When the Orchestrator or one of its specialist agents does not have enough context to make a reliable `PASS`, `WARNING`, or `BLOCK` decision, it must return `NEED_INFO` instead of guessing.

`NEED_INFO` is a valid decision state. It should be used when the missing information is material to the risk assessment and cannot be safely inferred from the repository, diff, policy, or available metadata.

### When To Use `NEED_INFO`

Use `NEED_INFO` when one or more of the following are true:

- API contracts, schemas, generated clients, or interface definitions are missing or unavailable for changed code that depends on them.
- Business requirements for error handling, negative states, or edge cases are unclear.
- A change introduces structural or architectural behavior without enough rationale to assess risk.
- Auth, permissions, routing guards, mutation behavior, file upload handling, or cache invalidation depends on context that is not present.
- The system cannot determine whether a missing test is an actual coverage gap or an intentional, documented exception.
- CI, PR, diff, or dependency metadata required for the selected tier is unavailable.

Do not use `NEED_INFO` as a safe escape hatch for weak analysis. The response must name the specific missing information and explain why it blocks a reliable decision.

### `NEED_INFO` Response Requirements

A `NEED_INFO` decision must include:

- a concise summary of what cannot be determined;
- specific questions in `questionsForUser`;
- the affected files, components, or workflows;
- the decision that cannot be made without the missing context;
- any safe partial findings that are already supported by evidence;
- recommended next steps for resolving the missing context.

### Local AI IDE Behavior

In a local AI IDE workflow, the Orchestrator should stop the evaluation and ask the user for the missing information in chat.

The user may resolve `NEED_INFO` by providing:

- product requirements;
- API or schema references;
- expected behavior for edge cases;
- test strategy rationale;
- a waiver or explicit risk acceptance;
- additional files or repository context.

After the missing context is supplied, the Orchestrator may resume the evaluation if the user requests it.

### CI/CD Behavior

In CI/CD, `NEED_INFO` should produce a structured comment or job output that lists the unresolved questions from `questionsForUser`.

For formal quality gates, a `NEED_INFO` result should block or fail the gate only when the configured policy treats unresolved context as blocking for the selected mode.

Recommended behavior by mode:

- `pre_commit`: report `NEED_INFO` locally and avoid overblocking unless the risk is high.
- `pre_mr`: block when the missing context affects merge safety.
- `pre_merge`: block when the missing context affects risk acceptance, release safety, or policy compliance.
- `pre_release`: block unless the missing context is explicitly waived by an authorized reviewer.

## 2. Audit Log Strategy

Audit logs exist to preserve decision provenance for formal TestMate evaluation runs.

An audit log is not a general work journal. It must not be created for ordinary advisory work, brainstorming, roadmap drafting, repository exploration, documentation editing, or implementation work on TestMate itself unless the user explicitly requests a formal TestMate evaluation run.

### Formal Evaluation Run Definition

A formal TestMate evaluation run is a real quality gate check that will return the TestMate JSON Output Contract.

Valid formal modes are:

- `pre_commit`;
- `pre_mr`;
- `pre_merge`;
- `pre_release`.

Valid audit log file names must follow this pattern:

```text
logs/[mode]_[timestamp].md
```

Examples:

```text
logs/pre_commit_2026-04-28T12-30-00Z.md
logs/pre_mr_2026-04-28T12-30-00Z.md
logs/pre_merge_2026-04-28T12-30-00Z.md
logs/pre_release_2026-04-28T12-30-00Z.md
```

Invalid examples:

```text
logs/strategy_2026-04-28.md
logs/docs_2026-04-28.md
logs/coding_2026-04-28.md
logs/random_notes.md
```

### Audit Creation Rule

Before creating a file in `logs/`, the Orchestrator must confirm all of the following:

- the task is a formal TestMate evaluation run;
- the mode is one of `pre_commit`, `pre_mr`, `pre_merge`, or `pre_release`;
- the final response will use the TestMate JSON Output Contract;
- the user requested or clearly implied a quality gate check.

If any condition is false, do not create an audit log.

### Audit Immutability

Audit logs are immutable records of completed evaluation runs.

Once an audit log has been created, it must not be edited, appended to, rewritten, renamed, or deleted as part of normal operation. If a new evaluation is needed, create a new audit log with a new timestamp.

This rule protects:

- traceability;
- dispute resolution;
- governance review;
- false positive and false negative analysis;
- historical comparison across policy, prompt, model, and repository changes.

### Audit Log Contents

Each audit log should preserve enough information to understand why the decision was made.

At minimum, include:

- mode and analysis scope;
- timestamp;
- repository and commit metadata if available;
- changed files or diff summary;
- detected tech stack and test runner;
- deterministic preflight results;
- selected agents and routing rationale;
- policy version;
- prompt or orchestrator version when available;
- final decision status;
- risk level;
- affected areas;
- required coverage;
- existing coverage;
- missing coverage;
- blockers;
- warnings;
- recommended tests;
- manual QA;
- residual risks;
- questions for the user;
- waiver or override information if present;
- tool errors or incomplete data;
- provenance of important findings.

### Agent-Level Audit Format

Agent findings should be compact at the top level and expandable for detail.

Recommended structure:

```markdown
### Auth & Permission Agent - WARNING

> **Summary**: Negative authorization coverage is missing for the changed route guard.

<details>
<summary>Technical evidence and reasoning</summary>

**Inputs analyzed:** `src/auth/RoleGuard.tsx`, `src/routes/admin.tsx`

**Evidence:**
- `RoleGuard.tsx` checks `user.roles.includes(requiredRole)`.
- Existing tests cover the allowed `ADMIN` path.
- No test covers denied access for `GUEST` or missing role state.

**Reasoning trace:**
1. The changed file controls route-level authorization.
2. Permission and route-guard changes are high risk under TestMate policy.
3. The diff contains positive-path coverage only.
4. Missing denied-path coverage could allow regressions in 403 handling.

**Assumptions:**
- The application expects unauthorized users to be redirected or shown a 403 state.
- The exact product copy for the 403 state is not required to validate access denial behavior.

**Recommended coverage:**
- Add a component or integration test for unauthorized access.
- Verify the route does not render protected content for an unauthorized user.

</details>
```

### Provenance Requirements

Important findings should identify their evidence source:

- deterministic preflight;
- policy-as-code;
- static repository inspection;
- test output;
- CI metadata;
- LLM reasoning grounded in files;
- human override or waiver.

Do not mix evidence and speculation. If a finding is inferred, label it as inferred. If a value is estimated, label it as estimated. If context is missing, use `NEED_INFO`.

## 3. Relationship Between Audit Logs and Journaling

Audit logs and `.testmate/journal.md` serve different purposes.

Audit logs:

- are created only for formal TestMate evaluation runs;
- capture one immutable evaluation event;
- belong in `logs/[mode]_[timestamp].md`;
- should not be edited after creation.

`.testmate/journal.md`:

- stores persistent repo-specific learnings across runs;
- should be read by agents before evaluation;
- should be written only for critical durable insights;
- must not be used for routine work notes.

Examples of appropriate journal entries:

- a known flaky test pattern specific to the repo;
- a required mock setup for a test runner;
- a repository-specific architectural quirk that affects repeated evaluations.

Examples of inappropriate journal entries:

- ordinary task progress;
- one-off comments;
- temporary implementation notes;
- generic testing advice.

## 4. Governance Guardrails

TestMate audit behavior must avoid both under-recording and analytics theater.

Required guardrails:

- Create audit logs only for formal quality gate checks.
- Do not create audit logs for documentation or implementation tasks unless a formal evaluation run is explicitly requested.
- Preserve decision provenance.
- Keep blocking policy explicit and versioned.
- Treat `BLOCK`, `WARNING`, and `NEED_INFO` as separate decision products.
- Track waivers and overrides with reasons.
- Keep measured, estimated, inferred, and derived information separate.
- Do not claim prevented defects or ROI without evidence and confidence limits.

The audit strategy should make TestMate more accountable, not louder.
