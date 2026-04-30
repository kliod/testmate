import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const STATE_DIR = path.join('.testmate', 'state');
export const METRICS_PATH = path.join(STATE_DIR, 'metrics.jsonl');
export const EFFECTIVENESS_PATH = path.join(STATE_DIR, 'effectiveness.jsonl');

export const DECISION_STATUSES = ['PASS', 'WARNING', 'BLOCK', 'NEED_INFO'];
export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const ANALYSIS_SCOPES = ['DIFF', 'AFFECTED', 'FULL'];
export const FORMAL_MODES = ['pre_commit', 'pre_mr', 'pre_merge', 'pre_release'];

export const EFFECTIVENESS_EVENT_TYPES = [
    'coverage_gap_detected',
    'tests_added_after_decision',
    'manual_qa_added',
    'follow_up_fix_required',
    'follow_up_fix_completed',
    'decision_overridden',
    'waiver_used',
    'clarification_required',
    'clarification_resolved',
    'issue_prevented',
    'post_decision_action_taken',
    'release_drift_caught'
];

export const EFFECTIVENESS_MEANINGFULNESS = ['meaningful', 'not_meaningful', 'unknown'];

export const EFFECTIVENESS_REASON_CODES = [
    'coverage_gap',
    'test_added',
    'manual_qa_added',
    'false_positive',
    'accepted_risk',
    'urgent_hotfix',
    'covered_elsewhere',
    'infeasible_test',
    'duplicate',
    'policy_disagreement',
    'missing_context',
    'block_resolved',
    'clarification_resolved',
    'issue_prevented',
    'release_drift',
    'other'
];

export const REVIEW_MINUTES_SAVED_ESTIMATES = {
    coverage_gap_detected: [10, 20],
    tests_added_after_decision: [10, 20],
    clarification_resolved: [5, 15],
    follow_up_fix_completed: [15, 30],
    release_drift_caught: [20, 40]
};

export function ensureStateDir() {
    if (!existsSync(STATE_DIR)) {
        mkdirSync(STATE_DIR, { recursive: true });
    }
}

function appendJsonLine(filePath, record) {
    ensureStateDir();
    appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

export function readJsonLines(filePath) {
    if (!existsSync(filePath)) return [];

    return readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                return {
                    recordType: 'invalid_jsonl_record',
                    sourcePath: filePath,
                    lineNumber: index + 1,
                    error: error.message
                };
            }
        });
}

function countBy(items, getKey, allowedKeys = []) {
    const counts = Object.fromEntries(allowedKeys.map(key => [key, 0]));
    for (const item of items) {
        const key = getKey(item);
        if (!key) continue;
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}

function uniqueCount(values) {
    return new Set(values.filter(Boolean)).size;
}

function ratio(numerator, denominator) {
    if (!denominator) return null;
    return Number((numerator / denominator).toFixed(4));
}

function percent(value) {
    if (value === null) return 'n/a';
    return `${Math.round(value * 100)}%`;
}

function share(count, total) {
    return total ? percent(count / total) : 'n/a';
}

function basis(numerator, denominator, label) {
    return denominator ? `${numerator} of ${denominator} ${label}` : `0 of 0 ${label}`;
}

function recordTime(record) {
    const timestamp = record.timestamp || record.actionAt || record.completedAt || record.startedAt;
    const time = timestamp ? new Date(timestamp).getTime() : NaN;
    return Number.isNaN(time) ? null : time;
}

function filterByDays(records, days, now = new Date()) {
    if (!days) return records;
    const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
    return records.filter(record => {
        const time = recordTime(record);
        return time === null || time >= cutoff;
    });
}

function normalizeDays(days) {
    if (days === null || days === undefined || days === '') return null;
    const parsed = Number(days);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`--days must be a positive number. Received: ${days}`);
    }
    return parsed;
}

function normalizeMeaningfulness(meaningfulness) {
    if (meaningfulness === true || meaningfulness === 'true' || meaningfulness === 'meaningful') {
        return 'meaningful';
    }
    if (meaningfulness === false || meaningfulness === 'false' || meaningfulness === 'not_meaningful') {
        return 'not_meaningful';
    }
    if (meaningfulness === undefined || meaningfulness === null || meaningfulness === '' || meaningfulness === 'unknown') {
        return 'unknown';
    }
    throw new Error(`Unsupported meaningfulness value: ${meaningfulness}`);
}

