# TestMate Waiver Policy

Waivers are allowed only when a required automated test cannot reasonably be added in the current change and the remaining risk is explicitly accepted.

## When A Waiver Is Allowed

A waiver may be accepted when all of these are true:

- the risk is clearly described;
- the missing coverage is bounded to a known feature, file, or user journey;
- manual QA or another verification path is documented;
- a follow-up issue or owner is identified for future coverage;
- the waiver does not hide auth, permission, data-loss, payment-like, or security risk without reviewer sign-off.

## When A Waiver Is Not Allowed

A waiver must not be accepted when:

- a bug fix has no regression test and no explanation;
- auth or permission behavior changed without role-based coverage or explicit security sign-off;
- API mutation behavior changed without success/error verification;
- tests were deleted, skipped, or weakened without a concrete reason;
- a critical user journey is changed and unverified;
- the waiver only says "tests later" without owner, follow-up, or risk statement.

## Required Waiver Fields

Every waiver should include:

- `risk`: what can break;
- `reason`: why automated coverage is not added now;
- `manualVerification`: exact command, checklist, or QA path used instead;
- `owner`: person or team accepting the risk;
- `followUp`: ticket, issue, or planned work item;
- `expiry`: condition or date when the waiver should be revisited.

## JSON/Audit Expectations

When TestMate accepts a waiver, the final output should:

- keep `missingCoverage` populated with the waived gap;
- add the waiver to `residualRisks`;
- include manual verification in `manualQA`;
- avoid `PASS` for high-risk gaps unless the waiver has explicit sign-off and confidence remains at least `0.75`;
- return `BLOCK` when waiver evidence is missing for a blocking rule.

## PR Template Mapping

The PR template's "Waiver documented" checkbox is valid only when the waiver fields above are present in the PR body, linked issue, or audit log.
