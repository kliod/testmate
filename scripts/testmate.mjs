#!/usr/bin/env node
/**
 * TestMate Unified Runner for CI/CD and Git Hooks.
 *
 * Usage:
 *   node scripts/testmate.mjs pre_mr
 *   node scripts/testmate.mjs tier-2-impact
 */

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildEffectivenessSummary,
    createEffectivenessEvent,
    createRuntimeRecord,
    renderEffectivenessMarkdown,
    recordEffectivenessEvent,
    recordRuntimeRun
} from './effectiveness.mjs';
import {
    FORMAL_MODES,
    MODE_CONFIG,
    buildPreflightSummary,
    detectFocusedOrSkippedTests,
    parseChangedFiles,
    resolveAuditLogPath,
    validateQualityGateOutput
} from './testmate-core.mjs';
import {
    DEFAULT_FIXTURES_DIR,
    replayGoldenFixtures,
    summarizeReplayResults
} from './testmate-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const requestedMode = process.argv[2] || 'tier-1-targeted';
const modeConfig = MODE_CONFIG[requestedMode];
const mode = modeConfig?.formalMode || requestedMode;
const apiKey = process.env.OPENAI_API_KEY;
const startedAt = new Date();
const selectedModel = process.env.AI_MODEL || 'gpt-4o';

let testLogsPath = null;
let coverageSummaryPath = null;
let baseBranch = 'origin/main';
let showEffectiveness = false;
let replayFixtures = false;
let fixturesDir = DEFAULT_FIXTURES_DIR;
let recordEffectivenessEventType = null;
let recordRunId = null;
let recordDecisionStatus = null;
let recordSource = 'manual';
let recordMeaningfulness = 'unknown';
let recordPreMerge = null;
let recordNotes = '';
let recordReasonCode = null;
let recordEvidenceLink = null;
let recordFollowUpIssue = null;
let recordReviewedBy = null;
let effectivenessFormat = 'json';
let effectivenessDays = null;

process.argv.forEach(arg => {
    if (arg.startsWith('--test-logs=')) testLogsPath = arg.split('=')[1];
    if (arg.startsWith('--coverage-summary=')) coverageSummaryPath = arg.split('=')[1];
    if (arg.startsWith('--base-branch=')) baseBranch = arg.split('=')[1];
    if (arg === '--show-effectiveness') showEffectiveness = true;
    if (arg === '--replay-fixtures') replayFixtures = true;
    if (arg.startsWith('--fixtures-dir=')) fixturesDir = arg.split('=')[1];
    if (arg.startsWith('--record-effectiveness-event=')) recordEffectivenessEventType = arg.split('=')[1];
    if (arg.startsWith('--run-id=')) recordRunId = arg.split('=')[1];
    if (arg.startsWith('--decision-status=')) recordDecisionStatus = arg.split('=')[1];
    if (arg.startsWith('--source=')) recordSource = arg.split('=')[1];
    if (arg.startsWith('--meaningfulness=')) recordMeaningfulness = arg.split('=')[1];
    if (arg.startsWith('--pre-merge=')) recordPreMerge = arg.split('=')[1] === 'true';
    if (arg.startsWith('--notes=')) recordNotes = arg.split('=').slice(1).join('=');
    if (arg.startsWith('--reason-code=')) recordReasonCode = arg.split('=')[1];
    if (arg.startsWith('--evidence-link=')) recordEvidenceLink = arg.split('=').slice(1).join('=');
    if (arg.startsWith('--follow-up-issue=')) recordFollowUpIssue = arg.split('=').slice(1).join('=');
    if (arg.startsWith('--reviewed-by=')) recordReviewedBy = arg.split('=')[1];
    if (arg.startsWith('--format=')) effectivenessFormat = arg.split('=')[1];
    if (arg.startsWith('--days=')) effectivenessDays = arg.split('=')[1];
});

if (showEffectiveness) {
    try {
        const summary = buildEffectivenessSummary({ days: effectivenessDays });
        if (effectivenessFormat === 'markdown') {
            console.log(renderEffectivenessMarkdown(summary));
        } else if (effectivenessFormat === 'json') {
            console.log(JSON.stringify(summary, null, 2));
        } else {
            console.error(`Unsupported effectiveness format: ${effectivenessFormat}`);
            process.exit(1);
        }
    } catch (error) {
        console.error(`Could not show effectiveness summary: ${error.message}`);
        process.exit(1);
    }
    process.exit(0);
}

