import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve('.');
const cliPath = path.join(repoRoot, 'scripts', 'testmate.mjs');

function tempProject() {
    const cwd = mkdtempSync(path.join(tmpdir(), 'testmate-cli-'));
    writeFileSync(
        path.join(cwd, 'package.json'),
        JSON.stringify({ scripts: { test: 'node --test' } }, null, 2),
        'utf8'
    );
    return cwd;
}

function decision(overrides = {}) {
    return {
        status: 'PASS',
        mode: 'pre_mr',
        analysisScope: 'AFFECTED',
        riskLevel: 'LOW',
        changeType: 'no risky change',
        affectedAreas: [],
        subagentsRun: ['Discovery Agent', 'Security Agent'],
        policyRulesTriggered: [],
        evidence: [],
        requiredCoverage: [],
        existingCoverage: [],
        missingCoverage: [],
        blockers: [],
        warnings: [],
        recommendedTests: [],
        commandsToRun: ['npm test'],
        manualQA: [],
        waivers: [],
        overrides: [],
        residualRisks: [],
        questionsForUser: [],
        auditLogPath: 'logs/pre_mr_2026-04-29T12-00-00.md',
        summary: 'No risky behavior detected.',
        ...overrides
    };
}

function mockResponse(content) {
    return JSON.stringify({
        choices: [
            {
                message: {
                    content
                }
            }
        ],
        usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
        }
    });
}

function runCli({ content }) {
    const cwd = tempProject();
    try {
        const result = spawnSync(process.execPath, [cliPath, 'pre_mr'], {
            cwd,
            env: {
                ...process.env,
                OPENAI_API_KEY: 'test-key',
                TESTMATE_MOCK_OPENAI_RESPONSE: mockResponse(content)
            },
            encoding: 'utf8'
        });
        return result;
    } finally {
        rmSync(cwd, { recursive: true, force: true });
    }
}

function fencedJson(data) {
    return `Mock audit summary.\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

test('CLI accepts a valid PASS contract from a mocked provider response', () => {
    const result = runCli({ content: fencedJson(decision()) });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /TestMate finished with PASS/);
    assert.match(result.stdout, /Audit log written to:/);
});

test('CLI exits non-zero for a valid BLOCK contract', () => {
    const result = runCli({
        content: fencedJson(decision({
            status: 'BLOCK',
            riskLevel: 'HIGH',
            policyRulesTriggered: ['HIGH_RISK_REQUIRES_MEANINGFUL_COVERAGE'],
            missingCoverage: ['high-risk behavior coverage'],
            blockers: ['High-risk behavior lacks meaningful coverage.'],
            summary: 'Blocked by missing coverage.'
        }))
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /TestMate BLOCKED/);
});

test('CLI exits non-zero and lists questions for NEED_INFO', () => {
    const result = runCli({
        content: fencedJson(decision({
            status: 'NEED_INFO',
            riskLevel: 'MEDIUM',
            questionsForUser: ['What is the expected unauthorized behavior?'],
            summary: 'Missing product behavior.'
        }))
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /TestMate stopped with NEED_INFO/);
    assert.match(result.stderr, /expected unauthorized behavior/);
});

test('CLI exits non-zero for unparseable provider content', () => {
    const result = runCli({ content: 'not json at all' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /parseable JSON quality-gate contract/);
});

test('CLI exits non-zero for schema-invalid provider content', () => {
    const invalid = decision({
        analysisScope: 'DIFF',
        auditLogPath: 'logs/pre_commit_2026-04-29T12-00-00.md'
    });
    const result = runCli({ content: fencedJson(invalid) });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /invalid quality-gate contract/);
    assert.match(result.stderr, /Invalid analysisScope/);
});
