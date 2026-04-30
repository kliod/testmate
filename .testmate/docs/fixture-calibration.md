# Fixture Calibration Model

Fixtures exist to keep TestMate's compact policy stable across models, IDEs, prompts, and future adapters.

They are not a second rulebook.

## Principle

Start from the core policy:

- bug fixes require regression coverage or a waiver;
- high-risk behavior requires meaningful coverage;
- auth and permission changes require role-based coverage;
- API mutations require success and error coverage;
- form submits require validation coverage;
- focused or skipped tests block unless explicitly justified by policy;
- missing critical context returns `NEED_INFO`.

When a realistic scenario appears, add a fixture to test whether the current policy leads to the expected decision. Do not add a new rule unless the existing policy cannot honestly express the risk.

## Fixture Roles

Use fixtures for:

- calibration across models;
- regression checks for prompt/schema changes;
- examples of how compact rules apply to real-looking diffs;
- false positive and false negative analysis;
- deciding whether a gap belongs in policy, preflight, prompt wording, or `NEED_INFO`.

Do not use fixtures for:

- encoding every edge case as a policy rule;
- forcing implementation-detail tests;
- rewarding noisy findings;
- proving ROI;
- replacing human review of ambiguous product behavior.

## Decision Loop

When a fixture fails, classify the reason before changing policy.

| Failure Cause | Preferred Response |
| --- | --- |
| Existing rule is clear, but the model missed it | Improve prompt wording or examples. |
| Existing rule is clear, but evidence is missing | Add deterministic preflight or fixture input data. |
| Scenario depends on unknown product behavior | Expected result should be `NEED_INFO`. |
| Scenario is covered elsewhere by a valid waiver | Expected result should usually be `WARNING`, not `PASS`. |
| Several fixtures expose the same uncovered risk | Consider a new core policy rule. |
| Fixture is too narrow or implementation-specific | Keep it as documentation or remove it. |

## Suggested Fixture Shape

Current fixtures may stay compact. For richer calibration, add optional metadata without breaking replay:

```json
{
  "id": "form-submit-missing-validation",
  "title": "Form submit change lacks invalid-state coverage",
  "calibration": {
    "riskArea": "forms",
    "policyIntent": "FORM_CHANGE_REQUIRES_VALIDATION_COVERAGE",
    "whyThisMatters": "Submit behavior changed and invalid input behavior is unverified.",
    "notARule": true,
    "acceptableAlternatives": [
      {
        "status": "WARNING",
        "when": "A valid time-bound waiver with approver and follow-up issue exists."
      },
      {
        "status": "NEED_INFO",
        "when": "The expected invalid input behavior is not defined."
      }
    ],
    "shouldNotWarnAbout": [
      "snapshot coverage",
      "component internals",
      "styling-only details"
    ]
  }
}
```

The replay script can ignore `calibration` metadata until it needs deeper checks.

## Starter Realistic Pack

Start with a small set. Keep it boring and high-signal.

| Fixture | Expected | Existing Rule |
| --- | --- | --- |
| Static copy-only change | `PASS` | Stop if no issues. |
| Form submit change without invalid-state test | `BLOCK` | Form changes require validation coverage. |
| Auth role guard change without denied-role test | `BLOCK` | Auth/permission requires role coverage. |
| API mutation without error-path coverage | `BLOCK` | API mutations require success/error coverage. |
| API mutation with valid waiver | `WARNING` | Waiver records accepted risk. |
| Cache invalidation change without stale-data coverage | `BLOCK` or `NEED_INFO` | High-risk cache behavior requires meaningful coverage or missing context. |
| Focused test introduced | `BLOCK` | No focused tests. |
| Skipped test introduced without explanation | `BLOCK` | Do not skip/weaken tests without explicit explanation. |

## Rule Growth Bar

Add a new policy rule only when all are true:

1. At least two realistic fixtures show the same gap.
2. The gap cannot be covered by an existing core rule.
3. The new rule would be understandable to an individual AI IDE user.
4. The rule has a clear unblock path.
5. The rule can be tested without calling real external services.

This keeps TestMate small enough to use and strong enough to trust.