function hasQualityMetadata(event) {
    return Boolean(
        event.reasonCode
        || event.evidenceLink
        || event.followUpIssue
        || event.reviewedBy
    );
}

function sumNumber(records, getValue) {
    return records.reduce((total, record) => {
        const value = getValue(record);
        return Number.isFinite(value) ? total + value : total;
    }, 0);
}

function countPresent(records, getValue) {
    return records.filter(record => {
        const value = getValue(record);
        return value !== null && value !== undefined && value !== '';
    }).length;
}

export function createRuntimeRecord({
    parsedData,
    mode,
    analysisScope,
    startedAt,
    completedAt = new Date(),
    auditLogPath,
    changedFilesCount,
    toolErrorsCount = 0,
    model = null,
    apiProvider = 'openai',
    inputTokens = null,
    outputTokens = null,
    cachedInputTokens = null,
    totalTokens = null,
    estimatedModelCostUsd = null,
    actualModelCostUsd = null
}) {
    const completedDate = completedAt instanceof Date ? completedAt : new Date(completedAt);
    const startedDate = startedAt instanceof Date ? startedAt : new Date(startedAt);
    const resolvedMode = FORMAL_MODES.includes(parsedData.mode) ? parsedData.mode : mode;
    const resolvedAnalysisScope = ANALYSIS_SCOPES.includes(parsedData.analysisScope) ? parsedData.analysisScope : analysisScope;

    return {
        recordType: 'runtime_run',
        schemaVersion: 1,
        runId: parsedData.runId || randomUUID(),
        timestamp: completedDate.toISOString(),
        mode: resolvedMode,
        analysisScope: resolvedAnalysisScope,
        decisionStatus: parsedData.status,
        riskLevel: parsedData.riskLevel,
        durationMs: Math.max(0, completedDate.getTime() - startedDate.getTime()),
        schemaValid: DECISION_STATUSES.includes(parsedData.status)
            && FORMAL_MODES.includes(resolvedMode)
            && ANALYSIS_SCOPES.includes(resolvedAnalysisScope)
            && RISK_LEVELS.includes(parsedData.riskLevel),
        auditLogPath,
        changedFilesCount,
        toolErrorsCount,
        apiProvider,
        model,
        inputTokens,
        outputTokens,
        cachedInputTokens,
        totalTokens,
        estimatedModelCostUsd,
        actualModelCostUsd
    };
}

export function recordRuntimeRun(record) {
    appendJsonLine(METRICS_PATH, record);
}

export function createEffectivenessEvent({
    eventType,
    runId,
    decisionStatus,
    source = 'manual',
    meaningfulness = 'unknown',
    preMerge = null,
    notes = '',
    reasonCode = null,
    evidenceLink = null,
    followUpIssue = null,
    reviewedBy = null
}) {
    if (!EFFECTIVENESS_EVENT_TYPES.includes(eventType)) {
        throw new Error(`Unsupported effectiveness event type: ${eventType}`);
    }
    if (decisionStatus && !DECISION_STATUSES.includes(decisionStatus)) {
        throw new Error(`Unsupported decision status: ${decisionStatus}`);
    }
    const normalizedMeaningfulness = normalizeMeaningfulness(meaningfulness);
    if (reasonCode && !EFFECTIVENESS_REASON_CODES.includes(reasonCode)) {
        throw new Error(`Unsupported reason code: ${reasonCode}`);
    }

    return {
        recordType: 'effectiveness_event',
        schemaVersion: 2,
        eventId: randomUUID(),
        runId: runId || null,
        timestamp: new Date().toISOString(),
        decisionStatus: decisionStatus || null,
        eventType,
        source,
        meaningfulness: normalizedMeaningfulness,
        preMerge,
        reasonCode,
        evidenceLink,
        followUpIssue,
        reviewedBy,
        notes
    };
}

export function recordEffectivenessEvent(event) {
    appendJsonLine(EFFECTIVENESS_PATH, event);
}

