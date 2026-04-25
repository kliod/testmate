# TestMate Mocking Strategies

TestMate does not enforce a single method for handling API mocks. Different projects require different approaches. Choose the strategy that best fits your team's CI/CD lifecycle, and configure the `API Contract Agent` to validate against it.

## Option A: Committed Mocks (Recommended for Stability)
* **How**: Handlers and fixtures are written to `src/mocks/handlers.ts` and committed to Git.
* **Pros**: 100% offline reproducible. Fastest test boot times. Ideal for CI.
* **Cons**: Clutters PRs with mock JSON diffs. Prone to merge conflicts.

## Option B: In-Memory On-the-Fly (Recommended for Fast Moving APIs)
* **How**: `setupTests.ts` dynamically fetches `swagger.json` before tests start, parsing it into MSW handlers entirely in memory.
* **Pros**: 0 files to manage. Always synchronized with staging.
* **Cons**: Slows down `jest/vitest` startup. If staging goes down, your test pipeline fails.

## Option C: Record & Replay / VCR (Recommended for High Complexity)
* **How**: Tests are run in `REPLAY_MODE=record` against a real environment. Network responses are intercepted and saved as local JSON cassettes. CI runs in `play` mode.
* **Pros**: 100% realistic traffic. Protects against unspoken API drift.
* **Cons**: Needs live credentials to record. Risk of leaking PII/secrets inside repository cassettes.

## Option D: Gitignored Cache Directory
* **How**: Run a pre-test CLI script `testmate:mocks:generate`. It writes MSW handlers to `.testmate-cache/mocks/handlers.ts` (which is added to `.gitignore`).
* **Pros**: Fast local test runs. No Git pollution.
* **Cons**: Requires Developers to manually run the generation script to stay updated.
