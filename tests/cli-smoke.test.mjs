import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function runNpm(args) {
  if (process.platform === 'win32') {
    return execFileSync('cmd.exe', ['/d', '/s', '/c', `npm.cmd ${args.join(' ')}`], {
      cwd: root,
      encoding: 'utf8'
    });
  }

  return execFileSync('npm', args, {
    cwd: root,
    encoding: 'utf8'
  });
}

test('package entrypoints point at the relocated TestMate runner', () => {
  const pkg = readJson(join(root, 'package.json'));

  assert.equal(pkg.main, '.testmate/testmate.mjs');
  assert.equal(pkg.bin.testmate, '.testmate/testmate.mjs');
  assert.ok(existsSync(join(root, pkg.main)));
});

test('required relocated prompts, agents, and policy docs exist', () => {
  const requiredFiles = [
    '.testmate/AGENTS.md',
    '.testmate/agents/web-testing-orchestrator.md',
    '.testmate/docs/audit-strategy.md',
    '.testmate/prompts/tier-1-targeted.md',
    '.testmate/prompts/tier-2-impact.md',
    '.testmate/prompts/tier-3-full.md'
  ];

  for (const file of requiredFiles) {
    assert.ok(existsSync(join(root, file)), `${file} should exist`);
  }
});

test('runner parses and dry-run preflight executes without an API key', () => {
  execFileSync(process.execPath, ['--check', '.testmate/testmate.mjs'], { cwd: root });

  const result = spawnSync(
    process.execPath,
    ['.testmate/testmate.mjs', 'tier-1-targeted', '--dry-run-preflight', '--base-branch=HEAD'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const preflight = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
  assert.equal(preflight.mode, 'tier-1-targeted');
  assert.ok(Array.isArray(preflight.changedFiles));
  assert.ok(Array.isArray(preflight.relatedTests));
});

test('audit logs are created under .testmate/logs with immutable writes', () => {
  const runner = readFileSync(join(root, '.testmate/testmate.mjs'), 'utf8');

  assert.match(runner, /const logDir = path\.join\(__dirname, 'logs'\)/);
  assert.match(runner, /flag: 'wx'/);
});

test('audit log wrapper localizes Russian decisions', () => {
  const runner = readFileSync(join(root, '.testmate/testmate.mjs'), 'utf8');
  const orchestrator = readFileSync(join(root, '.testmate/agents/web-testing-orchestrator.md'), 'utf8');

  assert.match(runner, /useRussianHeadings/);
  assert.match(runner, /А-Яа-яЁё/);
  assert.match(runner, /Итоговое решение/);
  assert.match(orchestrator, /same natural language as the user's request/);
});

test('npm package dry-run includes relocated runtime files', () => {
  const output = runNpm(['pack', '--dry-run', '--json']);
  const [pack] = JSON.parse(output);
  const files = new Set(pack.files.map((file) => file.path));

  assert.ok(files.has('.testmate/testmate.mjs'));
  assert.ok(files.has('.testmate/prompts/tier-3-full.md'));
  assert.ok(files.has('.testmate/agents/web-testing-orchestrator.md'));
});

test('npm publish exclusions are explicit and keep local audit state out of packages', () => {
  assert.ok(existsSync(join(root, '.npmignore')));

  const output = runNpm(['pack', '--dry-run', '--json']);
  const [pack] = JSON.parse(output);
  const files = new Set(pack.files.map((file) => file.path));

  assert.ok(!files.has('.testmate/journal.md'));
  assert.ok(![...files].some((file) => file.startsWith('.testmate/logs/')));
  assert.ok(![...files].some((file) => file.startsWith('.testmate/state/')));
});

test('release checklist preserves the required package gate commands', () => {
  const checklist = readFileSync(join(root, 'RELEASE_CHECKLIST.md'), 'utf8');

  assert.match(checklist, /node --check \.testmate\/testmate\.mjs/);
  assert.match(checklist, /node --test/);
  assert.match(checklist, /npm\.cmd pack --dry-run --json|npm pack --dry-run --json/);
  assert.match(checklist, /git diff --check/);
  assert.match(checklist, /\.testmate\/logs\//);
  assert.match(checklist, /\.testmate\/state\//);
  assert.match(checklist, /\.testmate\/journal\.md/);
});

test('waiver policy is linked from policy and PR templates with required fields', () => {
  const policy = readFileSync(join(root, '.testmate/docs/waiver-policy.md'), 'utf8');
  const agents = readFileSync(join(root, '.testmate/AGENTS.md'), 'utf8');
  const rootTemplate = readFileSync(join(root, '.github/PULL_REQUEST_TEMPLATE/pull_request_template.md'), 'utf8');
  const bundledTemplate = readFileSync(join(root, '.testmate/github/PULL_REQUEST_TEMPLATE/pull_request_template.md'), 'utf8');
  const agentCards = readFileSync(join(root, '.testmate/agent-cards.json'), 'utf8');

  for (const field of ['risk', 'reason', 'manualVerification', 'owner', 'followUp', 'expiry']) {
    assert.match(policy, new RegExp(`\\\`${field}\\\``));
    assert.match(agents, new RegExp(`\\\`${field}\\\``));
    assert.match(agentCards, new RegExp(field));
  }

  assert.match(rootTemplate, /\.testmate\/docs\/waiver-policy\.md/);
  assert.match(bundledTemplate, /\.testmate\/docs\/waiver-policy\.md/);
});

test('root and bundled AGENTS stay aligned on audit path and routing policy', () => {
  const rootAgents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  const bundledAgents = readFileSync(join(root, '.testmate/AGENTS.md'), 'utf8');

  for (const text of [rootAgents, bundledAgents]) {
    assert.match(text, /\.testmate\/logs\//);
    assert.match(text, /## Routing Policy/);
    assert.doesNotMatch(text, /Always run:/);
    assert.doesNotMatch(text, /## Spawn Rules/);
    assert.doesNotMatch(text, /вЂ”/);
    assert.doesNotMatch(text, /рџ/);
  }

  assert.match(rootAgents, /Map chat requests as follows:/);
  assert.match(rootAgents, /\.testmate\/prompts\/tier-3-full\.md/);
});

test('runner records prompt metrics and version hashes in audit metadata', () => {
  const runner = readFileSync(join(root, '.testmate/testmate.mjs'), 'utf8');
  const schema = readFileSync(join(root, '.testmate/ai-quality-output.schema.json'), 'utf8');

  for (const marker of [
    'promptChars',
    'responseChars',
    'retryCount',
    'diffSliced',
    'diffOriginalChars',
    'diffSelectedChars',
    'diffOmittedFiles',
    'policyHash',
    'policySummaryHash',
    'agentCardsHash',
    'tierPromptHash',
    'orchestratorHash',
    'diffHash'
  ]) {
    assert.match(runner, new RegExp(marker));
  }

  for (const validatorMarker of [
    'schema.minLength',
    'schema.maxLength',
    'schema.pattern',
    'schema.minItems',
    "Object.prototype.hasOwnProperty.call(schema, 'const')"
  ]) {
    assert.match(runner, new RegExp(validatorMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(schema, /"promptChars"/);
  assert.match(schema, /"responseChars"/);
  assert.match(schema, /"retryCount"/);
  assert.match(schema, /"model"/);
  assert.match(schema, /"diffSliced"/);
  assert.match(schema, /"minLength"/);
  assert.ok(schema.includes('"pattern": "\\\\.md$"'));
});

test('runner exposes a fixture audit renderer for contract-level audit tests', () => {
  const runner = readFileSync(join(root, '.testmate/testmate.mjs'), 'utf8');

  assert.match(runner, /--render-audit-file=/);
  assert.match(runner, /function renderAuditFileForCli/);
});

test('runner slices large diffs for prompt payload while preserving full diff state', () => {
  const runner = readFileSync(join(root, '.testmate/testmate.mjs'), 'utf8');

  assert.match(runner, /function selectRelevantDiff/);
  assert.match(runner, /Diff slice generated by TestMate/);
  assert.match(runner, /Diff context metadata/);
  assert.match(runner, /diffForPrompt/);
  assert.match(runner, /Full diff is preserved in resume state and version hashes/);
});

test('tier prompts enforce stateful preflight gates and audit records decision flow', () => {
  const runner = readFileSync(join(root, '.testmate/testmate.mjs'), 'utf8');
  const prompts = [
    '.testmate/prompts/tier-1-targeted.md',
    '.testmate/prompts/tier-2-impact.md',
    '.testmate/prompts/tier-3-full.md'
  ].map((file) => readFileSync(join(root, file), 'utf8'));

  for (const prompt of prompts) {
    assert.match(prompt, /State Protocol/);
    assert.match(prompt, /preflightConfidence >= 0\.7/);
    assert.match(prompt, /Escalation Gates/);
    assert.match(prompt, /Stop Conditions/);
    assert.match(prompt, /Confidence Gates/);
    assert.match(prompt, /Token budget/);
  }

  assert.match(runner, /decisionFlow/);
  assert.match(runner, /stateSource: 'preflight'/);
  assert.match(runner, /routeAdjusted/);
  assert.match(runner, /blockedDecision/);
});

test('preflight exposes related test mapping and local analytics stays ignored', () => {
  const runner = readFileSync(join(root, '.testmate/testmate.mjs'), 'utf8');
  const gitignore = readFileSync(join(root, '.gitignore'), 'utf8');
  const npmignore = readFileSync(join(root, '.npmignore'), 'utf8');
  const analyticsDoc = readFileSync(join(root, '.testmate/docs/analytics.md'), 'utf8');

  assert.match(runner, /relatedTests/);
  assert.match(runner, /metrics\.jsonl/);
  assert.match(runner, /--show-metrics/);
  assert.match(runner, /showMetricsSummary/);
  assert.match(gitignore, /\.testmate\/state\//);
  assert.match(npmignore, /\.testmate\/state\//);
  assert.match(analyticsDoc, /must not contain/);
  assert.match(analyticsDoc, /raw diff/);
  assert.match(analyticsDoc, /raw prompt/);
  assert.match(analyticsDoc, /--show-metrics/);
});

test('metrics summary command is safe without an existing metrics file', () => {
  const result = spawnSync(
    process.execPath,
    ['.testmate/testmate.mjs', '--show-metrics'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No local TestMate metrics found|totalRuns/);
});

test('benchmark fixtures command reports deterministic slicing and routing metrics', () => {
  const result = spawnSync(
    process.execPath,
    ['.testmate/testmate.mjs', '--benchmark-fixtures'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.summary.fixtureCount, 6);
  assert.ok(parsed.summary.averagePromptReductionPercent >= 0);
  assert.equal(parsed.summary.baselineStatus, 'OK');
  assert.equal(parsed.summary.baselineAttention, 0);
  assert.ok(Array.isArray(parsed.results));
  assert.ok(parsed.results.some((entry) => entry.fixture === 'docs-only'));
  assert.ok(parsed.results.some((entry) => entry.fixture === 'release-relocation' && entry.diffSliced));
  assert.ok(parsed.results.some((entry) => entry.fixture === 'auth-guard' && entry.candidateAgents.includes('Auth & Permission Agent')));
  assert.ok(parsed.results.some((entry) => entry.fixture === 'api-mutation' && entry.candidateAgents.includes('API Mock & Contract Agent')));
  assert.ok(parsed.results.some((entry) => entry.fixture === 'runtime-package' && entry.baseline?.status === 'OK'));
  assert.ok(parsed.results.some((entry) => entry.fixture === 'docs-only' && entry.baseline?.status === 'OK'));
  assert.ok(parsed.results.some((entry) => entry.fixture === 'mirrored-tests' && entry.relatedTestsFound === 2));
});