export function buildEffectivenessSummary({
    runtimeRecords = readJsonLines(METRICS_PATH),
    effectivenessEvents = readJsonLines(EFFECTIVENESS_PATH),
    days = null,
    now = new Date()
} = {}) {
    const normalizedDays = normalizeDays(days);
    const invalidRecordsCount = runtimeRecords.filter(record => record.recordType !== 'runtime_run').length
        + effectivenessEvents.filter(record => record.recordType !== 'effectiveness_event').length;
    const validRuntimeRuns = filterByDays(
        runtimeRecords.filter(record => record.recordType === 'runtime_run'),
        normalizedDays,
        now
    );
    const validEvents = filterByDays(
        effectivenessEvents.filter(record => record.recordType === 'effectiveness_event'),
        normalizedDays,
        now
    );

    const runsById = new Map(validRuntimeRuns.map(run => [run.runId, run]));
    const nonPassRuns = validRuntimeRuns.filter(run => run.decisionStatus && run.decisionStatus !== 'PASS');
    const followUpEventTypes = new Set([
        'tests_added_after_decision',
        'manual_qa_added',
        'follow_up_fix_required',
        'follow_up_fix_completed',
        'decision_overridden',
        'waiver_used',
        'clarification_resolved',
        'issue_prevented',
        'post_decision_action_taken',
        'release_drift_caught'
    ]);

    const nonPassRunIdsWithFollowUp = validEvents
        .filter(event => followUpEventTypes.has(event.eventType))
        .map(event => {
            const run = runsById.get(event.runId);
            return run && run.decisionStatus !== 'PASS' ? event.runId : null;
        });

    const estimatedValue = validEvents.reduce((total, event) => {
        const estimate = REVIEW_MINUTES_SAVED_ESTIMATES[event.eventType];
        if (!estimate) return total;
        return {
            reviewMinutesSavedMin: total.reviewMinutesSavedMin + estimate[0],
            reviewMinutesSavedMax: total.reviewMinutesSavedMax + estimate[1]
        };
    }, { reviewMinutesSavedMin: 0, reviewMinutesSavedMax: 0 });

    const warningRuns = validRuntimeRuns.filter(run => run.decisionStatus === 'WARNING');
    const warningRunIdsWithTestsOrManualQa = validEvents
        .filter(event => ['tests_added_after_decision', 'manual_qa_added'].includes(event.eventType))
        .map(event => {
            const run = runsById.get(event.runId);
            return run?.decisionStatus === 'WARNING' ? event.runId : null;
        });
    const measuredOutcomes = {
        nonPassRuns: nonPassRuns.length,
        nonPassRunsWithFollowUp: uniqueCount(nonPassRunIdsWithFollowUp),
        warningRunsWithTestsOrManualQa: uniqueCount(warningRunIdsWithTestsOrManualQa),
        testsAddedAfterDecision: validEvents.filter(event => event.eventType === 'tests_added_after_decision').length,
        manualQaAdded: validEvents.filter(event => event.eventType === 'manual_qa_added').length,
        resolvedBlocks: validEvents.filter(event => {
            const run = runsById.get(event.runId);
            return event.eventType === 'follow_up_fix_completed' && run?.decisionStatus === 'BLOCK';
        }).length,
        resolvedClarifications: validEvents.filter(event => {
            const run = runsById.get(event.runId);
            return event.eventType === 'clarification_resolved' && run?.decisionStatus === 'NEED_INFO';
        }).length,
        overrides: validEvents.filter(event => event.eventType === 'decision_overridden').length,
        waivers: validEvents.filter(event => event.eventType === 'waiver_used').length,
        meaningfulEvents: validEvents.filter(event => event.meaningfulness === 'meaningful' || event.meaningfulness === true).length,
        notMeaningfulEvents: validEvents.filter(event => event.meaningfulness === 'not_meaningful' || event.meaningfulness === false).length,
        unknownMeaningfulnessEvents: validEvents.filter(event => !event.meaningfulness || event.meaningfulness === 'unknown').length,
        eventsWithReason: validEvents.filter(event => Boolean(event.reasonCode)).length,
        eventsWithEvidenceLink: validEvents.filter(event => Boolean(event.evidenceLink)).length,
        eventsWithFollowUpIssue: validEvents.filter(event => Boolean(event.followUpIssue)).length,
        eventsReviewed: validEvents.filter(event => Boolean(event.reviewedBy)).length,
        eventsWithQualityMetadata: validEvents.filter(hasQualityMetadata).length
    };
    const blockRuns = validRuntimeRuns.filter(run => run.decisionStatus === 'BLOCK');
    const needInfoRuns = validRuntimeRuns.filter(run => run.decisionStatus === 'NEED_INFO');

    const measuredRatios = {
        nonPassActionConversionRate: ratio(measuredOutcomes.nonPassRunsWithFollowUp, measuredOutcomes.nonPassRuns),
        blockFollowUpCompletionRate: ratio(measuredOutcomes.resolvedBlocks, blockRuns.length),
        warningTestOrManualQaFollowThroughRate: ratio(measuredOutcomes.warningRunsWithTestsOrManualQa, warningRuns.length),
        needInfoResolutionRate: ratio(measuredOutcomes.resolvedClarifications, needInfoRuns.length),
        overrideRate: ratio(measuredOutcomes.overrides, validRuntimeRuns.length),
        waiverRate: ratio(measuredOutcomes.waivers, validRuntimeRuns.length)
    };
    const eventQualityRatios = {
        meaningfulEventRate: ratio(measuredOutcomes.meaningfulEvents, validEvents.length),
        reasonCodeCoverageRate: ratio(measuredOutcomes.eventsWithReason, validEvents.length),
        evidenceLinkCoverageRate: ratio(measuredOutcomes.eventsWithEvidenceLink, validEvents.length),
        followUpIssueCoverageRate: ratio(measuredOutcomes.eventsWithFollowUpIssue, validEvents.length),
        reviewedEventRate: ratio(measuredOutcomes.eventsReviewed, validEvents.length),
        qualityMetadataCoverageRate: ratio(measuredOutcomes.eventsWithQualityMetadata, validEvents.length)
    };
    const costTelemetry = {
        runsWithModel: countPresent(validRuntimeRuns, run => run.model),
        runsWithTokenUsage: countPresent(validRuntimeRuns, run => run.totalTokens),
        inputTokens: sumNumber(validRuntimeRuns, run => run.inputTokens),
        outputTokens: sumNumber(validRuntimeRuns, run => run.outputTokens),
        cachedInputTokens: sumNumber(validRuntimeRuns, run => run.cachedInputTokens),
        totalTokens: sumNumber(validRuntimeRuns, run => run.totalTokens),
        estimatedModelCostUsd: sumNumber(validRuntimeRuns, run => run.estimatedModelCostUsd),
        actualModelCostUsd: sumNumber(validRuntimeRuns, run => run.actualModelCostUsd)
    };

    return {
        summaryVersion: 2,
        timeWindow: normalizedDays ? { days: normalizedDays, generatedAt: now.toISOString() } : { days: null, generatedAt: now.toISOString() },
        totalRuns: validRuntimeRuns.length,
        decisionCounts: countBy(validRuntimeRuns, run => run.decisionStatus, DECISION_STATUSES),
        riskCounts: countBy(validRuntimeRuns, run => run.riskLevel, RISK_LEVELS),
        eventCounts: countBy(validEvents, event => event.eventType, EFFECTIVENESS_EVENT_TYPES),
        measuredOutcomes,
        measuredRatios,
        eventQualityRatios,
        costTelemetry,
        estimatedValue,
        invalidRecordsCount,
        interpretation: buildInterpretation({
            validEvents,
            measuredOutcomes,
            measuredRatios
        }),
        notes: [
            'Counts are based on local append-only TestMate state records.',
            'Estimated value is heuristic and must not be interpreted as financial ROI.',
            'Cost telemetry records model and token usage when the provider returns it; missing values are left null rather than guessed.',
            'Event quality fields such as reasonCode, evidenceLink, followUpIssue, and reviewedBy improve attribution but are not required for legacy records.',
            validEvents.length === 0
                ? 'No effectiveness events are recorded yet. Use --record-effectiveness-event=<event_type> to start tracking outcomes.'
                : 'Effectiveness events are explicit follow-up records, not proof of avoided defects by themselves.'
        ]
    };
}

