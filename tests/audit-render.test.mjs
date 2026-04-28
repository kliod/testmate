import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

test('audit renderer fixture preserves metrics, versioning, and decision flow contract', () => {
  const fixturePath = join(root, 'tests', 'fixtures', 'audit', 'enriched-audit.json');
  const result = spawnSync(
    process.execPath,
    ['.testmate/testmate.mjs', `--render-audit-file=${fixturePath}`],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## Decision Flow/);
  assert.match(result.stdout, /## Metrics/);
  assert.match(result.stdout, /## Versions And Hashes/);
  assert.match(result.stdout, /"stateSource": "preflight"/);
  assert.match(result.stdout, /"routeAdjusted": true/);
  assert.match(result.stdout, /"finalStatus": "WARNING"/);
  assert.match(result.stdout, /"promptChars": 17340/);
  assert.match(result.stdout, /"retryCount": 1/);
  assert.match(result.stdout, /"diffSliced": true/);
  assert.match(result.stdout, /"policyHash": "sha256:policy"/);
  assert.match(result.stdout, /"tierPromptHash": "sha256:tier-prompt"/);
  assert.match(result.stdout, /"diffHash": "sha256:diff"/);
});
