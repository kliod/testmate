# TestMate V2 Audit Report

Date: 2026-04-28
Branch: `feature/v-2`
Status: current

## Executive Summary

The major structural v2 risks have been closed in the current working tree.

Runtime relocation, package entrypoints, CI paths, runtime schema validation, resume behavior, audit versioning, route-aware diff slicing, benchmark baselines, and related test heuristics are all implemented and covered by local verification.

There are no unresolved v2 findings at the moment. The main residual technical note is architectural rather than urgent: if the output schema grows into more complex composition features such as `oneOf`, `anyOf`, or `allOf`, the current zero-dependency validator may no longer be the right long-term choice.

## Resolved Findings

| Historical finding | Status | Evidence |
| --- | --- | --- |
| `.testmate/` was effectively untracked | Resolved | `.testmate/` is tracked; only logs, state, and journal are ignored |
| Package entrypoints still pointed at old runtime paths | Resolved | `package.json` points to `.testmate/testmate.mjs` |
| Bundled CI configs referenced deleted paths | Resolved | GitHub and GitLab templates call `node .testmate/testmate.mjs` |
| Lockfile was missing for `npm ci` flows | Resolved | `package-lock.json` exists |
| Schema did not support `NEED_INFO` | Resolved | schema includes `NEED_INFO`, `questionsForUser`, and `interaction` |
| Schema was not the runtime source of truth | Resolved | runner validates output against `.testmate/ai-quality-output.schema.json` |
| Audit immutability was documented but not enforced | Resolved | audit logs use exclusive create semantics |
| README lagged behind the `.testmate/` layout | Resolved | README documents `.testmate/`-based integration paths |
| npm packaging relied on `.gitignore` fallback | Resolved | `.npmignore` exists and is protected by tests |
| Prompt and policy versioning were missing | Resolved | audit metrics include policy, prompt, card, and diff hashes |
| Waiver flow was fragmented | Resolved | waiver policy is centralized and linked from policy and templates |
| Release checklist was missing | Resolved | `RELEASE_CHECKLIST.md` exists and is covered by smoke checks |
| Tier prompts were too generic | Resolved | prompts now include budgets, gates, and stop conditions |
| Audit logs were weak as leadership artifacts | Resolved | audit logs include `Decision Flow`, metrics, and version hashes |
| Context slicing was not implemented | Resolved | payload uses selected diff plus slicing metadata |
| Prompt reduction lacked a benchmark suite | Resolved | fixed benchmark fixtures and baselines exist |
| Audit metadata lacked a fixture contract test | Resolved | audit renderer fixture tests exist |
| Related test mapping was too shallow | Resolved | score-based mapping handles mirrored layouts and nested tests |
| Validator only supported the narrowest keyword subset | Resolved | validator now supports additional schema keywords used by the contract |

## Current Findings

None.

## Residual Technical Note

If the schema expands into complex compositional features such as `oneOf`, `anyOf`, or `allOf`, it will likely be more maintainable to move to `ajv` than to keep extending the custom validator.

## Verification Performed

```bash
node --check .testmate/testmate.mjs
node --test
cmd.exe /d /s /c "npm.cmd pack --dry-run --json"
git diff --check
```

Current local result:

- all listed verification commands pass
- `node --test` is green at 25/25
- benchmark fixtures return `baselineStatus = OK`
