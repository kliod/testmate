# Web Testing Orchestrator Kit

Minimal public package for AI-assisted web testing in AI IDEs.

Goal: give Cursor / Claude Code / Codex / Antigravity a compact operating model for testing web apps before commit, pull request, merge, and release.

The agent does not merely generate tests. It makes a quality decision:

- `PASS` — safe to continue
- `WARNING` — acceptable with documented risk
- `BLOCK` — must fix before moving forward

## Contents

```txt
AGENTS.md                         Core project policy for AI IDEs
agents/                           Specialist agent prompts
prompts/                          Mode-specific prompts
docs/                             Compact policy docs
scripts/                          Example quality gate scripts/schema
.github/                          GitHub Actions + PR template
cursor-rules/                     Cursor-ready rules
examples/                         Example package scripts
```

## Dual Workflow Architecture

TestMate operates on two distinct planes to provide maximum safety without slowing down local development.

### 1. The Local Workflow (AI IDE Native)
**Best for**: Interactive development and Auto-Remediation.
If you use Cursor, Claude Code, or Antigravity, **do not use the console script**. 
Your IDE natively reads `.cursor-rules/testing.mdc` and the `AGENTS.md` rulebook. 
* **Workflow**: Write your code. Open the IDE Chat and type: *"Run Tier-1 checks and auto-fix any missing tests."*
* **Why**: The IDE will act as the Orchestrator, identify the missing tests, and use its native file-editing capabilities to write the tests and patch your files immediately. 

### 2. The CI/CD Workflow (Server CLI)
**Best for**: Rigid Quality Gates and Pull Request validation.
Servers don't have IDE interfaces, so we provide `scripts/testmate.mjs`.

* **Workflow**: Add a step to your `.github/workflows` or `.gitlab-ci.yml`:
  `npm run testmate:integrity`
* **Why**: It acts as a strict, read-only analyzer. If a developer bypassed the Local IDE checks, the script will output a Markdown list of errors, return `exit 1`, and Block the merge. 

## Installation & Setup

1. **Clone the repo** into your project or add it as a submodule.
2. **Set up Environment**: Ensure `OPENAI_API_KEY` is available in your environment variables.
3. **Run Locally**:
   ```bash
   npm install
   npm run testmate:targeted
   ```
4. **CI/CD Integration**:
   - **GitHub**: Use the provided actions in `.github/workflows`.
   - **GitLab**: Use the provided `.gitlab-ci.yml`. Ensure `OPENAI_API_KEY` is set in CI/CD Variables.

## Prime rules

- Every non-trivial change requires test impact analysis.
- Every bug fix requires a regression test or documented waiver.
- Every high-risk change requires meaningful automated coverage.
- Test user behavior, not implementation details.
- Use the lowest reliable test layer.
- Do not create flaky tests.
