# TestMate Release Checklist

Use this checklist before publishing or merging a release branch for TestMate itself.

## Required Checks

- [ ] `node --check .testmate/testmate.mjs`
- [ ] `node --test`
- [ ] `cmd.exe /d /s /c "npm.cmd pack --dry-run --json"` on Windows, or `npm pack --dry-run --json` on Unix-like environments
- [ ] `git diff --check`

## Package Contents

Confirm the dry-run package includes:

- [ ] `.testmate/testmate.mjs`
- [ ] `.testmate/AGENTS.md`
- [ ] `.testmate/policy-summary.json`
- [ ] `.testmate/agent-cards.json`
- [ ] `.testmate/ai-quality-output.schema.json`
- [ ] `.testmate/prompts/tier-1-targeted.md`
- [ ] `.testmate/prompts/tier-2-impact.md`
- [ ] `.testmate/prompts/tier-3-full.md`
- [ ] `.testmate/agents/web-testing-orchestrator.md`
- [ ] `.testmate/docs/`
- [ ] `tests/cli-smoke.test.mjs`

Confirm the dry-run package excludes:

- [ ] `.testmate/logs/`
- [ ] `.testmate/state/`
- [ ] `.testmate/journal.md`
- [ ] `node_modules/`

## CI Templates

- [ ] Root `.github/workflows/quality-gate.yml` calls `node .testmate/testmate.mjs`.
- [ ] Bundled `.testmate/github/workflows/quality-gate.yml` calls `node .testmate/testmate.mjs`.
- [ ] Root `.gitlab-ci.yml` calls `node .testmate/testmate.mjs`.
- [ ] Bundled `.testmate/gitlab-ci.yml` calls `node .testmate/testmate.mjs`.
- [ ] CI artifacts point to `.testmate/logs/`.

## Chat-Native Policy

- [ ] Root `AGENTS.md` says chat agents must not run the TestMate CLI unless explicitly asked.
- [ ] `.testmate/AGENTS.md` describes chat-native and CLI/CI behavior without contradiction.
- [ ] README describes when to use chat-native vs CLI/CI.

## Audit And Resume

- [ ] Runner creates audit logs with exclusive writes.
- [ ] Audit logs are written under `.testmate/logs/`.
- [ ] `.testmate/logs/`, `.testmate/state/`, and `.testmate/journal.md` are ignored by Git and excluded from npm package.
- [ ] CLI `NEED_INFO` resume path is documented in README.

## Optional Release Gate

Run the real CLI workflow in a CI or release environment with `OPENAI_API_KEY` set:

```bash
node .testmate/testmate.mjs tier-3-full --base-branch=origin/main
```

Do not use this command to satisfy chat-native TestMate checks unless the user explicitly asks for the CLI/CI runner.
