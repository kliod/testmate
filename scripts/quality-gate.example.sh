#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-pre_mr}"

echo "Running local quality gate in mode: $MODE"

if [ -f package.json ]; then
  npm run lint --if-present
  npm run typecheck --if-present
  npm run test:unit --if-present
fi

echo ""
echo "Now run your AI IDE/agent with:"
echo "Use AGENTS.md and agents/web-testing-orchestrator.md."
echo "Mode: $MODE."
echo "Analyze the current git diff and return the required JSON quality decision."
