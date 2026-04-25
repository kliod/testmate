# Decision Policy

## PASS

Allowed when:

- required checks pass;
- no high-risk missing coverage;
- no unresolved blocker;
- residual risks are documented.

## WARNING

Allowed when:

- risk is low or medium;
- missing coverage is non-critical;
- manual QA is documented;
- no regression/security/access-control risk remains open.

## BLOCK

Required when:

- high-risk area has no meaningful test;
- bug fix has no regression test or waiver;
- auth/permission change lacks role coverage;
- API mutation lacks success/error coverage;
- form change lacks validation coverage;
- tests were deleted/skipped/weakened without explanation;
- critical journey is impacted and unverified;
- required CI checks fail.
