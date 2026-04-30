# Interaction and Audit Strategy for TestMate

This document defines two orchestration behaviors for TestMate:

- how the system handles missing context through `NEED_INFO`;
- how the system creates immutable audit logs for formal TestMate evaluation runs.

The goal is to keep TestMate decisions explainable and reviewable without turning ordinary documentation, implementation, or advisory work into fake audit events.

## 1. Missing Context and `NEED_INFO`

When the Orchestrator or one of its specialist agents does not have enough context to make a reliable `PASS`, `WARNING`, or `BLOCK` decision, it must return `NEED_INFO` instead of guessing.

Use `NEED_INFO` when one or more of the following are true:

- API contracts, schemas, generated clients, or interface definitions are missing for changed code that depends on them.
- Business requirements for error handling, negative states, or edge cases are unclear.
- Auth, permissions, routing guards, mutation behavior, file upload handling, or cache invalidation depends on missing context.
- The system cannot determine whether a missing test is a real coverage gap or an intentional documented exception.
- CI, PR, diff, or dependency metadata required for the selected tier is unavailable.

Do not use `NEED_INFO` as a safe escape hatch for weak analysis. The response must name the specific missing information and explain which decision it blocks.

## 2. Audit Log Strategy

Audit logs preserve decision provenance for formal TestMate evaluation runs.

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
.testmate/logs/[mode]_[timestamp].md
```

Invalid examples:

```text
.testmate/logs/strategy_2026-04-28.md
.testmate/logs/docs_2026-04-28.md
.testmate/logs/coding_2026-04-28.md
.testmate/logs/random_notes.md
```

Before creating a file in `.testmate/logs/`, the Orchestrator must confirm all of the following:

- the task is a formal TestMate evaluation run;
- the mode is one of `pre_commit`, `pre_mr`, `pre_merge`, or `pre_release`;
- the final response will use the TestMate JSON Output Contract;
- the user requested or clearly implied a quality gate check.

If any condition is false, do not create an audit log.

### Audit Immutability

Audit logs are immutable records of completed evaluation runs.

Once an audit log has been created, it must not be edited, appended to, rewritten, renamed, or deleted as part of normal operation. If a new evaluation is needed, create a new audit log with a new timestamp.

The CLI enforces immutable writes with exclusive file creation. Audit log files in `.testmate/logs/` are local state and must not be committed or published.

## 3. Relationship Between Audit Logs and Journaling

Audit logs and `.testmate/journal.md` serve different purposes.

Audit logs:

- are created only for formal TestMate evaluation runs;
- capture one immutable evaluation event;
- belong in `.testmate/logs/[mode]_[timestamp].md`;
- should not be edited after creation.

`.testmate/journal.md`:

- stores persistent repo-specific learnings across runs;
- should be read by agents before evaluation;
- should be written only for critical durable insights;
- must not be used for routine work notes.

## 4. Governance Guardrails

Required guardrails:

- Create audit logs only for formal quality gate checks.
- Do not create audit logs for documentation or implementation tasks unless a formal evaluation run is explicitly requested.
- Preserve decision provenance.
- Keep blocking policy explicit and versioned.
- Treat `BLOCK`, `WARNING`, and `NEED_INFO` as separate decision products.
- Track waivers and overrides with reasons.
- Keep measured, estimated, inferred, and derived information separate.
- Do not claim prevented defects or ROI without evidence and confidence limits.