if (replayFixtures) {
    try {
        const outputSchema = JSON.parse(readFileSync(path.join(__dirname, './ai-quality-output.schema.json'), 'utf8'));
        const results = replayGoldenFixtures({ fixturesDir, schema: outputSchema });
        const summary = summarizeReplayResults(results);
        console.log(JSON.stringify({ summary, results }, null, 2));
        process.exit(summary.failed > 0 ? 1 : 0);
    } catch (error) {
        console.error(`Could not replay golden fixtures: ${error.message}`);
        process.exit(1);
    }
}

if (recordEffectivenessEventType) {
    try {
        const event = createEffectivenessEvent({
            eventType: recordEffectivenessEventType,
            runId: recordRunId,
            decisionStatus: recordDecisionStatus,
            source: recordSource,
            meaningfulness: recordMeaningfulness,
            preMerge: recordPreMerge,
            reasonCode: recordReasonCode,
            evidenceLink: recordEvidenceLink,
            followUpIssue: recordFollowUpIssue,
            reviewedBy: recordReviewedBy,
            notes: recordNotes
        });
        recordEffectivenessEvent(event);
        console.log(JSON.stringify(event, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(`Could not record effectiveness event: ${error.message}`);
        process.exit(1);
    }
}

if (!modeConfig) {
    console.error(`Unsupported TestMate mode: ${requestedMode}`);
    console.error(`Supported modes: ${Object.keys(MODE_CONFIG).join(', ')}`);
    process.exit(1);
}

baseBranch = baseBranch !== 'origin/main'
    ? baseBranch
    : (process.env.TARGET_BRANCH || process.env.GITHUB_BASE_REF || 'origin/main');

console.log(`\nAssessing quality using TestMate [${requestedMode} -> ${mode}]...`);
console.log(`Base branch: ${baseBranch}`);
console.log();

if (!apiKey) {
    console.error('OPENAI_API_KEY is not set.');
    console.error('Please provide an API key to execute the Orchestrator.');
    process.exit(1);
}

let diff = '';
const toolErrors = [];
try {
    diff = execFileSync('git', ['diff', baseBranch]).toString();
} catch {
    console.warn(`git diff against ${baseBranch} failed. Falling back to staged/HEAD.`);
    toolErrors.push(`git diff against ${baseBranch} failed`);
    try {
        diff = execSync('git diff --cached').toString() || execSync('git diff HEAD').toString();
    } catch {
        console.warn('All git diff attempts failed. Proceeding with empty diff.');
        toolErrors.push('all git diff attempts failed');
        diff = 'No git diff available (non-git environment or no changes).';
    }
}

function readPackageJson() {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (!existsSync(packagePath)) return null;
    try {
        return JSON.parse(readFileSync(packagePath, 'utf8'));
    } catch {
        toolErrors.push('package.json could not be parsed');
        return null;
    }
}

const changedFiles = parseChangedFiles(diff);
const changedFilesCount = diff
    .split(/\r?\n/)
    .filter(line => line.startsWith('diff --git '))
    .length;
const packageJson = readPackageJson();
const focusedOrSkippedTests = detectFocusedOrSkippedTests({
    changedFiles,
    cwd: process.cwd(),
    exists: existsSync,
    readFile: filePath => readFileSync(filePath, 'utf8'),
    toolErrors
});
const preflightSummary = buildPreflightSummary({
    requestedMode,
    formalMode: mode,
    analysisScope: modeConfig.analysisScope,
    baseBranch,
    changedFiles,
    packageJson,
    focusedOrSkippedTests,
    testLogsProvided: Boolean(testLogsPath),
    coverageSummaryProvided: Boolean(coverageSummaryPath),
    toolErrors
});

const promptContent = readFileSync(path.join(__dirname, `../prompts/${modeConfig.promptFile}`), 'utf8');
const orchestrator = readFileSync(path.join(__dirname, '../agents/web-testing-orchestrator.md'), 'utf8');
const outputSchema = JSON.parse(readFileSync(path.join(__dirname, './ai-quality-output.schema.json'), 'utf8'));

let testLogsContent = '';
if (testLogsPath) {
    try {
        testLogsContent = `\n\nHere are the CI Test Failure Logs:\n\`\`\`\n${readFileSync(testLogsPath, 'utf8')}\n\`\`\``;
        console.log(`Embedded test logs from ${testLogsPath}`);
    } catch {
        console.warn(`Could not read test logs at ${testLogsPath}`);
    }
}

let coverageContent = '';
if (coverageSummaryPath) {
    try {
        coverageContent = `\n\nHere is the Jest Coverage Summary payload:\n\`\`\`json\n${readFileSync(coverageSummaryPath, 'utf8')}\n\`\`\`\nIf line coverage for any modified file drops below threshold, FLAG IT AS A BLOCK.`;
        console.log(`Embedded coverage data from ${coverageSummaryPath}`);
    } catch {
        console.warn(`Could not read coverage at ${coverageSummaryPath}`);
    }
}

const payload = {
    model: selectedModel,
    messages: [
        { role: 'system', content: orchestrator },
        {
            role: 'user',
            content: [
                promptContent,
                '',
                `Resolved formal mode: ${mode}`,
                `Resolved analysis scope: ${modeConfig.analysisScope}`,
                `Audit log path must match: logs/${mode}_<timestamp>.md`,
                '',
                'Deterministic preflight summary:',
                '```json',
                JSON.stringify(preflightSummary, null, 2),
                '```',
                '',
                'Here is the diff:',
                '```diff',
                diff,
                '```',
                testLogsContent,
                coverageContent
            ].join('\n')
        }
    ],
    temperature: 0.1
};

async function requestQualityDecision(requestPayload) {
    if (process.env.TESTMATE_MOCK_OPENAI_RESPONSE) {
        return JSON.parse(process.env.TESTMATE_MOCK_OPENAI_RESPONSE);
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestPayload)
    });

    return res.json();
}