export function buildInterpretation({ validEvents, measuredOutcomes, measuredRatios }) {
    const lines = [];
    if (validEvents.length === 0) {
        lines.push('No follow-up outcomes are recorded yet, so effectiveness is still an empty baseline.');
    }
    if (measuredRatios.nonPassActionConversionRate !== null) {
        lines.push(`Non-PASS action conversion is ${percent(measuredRatios.nonPassActionConversionRate)}.`);
    }
    if (measuredOutcomes.testsAddedAfterDecision > 0 || measuredOutcomes.manualQaAdded > 0) {
        lines.push('Some decisions led to tests or manual QA, which is an early behavior-change signal.');
    }
    if (measuredOutcomes.overrides > 0) {
        lines.push('Overrides are present; review reasons before treating them as false positives.');
    }
    if (measuredOutcomes.waivers > 0) {
        lines.push('Waivers are present; review expiry and follow-up discipline before counting them as resolved risk.');
    }
    if (validEvents.length > 0 && measuredOutcomes.eventsWithReason === 0) {
        lines.push('No reason codes are recorded yet; waiver and override interpretation remains weak.');
    }
    if (lines.length === 0) {
        lines.push('Recorded outcomes are present, but no stronger interpretation is available yet.');
    }
    return lines;
}

export function renderEffectivenessMarkdown(summary) {
    const windowLabel = summary.timeWindow.days ? `last ${summary.timeWindow.days} days` : 'all local records';
    const decisionRows = DECISION_STATUSES.map(status => {
        const count = summary.decisionCounts[status] ?? 0;
        return `| ${status} | ${count} | ${share(count, summary.totalRuns)} |`;
    });
    const eventRows = Object.entries(summary.eventCounts)
        .filter(([, count]) => count > 0)
        .map(([eventType, count]) => `| \`${eventType}\` | ${count} | measured |`);
    const confidence = getDataConfidence(summary);
    const nonPassRuns = summary.measuredOutcomes.nonPassRuns;
    const blockRuns = summary.decisionCounts.BLOCK ?? 0;
    const warningRuns = summary.decisionCounts.WARNING ?? 0;
    const needInfoRuns = summary.decisionCounts.NEED_INFO ?? 0;
    const estimatedConfidence = summary.estimatedValue.reviewMinutesSavedMax > 0
        ? confidence.estimatedValueConfidence
        : 'n/a';
    const qualityRows = [
        `| Meaningful events | ${percent(summary.eventQualityRatios.meaningfulEventRate)} | ${basis(summary.measuredOutcomes.meaningfulEvents, Object.values(summary.eventCounts).reduce((total, count) => total + count, 0), 'events')} | measured |`,
        `| Reason code coverage | ${percent(summary.eventQualityRatios.reasonCodeCoverageRate)} | ${basis(summary.measuredOutcomes.eventsWithReason, Object.values(summary.eventCounts).reduce((total, count) => total + count, 0), 'events')} | measured |`,
        `| Evidence link coverage | ${percent(summary.eventQualityRatios.evidenceLinkCoverageRate)} | ${basis(summary.measuredOutcomes.eventsWithEvidenceLink, Object.values(summary.eventCounts).reduce((total, count) => total + count, 0), 'events')} | measured |`,
        `| Follow-up issue coverage | ${percent(summary.eventQualityRatios.followUpIssueCoverageRate)} | ${basis(summary.measuredOutcomes.eventsWithFollowUpIssue, Object.values(summary.eventCounts).reduce((total, count) => total + count, 0), 'events')} | measured |`,
        `| Reviewed event rate | ${percent(summary.eventQualityRatios.reviewedEventRate)} | ${basis(summary.measuredOutcomes.eventsReviewed, Object.values(summary.eventCounts).reduce((total, count) => total + count, 0), 'events')} | measured |`
    ];
    const costRows = [
        `| Runs with model | ${summary.costTelemetry.runsWithModel} | ${basis(summary.costTelemetry.runsWithModel, summary.totalRuns, 'formal runs')} | measured |`,
        `| Runs with token usage | ${summary.costTelemetry.runsWithTokenUsage} | ${basis(summary.costTelemetry.runsWithTokenUsage, summary.totalRuns, 'formal runs')} | measured |`,
        `| Input tokens | ${summary.costTelemetry.inputTokens} | Provider usage payload | measured |`,
        `| Output tokens | ${summary.costTelemetry.outputTokens} | Provider usage payload | measured |`,
        `| Cached input tokens | ${summary.costTelemetry.cachedInputTokens} | Provider usage payload when available | measured |`,
        `| Total tokens | ${summary.costTelemetry.totalTokens} | Provider usage payload | measured |`,
        `| Estimated model cost | ${summary.costTelemetry.estimatedModelCostUsd} USD | Explicit estimate field only | estimated |`,
        `| Actual model cost | ${summary.costTelemetry.actualModelCostUsd} USD | Explicit actual cost field only | measured |`
    ];

    return [
        '# TestMate Effectiveness Summary',
        '',
        '## Executive Summary',
        '',
        ...buildExecutiveSummary(summary).map(line => `- ${line}`),
        '',
        '## Scope And Data Window',
        '',
        '| Field | Value |',
        '| --- | --- |',
        `| Time window | ${windowLabel} |`,
        `| Generated at | ${summary.timeWindow.generatedAt} |`,
        '| Runtime source | `.testmate/state/metrics.jsonl` |',
        '| Outcome source | `.testmate/state/effectiveness.jsonl` |',
        '| Data mode | Local append-only records |',
        '',
        '## Decision Distribution',
        '',
        '| Decision | Count | Share |',
        '| --- | ---: | ---: |',
        ...decisionRows,
        '',
        '## KPI Scorecard',
        '',
        '| KPI | Value | Basis | Type |',
        '| --- | ---: | --- | --- |',
        `| Non-PASS action conversion | ${percent(summary.measuredRatios.nonPassActionConversionRate)} | ${basis(summary.measuredOutcomes.nonPassRunsWithFollowUp, nonPassRuns, 'non-PASS runs')} | measured |`,
        `| BLOCK follow-up completion | ${percent(summary.measuredRatios.blockFollowUpCompletionRate)} | ${basis(summary.measuredOutcomes.resolvedBlocks, blockRuns, 'BLOCK runs')} | measured |`,
        `| WARNING test/manual QA follow-through | ${percent(summary.measuredRatios.warningTestOrManualQaFollowThroughRate)} | ${basis(summary.measuredOutcomes.warningRunsWithTestsOrManualQa ?? 0, warningRuns, 'WARNING runs')} | measured |`,
        `| NEED_INFO resolution | ${percent(summary.measuredRatios.needInfoResolutionRate)} | ${basis(summary.measuredOutcomes.resolvedClarifications, needInfoRuns, 'NEED_INFO runs')} | measured |`,
        `| Override rate | ${percent(summary.measuredRatios.overrideRate)} | ${basis(summary.measuredOutcomes.overrides, summary.totalRuns, 'formal runs')} | measured |`,
        `| Waiver rate | ${percent(summary.measuredRatios.waiverRate)} | ${basis(summary.measuredOutcomes.waivers, summary.totalRuns, 'formal runs')} | measured |`,
        '',
        '## Outcome Event Summary',
        '',
        eventRows.length
            ? '| Event Type | Count | Type |'
            : 'No effectiveness outcome events are recorded for this period.',
        ...(eventRows.length ? ['| --- | ---: | --- |', ...eventRows] : []),
        '',
        '## Event Quality',
        '',
        '| Metric | Value | Basis | Type |',
        '| --- | ---: | --- | --- |',
        ...qualityRows,
        '',
        '## Cost Telemetry',
        '',
        '| Metric | Value | Basis | Type |',
        '| --- | ---: | --- | --- |',
        ...costRows,
        '',
        '## Estimated Operational Value',
        '',
        '| Estimate | Range | Basis | Confidence |',
        '| --- | ---: | --- | --- |',
        `| Review minutes saved | ${summary.estimatedValue.reviewMinutesSavedMin}-${summary.estimatedValue.reviewMinutesSavedMax} min | Event-type heuristic ranges | ${estimatedConfidence} |`,
        '',
        '## Data Confidence And Limitations',
        '',
        '| Item | Assessment |',
        '| --- | --- |',
        `| Data maturity | ${confidence.dataMaturity} |`,
        `| Sample size | ${summary.totalRuns} formal runs |`,
        '| Outcome attribution | Explicitly recorded follow-up events only |',
        '| Estimated value | Heuristic, not financial ROI |',
        `| Invalid local records | ${summary.invalidRecordsCount} |`,
        `| Known limitation | ${confidence.knownLimitation} |`,
        '',
        '## Governance Notes',
        '',
        '- The report is based on local append-only TestMate records.',
        '- The report excludes raw prompts, raw diffs, secrets, and customer payloads.',
        '- Estimated values are heuristic and should not be used as financial ROI.',
        '- Effectiveness events are explicit follow-up records, not proof of avoided defects.',
        '- Overrides and waivers require reason taxonomy before they can be used as quality conclusions.'
    ].join('\n');
}

