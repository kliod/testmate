import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MODE_CONFIG,
    buildPreflightSummary,
    detectFocusedOrSkippedTests,
    detectFrameworks,
    detectTestRunner,
    parseChangedFiles,
    resolveAuditLogPath,
    validateQualityGateOutput
} from './testmate-core.mjs';

const schema = {
    required: [
        'status',
        'mode',
        'analysisScope',
        'riskLevel',
        'changeType',
        'affectedAreas',
        'subagentsRun',
        'policyRulesTriggered',
        'evidence',
        'requiredCoverage',
        'existingCoverage',
        'missingCoverage',
        'blockers',
        'warnings',
        'recommendedTests',
        'commandsToRun',
        'manualQA',
        'waivers',
        'overrides',
        'residualRisks',
        'questionsForUser',
        'auditLogPath',
        'summary'
    ],
    properties: {
        status: { enum: ['PASS', 'WARNING', 'BLOCK', 'NEED_INFO'] },
        mode: { enum: ['pre_commit', 'pre_mr', 'pre_merge', 'pre_release'] },
        analysisScope: { enum: ['DIFF', 'AFFECTED', 'FULL'] },
        riskLevel: { enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        affectedAreas: { type: 'array', items: { type: 'string' } },
        evidence: { type: 'array', items: { type: 'object' } },
        auditLogPath: { type: 'string', pattern: '^\\.testmate\\/logs\\/(pre_commit|pre_mr|pre_merge|pre_release)_[^\\/]+\\.md$' }
    }
};

function validDecision(overrides = {}) {
    return {
        status: 'WARNING',
        mode: 'pre_mr',
        analysisScope: 'AFFECTED',
        riskLevel: 'HIGH',
        changeType: 'form submit change',
        affectedAreas: ['checkout form'],
        subagentsRun: ['Discovery Agent', 'Security Agent'],
        policyRulesTriggered: ['FORM_CHANGE_REQUIRES_VALIDATION_COVERAGE'],
        evidence: [{ source: 'deterministic_preflight', type: 'changed_files', summary: '1 file changed', files: ['src/Form.tsx'] }],
        requiredCoverage: ['validation test'],
        existingCoverage: [],
        missingCoverage: ['error path'],
        blockers: [],
        warnings: ['validation gap'],
        recommendedTests: ['add invalid submit test'],
        commandsToRun: ['npm test'],
        manualQA: [],
        waivers: [],
        overrides: [],
        residualRisks: [],
        questionsForUser: [],
        auditLogPath: '.testmate/logs/pre_mr_2026-04-29T12-00-00.md',
        summary: 'Needs follow-up validation coverage.',
        ...overrides
    };
}

test('maps legacy tier aliases to formal modes and scopes', () => {
    assert.equal(MODE_CONFIG['tier-1-targeted'].formalMode, 'pre_commit');
    assert.equal(MODE_CONFIG['tier-2-impact'].formalMode, 'pre_mr');
    assert.equal(MODE_CONFIG['tier-2-impact'].analysisScope, 'AFFECTED');
    assert.equal(MODE_CONFIG['tier-3-full'].formalMode, 'pre_release');
});

test('parses changed files from git diff headers', () => {
    const diff = [
        'diff --git a/src/App.tsx b/src/App.tsx',
        'index 111..222 100644',
        'diff --git a/tests/app.test.ts b/tests/app.test.ts'
    ].join('\n');

    assert.deepEqual(parseChangedFiles(diff), ['src/App.tsx', 'tests/app.test.ts']);
});

test('detects frameworks and test runners from package scripts and dependencies', () => {
    const packageJson = {
        scripts: {
            test: 'node --test',
            e2e: 'playwright test'
        },
        dependencies: {
            react: '^18.0.0'
        },
        devDependencies: {
            vitest: '^2.0.0'
        }
    };

    assert.deepEqual(detectFrameworks(packageJson), ['react']);
    assert.deepEqual(detectTestRunner(packageJson), ['playwright', 'node:test']);
});

test('detects focused and skipped tests in changed test files', () => {
    const files = new Map([
        ['C:\\repo\\src\\form.test.ts', 'test.only("submits", () => {}); it.skip("fails", () => {});'],
        ['C:\\repo\\src\\other.ts', 'test.only("ignored non-test file", () => {});']
    ]);

    const findings = detectFocusedOrSkippedTests({
        changedFiles: ['src/form.test.ts', 'src/other.ts'],
        cwd: 'C:\\repo',
        exists: filePath => files.has(filePath),
        readFile: filePath => files.get(filePath)
    });

    assert.deepEqual(findings, [
        { file: 'src/form.test.ts', type: 'focused_test' },
        { file: 'src/form.test.ts', type: 'skipped_test' }
    ]);
});

test('builds a privacy-safe deterministic preflight summary', () => {
    const summary = buildPreflightSummary({
        requestedMode: 'tier-2-impact',
        formalMode: 'pre_mr',
        analysisScope: 'AFFECTED',
        baseBranch: 'origin/main',
        changedFiles: ['src/App.tsx'],
        packageJson: {
            scripts: { test: 'node --test' },
            dependencies: { react: '^18.0.0' }
        },
        focusedOrSkippedTests: [],
        testLogsProvided: false,
        coverageSummaryProvided: true,
        toolErrors: []
    });

    assert.equal(summary.source, 'deterministic_preflight');
    assert.equal(summary.changedFilesCount, 1);
    assert.deepEqual(summary.detectedFrameworks, ['react']);
    assert.deepEqual(summary.detectedTestRunners, ['node:test']);
    assert.deepEqual(summary.inputs, {
        testLogsProvided: false,
        coverageSummaryProvided: true
    });
});

test('validates a complete quality gate contract', () => {
    const errors = validateQualityGateOutput(validDecision(), schema, {
        requestedMode: 'tier-2-impact',
        expectedMode: 'pre_mr',
        expectedAnalysisScope: 'AFFECTED'
    });

    assert.deepEqual(errors, []);
});

test('rejects wrong scope, missing fields, and invalid audit path', () => {
    const errors = validateQualityGateOutput(
        validDecision({
            analysisScope: 'DIFF',
            auditLogPath: '.testmate/logs/pre_commit_2026-04-29T12-00-00.md',
            evidence: 'not-an-array'
        }),
        schema,
        {
            requestedMode: 'tier-2-impact',
            expectedMode: 'pre_mr',
            expectedAnalysisScope: 'AFFECTED'
        }
    );

    assert.match(errors.join('\n'), /Invalid analysisScope/);
    assert.match(errors.join('\n'), /Invalid auditLogPath/);
    assert.match(errors.join('\n'), /Invalid type for evidence/);
});

test('sanitizes and falls back for invalid audit log paths', () => {
    const resolved = resolveAuditLogPath(
        '../not_allowed.md',
        'pre_mr',
        new Date('2026-04-29T12:00:00.000Z')
    );

    assert.equal(resolved, '.testmate\\logs\\pre_mr_2026-04-29T12-00-00.md');
    assert.throws(() => resolveAuditLogPath('.testmate/logs/custom.md', 'tier-2-impact'), /formal modes/);
});
