import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildPreflightSummary,
    detectFocusedOrSkippedTests,
    parseChangedFiles,
    validateQualityGateOutput
} from './testmate-core.mjs';

export const DEFAULT_FIXTURES_DIR = path.join('fixtures', 'golden');

export function loadGoldenFixtures(fixturesDir = DEFAULT_FIXTURES_DIR) {
    if (!existsSync(fixturesDir)) return [];
    return readdirSync(fixturesDir)
        .filter(fileName => fileName.endsWith('.json'))
        .sort()
        .map(fileName => {
            const filePath = path.join(fixturesDir, fileName);
            return {
                filePath,
                ...JSON.parse(readFileSync(filePath, 'utf8'))
            };
        });
}

function createVirtualFileReader(files = {}) {
    return {
        exists(filePath) {
            const normalized = filePath.replace(/\\/g, '/');
            return Object.hasOwn(files, normalized);
        },
        readFile(filePath) {
            const normalized = filePath.replace(/\\/g, '/');
            if (!Object.hasOwn(files, normalized)) {
                throw new Error(`Virtual file not found: ${normalized}`);
            }
            return files[normalized];
        }
    };
}

export function replayGoldenFixture(fixture, schema) {
    const modeConfig = fixture.modeConfig;
    const changedFiles = parseChangedFiles(fixture.diff || '');
    const toolErrors = [];
    const virtualFiles = createVirtualFileReader(fixture.files || {});
    const focusedOrSkippedTests = detectFocusedOrSkippedTests({
        changedFiles,
        cwd: '',
        exists: virtualFiles.exists,
        readFile: virtualFiles.readFile,
        toolErrors
    });
    const preflightSummary = buildPreflightSummary({
        requestedMode: fixture.requestedMode,
        formalMode: modeConfig.formalMode,
        analysisScope: modeConfig.analysisScope,
        baseBranch: fixture.baseBranch || 'origin/main',
        changedFiles,
        packageJson: fixture.packageJson,
        focusedOrSkippedTests,
        testLogsProvided: Boolean(fixture.testLogsProvided),
        coverageSummaryProvided: Boolean(fixture.coverageSummaryProvided),
        toolErrors
    });
    const schemaDecision = normalizeFixtureDecisionForSchema(fixture.expectedDecision);
    const contractErrors = validateQualityGateOutput(schemaDecision, schema, {
        requestedMode: fixture.requestedMode,
        expectedMode: modeConfig.formalMode,
        expectedAnalysisScope: modeConfig.analysisScope
    });

    return {
        fixtureId: fixture.id,
        filePath: fixture.filePath,
        preflightSummary,
        contractErrors,
        passed: contractErrors.length === 0
            && matchesExpectedPreflight(preflightSummary, fixture.expectedPreflight || {})
            && matchesExpectedDecision(fixture.expectedDecision, fixture.expectedLabels || {})
    };
}

export function matchesExpectedPreflight(preflightSummary, expectedPreflight) {
    if (expectedPreflight.changedFiles) {
        for (const filePath of expectedPreflight.changedFiles) {
            if (!preflightSummary.changedFiles.includes(filePath)) return false;
        }
    }
    if (expectedPreflight.detectedTestRunners) {
        for (const runner of expectedPreflight.detectedTestRunners) {
            if (!preflightSummary.detectedTestRunners.includes(runner)) return false;
        }
    }
    if (expectedPreflight.detectedFrameworks) {
        for (const framework of expectedPreflight.detectedFrameworks) {
            if (!preflightSummary.detectedFrameworks.includes(framework)) return false;
        }
    }
    if (expectedPreflight.focusedOrSkippedTypes) {
        const actualTypes = preflightSummary.focusedOrSkippedTests.map(item => item.type);
        for (const type of expectedPreflight.focusedOrSkippedTypes) {
            if (!actualTypes.includes(type)) return false;
        }
    }
    return true;
}

export function matchesExpectedDecision(decision, expectedLabels) {
    if (expectedLabels.status && decision.status !== expectedLabels.status) return false;
    if (expectedLabels.riskLevel && decision.riskLevel !== expectedLabels.riskLevel) return false;
    if (expectedLabels.policyRulesTriggered) {
        if (!Array.isArray(decision.policyRulesTriggered)) return false;
        for (const rule of expectedLabels.policyRulesTriggered) {
            if (!decision.policyRulesTriggered.includes(rule)) return false;
        }
    }
    return true;
}

export function normalizeFixtureDecisionForSchema(decision) {
    const {
        policyRulesTriggered,
        evidence,
        waivers,
        overrides,
        ...schemaDecision
    } = decision;

    schemaDecision.decisionFactors ||= {
        impact: decision.riskLevel,
        likelihood: decision.status === 'PASS' ? 0.1 : 0.7,
        confidence: 0.8,
        coverageGap: decision.status === 'BLOCK' ? 'BLOCKING' : decision.missingCoverage?.length ? 'MATERIAL' : 'NONE',
        businessCriticality: decision.riskLevel
    };
    schemaDecision.findings ||= (decision.blockers || []).map(blocker => ({
        severity: 'BLOCK',
        agent: decision.subagentsRun?.[0] || 'TestMate',
        evidence: blocker,
        confidence: 0.8,
        recommendedAction: decision.recommendedTests?.[0] || 'Add meaningful coverage or document a waiver.'
    }));
    schemaDecision.skippedAgents ||= [];
    schemaDecision.interaction ||= {
        state: decision.status === 'NEED_INFO' ? 'need_info' : 'complete',
        blockedDecision: '',
        resumeToken: '',
        answersExpected: [],
        receivedAnswers: []
    };
    schemaDecision.metrics ||= {};
    if (schemaDecision.auditLogPath?.startsWith('logs/')) {
        schemaDecision.auditLogPath = `.testmate/${schemaDecision.auditLogPath}`;
    }

    return schemaDecision;
}

export function replayGoldenFixtures({ fixturesDir = DEFAULT_FIXTURES_DIR, schema }) {
    return loadGoldenFixtures(fixturesDir).map(fixture => replayGoldenFixture(fixture, schema));
}

export function summarizeReplayResults(results) {
    const failed = results.filter(result => !result.passed);
    return {
        total: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
        failedFixtureIds: failed.map(result => result.fixtureId)
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const schema = JSON.parse(readFileSync(path.join('.testmate', 'ai-quality-output.schema.json'), 'utf8'));
    const results = replayGoldenFixtures({ schema });
    const summary = summarizeReplayResults(results);
    console.log(JSON.stringify({ summary, results }, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
}