export function buildExecutiveSummary(summary) {
    if (summary.totalRuns === 0) {
        return [
            'No formal TestMate effectiveness data is recorded for this period.',
            'The report is ready to display metrics once formal runs and follow-up events are recorded.',
            'No effectiveness or value conclusions should be drawn yet.'
        ];
    }

    if (summary.measuredOutcomes.nonPassRuns > 0 && summary.measuredOutcomes.nonPassRunsWithFollowUp === 0) {
        return [
            `TestMate recorded ${summary.totalRuns} formal quality-gate runs in the selected period.`,
            `${summary.measuredOutcomes.nonPassRuns} runs produced non-PASS decisions, but no follow-up outcome events are recorded yet.`,
            'Decision distribution can be reported, but downstream effectiveness conclusions are not mature.',
            `Data maturity is ${getDataConfidence(summary).dataMaturity.toLowerCase()}.`
        ];
    }

    return [
        `TestMate recorded ${summary.totalRuns} formal quality-gate runs in the selected period.`,
        `${summary.measuredOutcomes.nonPassRuns} runs produced non-PASS decisions; ${summary.measuredOutcomes.nonPassRunsWithFollowUp} had recorded follow-up outcomes.`,
        `The strongest measured signals are ${describeStrongestSignals(summary)}.`,
        `Data maturity is ${getDataConfidence(summary).dataMaturity.toLowerCase()}; estimated value remains heuristic, not ROI.`
    ];
}

