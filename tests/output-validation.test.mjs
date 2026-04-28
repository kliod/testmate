import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function validOutput(overrides = {}) {
  return {
    status: 'PASS',
    mode: 'pre_commit',
    analysisScope: 'DIFF',
    riskLevel: 'LOW',
    changeType: 'documentation',
    decisionFactors: {
      impact: 'LOW',
      likelihood: 0.1,
      confidence: 0.9,
      coverageGap: 'NONE',
      businessCriticality: 'LOW'
    },
    findings: [],
    affectedAreas: [],
    subagentsRun: [],
    skippedAgents: [],
    requiredCoverage: [],
    existingCoverage: [],
    missingCoverage: [],
    blockers: [],
    warnings: [],
    recommendedTests: [],
    commandsToRun: [],
    manualQA: [],
    residualRisks: [],
    questionsForUser: [],
    interaction: {
      state: 'complete',
      blockedDecision: '',
      resumeToken: '',
      answersExpected: [],
      receivedAnswers: []
    },
    metrics: {},
    auditLogPath: '.testmate/logs/pre_commit_test.md',
    summary: 'No issues found.',
    ...overrides
  };
}

function runValidation(payload) {
  const dir = mkdtempSync(join(tmpdir(), 'testmate-output-'));
  const file = join(dir, 'output.json');
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  return spawnSync(
    process.execPath,
    ['.testmate/testmate.mjs', `--validate-output-file=${file}`],
    { cwd: root, encoding: 'utf8' }
  );
}

test('structured output validator accepts a valid PASS contract', () => {
  const result = runValidation(validOutput());

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Structured output is valid: PASS/);
});

test('structured output validator accepts a valid NEED_INFO contract', () => {
  const result = runValidation(validOutput({
    status: 'NEED_INFO',
    questionsForUser: ['Which role matrix should unblock the permission decision?'],
    interaction: {
      state: 'need_info',
      blockedDecision: 'permission coverage assessment',
      resumeToken: '',
      answersExpected: [
        {
          id: 'role_matrix',
          question: 'Which role matrix should unblock the permission decision?',
          unblocks: 'permission coverage assessment'
        }
      ],
      receivedAnswers: []
    }
  }));

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Structured output is valid: NEED_INFO/);
});

test('structured output validator rejects missing required fields', () => {
  const payload = validOutput();
  delete payload.decisionFactors;

  const result = runValidation(payload);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /decisionFactors is required/);
});

test('structured output validator rejects invalid enum values', () => {
  const result = runValidation(validOutput({ status: 'MAYBE' }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /status must be one of/);
});

test('structured output validator rejects invalid interaction answer shape', () => {
  const result = runValidation(validOutput({
    interaction: {
      state: 'complete',
      blockedDecision: '',
      resumeToken: '',
      answersExpected: [{ id: 'missing_question' }],
      receivedAnswers: []
    }
  }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /answersExpected.0.question is required/);
});

test('structured output validator rejects empty summary text', () => {
  const result = runValidation(validOutput({ summary: '' }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /summary must contain at least 1 characters/);
});

test('structured output validator rejects invalid audit log path pattern', () => {
  const result = runValidation(validOutput({ auditLogPath: '.testmate/logs/pre_commit_test.txt' }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /auditLogPath must match pattern \\.md\$/);
});

test('structured output validator rejects empty string items inside coverage arrays', () => {
  const result = runValidation(validOutput({ requiredCoverage: [''] }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requiredCoverage.0 must contain at least 1 characters/);
});