function normalizeContractData(parsedData) {
    return {
        ...parsedData
    };
}

function extractUsageTelemetry(data) {
    const usage = data.usage || {};
    return {
        inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? null,
        outputTokens: usage.completion_tokens ?? usage.output_tokens ?? null,
        cachedInputTokens: usage.prompt_tokens_details?.cached_tokens
            ?? usage.input_tokens_details?.cached_tokens
            ?? null,
        totalTokens: usage.total_tokens ?? null
    };
}

async function run() {
    try {
        const data = await requestQualityDecision(payload);
        const usageTelemetry = extractUsageTelemetry(data);
        const responseText = data.choices?.[0]?.message?.content;

        if (!responseText) {
            console.error('OpenAI response did not include message content.');
            process.exit(1);
        }

        const jsonMatch = responseText.match(/```json([\s\S]*?)```/);
        let parsedData = null;
        let markdownAudit = responseText;

        if (jsonMatch) {
            try {
                parsedData = JSON.parse(jsonMatch[1].trim());
                markdownAudit = responseText.replace(jsonMatch[0], '').trim();
            } catch {
                console.warn('Failed to parse orchestrator JSON.');
            }
        }

        if (!parsedData) {
            console.error('TestMate did not return a parseable JSON quality-gate contract.');
            console.error(responseText);
            process.exit(1);
        }

        parsedData = normalizeContractData(parsedData);
        const validationErrors = validateQualityGateOutput(parsedData, outputSchema, {
            requestedMode,
            expectedMode: mode,
            expectedAnalysisScope: modeConfig.analysisScope
        });
        if (validationErrors.length) {
            console.error('TestMate returned an invalid quality-gate contract:');
            validationErrors.forEach(error => console.error(`  - ${error}`));
            process.exit(1);
        }

        const auditLogPath = resolveAuditLogPath(parsedData.auditLogPath, parsedData.mode);
        const dir = path.dirname(auditLogPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        if (existsSync(auditLogPath)) {
            console.error(`Audit log already exists and must remain immutable: ${auditLogPath}`);
            process.exit(1);
        }

        writeFileSync(
            auditLogPath,
            [
                '# TestMate Audit Log',
                '',
                `## Run Date: ${new Date().toISOString()}`,
                '',
                '## Deterministic Preflight',
                '',
                '```json',
                JSON.stringify(preflightSummary, null, 2),
                '```',
                '',
                markdownAudit,
                ''
            ].join('\n'),
            'utf8'
        );
        console.log(`Audit log written to: ${auditLogPath}`);

        const runtimeRecord = createRuntimeRecord({
            parsedData,
            mode: parsedData.mode,
            analysisScope: parsedData.analysisScope,
            startedAt,
            completedAt: new Date(),
            auditLogPath,
            changedFilesCount,
            toolErrorsCount: toolErrors.length,
            model: selectedModel,
            apiProvider: 'openai',
            ...usageTelemetry
        });
        recordRuntimeRun(runtimeRecord);
        console.log(`Effectiveness runtime record: ${runtimeRecord.runId}`);

        if (parsedData.status === 'NEED_INFO') {
            console.error('\nTestMate stopped with NEED_INFO. Required context:');
            parsedData.questionsForUser.forEach((question, index) => {
                console.error(`  ${index + 1}. ${question}`);
            });
            process.exit(1);
        }

        if (parsedData.status === 'BLOCK') {
            console.error('\nTestMate BLOCKED this code change. Fix issues before proceeding.');
            process.exit(1);
        }

        console.log(`\nTestMate finished with ${parsedData.status}. Proceeding.`);
        process.exit(0);
    } catch (error) {
        console.error('Execution failed', error);
        process.exit(1);
    }
}

run();