export function getDataConfidence(summary) {
    if (summary.totalRuns === 0) {
        return {
            dataMaturity: 'Empty',
            estimatedValueConfidence: 'n/a',
            knownLimitation: 'No formal runs are available for this period.'
        };
    }
    if (summary.totalRuns < 20) {
        return {
            dataMaturity: 'Early',
            estimatedValueConfidence: summary.estimatedValue.reviewMinutesSavedMax > 0 ? 'Low' : 'n/a',
            knownLimitation: 'Small sample size and follow-up quality are not yet manually reviewed.'
        };
    }
    if (summary.totalRuns < 100) {
        return {
            dataMaturity: 'Developing',
            estimatedValueConfidence: summary.estimatedValue.reviewMinutesSavedMax > 0 ? 'Medium' : 'n/a',
            knownLimitation: 'Outcome attribution depends on explicit follow-up records and may miss unrecorded actions.'
        };
    }
    return {
        dataMaturity: 'Mature',
        estimatedValueConfidence: summary.estimatedValue.reviewMinutesSavedMax > 0 ? 'Medium' : 'n/a',
        knownLimitation: 'Estimated value still requires sampling or incident taxonomy before ROI claims.'
    };
}

function describeStrongestSignals(summary) {
    const signals = [
        ['tests added after decisions', summary.measuredOutcomes.testsAddedAfterDecision],
        ['manual QA additions', summary.measuredOutcomes.manualQaAdded],
        ['resolved BLOCK cases', summary.measuredOutcomes.resolvedBlocks],
        ['resolved clarification loops', summary.measuredOutcomes.resolvedClarifications],
        ['release drift catches', summary.eventCounts.release_drift_caught]
    ]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([label, count]) => `${label} (${count})`);

    return signals.length ? signals.join(' and ') : 'not yet visible from recorded outcomes';
}
