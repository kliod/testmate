import test from 'node:test';
import assert from 'node:assert/strict';
import {
    EFFECTIVENESS_EVENT_TYPES,
    EFFECTIVENESS_MEANINGFULNESS,
    EFFECTIVENESS_REASON_CODES,
    buildEffectivenessSummary,
    createEffectivenessEvent,
    createRuntimeRecord,
    renderEffectivenessMarkdown
} from './effectiveness.mjs';

test('creates a compact runtime record from a formal decision contract', () => {
    const startedAt = new Date('2026-04-28T00:00:00.000Z');
    const completedAt = new Date('2026-04-28T00:00:02.500Z');

    const record = createRuntimeRecord({
        parsedData: {
            mode: 'pre_mr',
            analysisScope: 'AFFECTED',
            status: 'WARNING',
            riskLevel: 'HIGH'
        },
        mode: 'tier-2-impact',
        analysisScope: 'AFFECTED',
        startedAt,
        completedAt,
        auditLogPath: 'logs/pre_mr_2026-04-28T00-00-00.md',
        changedFilesCount: 3,
        model: 'gpt-4o',
        inputTokens: 100,
        outputTokens: 25,
        cachedInputTokens: 10,
        totalTokens: 125,
        estimatedModelCostUsd: 0.01
    });

    assert.equal(record.recordType, 'runtime_run');
    assert.equal(record.schemaVersion, 1);
    assert.equal(record.mode, 'pre_mr');
    assert.equal(record.analysisScope, 'AFFECTED');
    assert.equal(record.decisionStatus, 'WARNING');
    assert.equal(record.riskLevel, 'HIGH');
    assert.equal(record.durationMs, 2500);
    assert.equal(record.schemaValid, true);
    assert.equal(record.changedFilesCount, 3);
    assert.equal(record.model, 'gpt-4o');
    assert.equal(record.inputTokens, 100);
    assert.equal(record.outputTokens, 25);
    assert.equal(record.cachedInputTokens, 10);
    assert.equal(record.totalTokens, 125);
    assert.equal(record.estimatedModelCostUsd, 0.01);
    assert.ok(record.runId);
});

test('rejects unsupported effectiveness event types', () => {
    assert.throws(
        () => createEffectivenessEvent({ eventType: 'custom_freeform_metric' }),
        /Unsupported effectiveness event type/
    );
});

test('keeps the phase 1 event taxonomy closed and explicit', () => {
    assert.deepEqual(EFFECTIVENESS_EVENT_TYPES, [
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
    ]);
});

test('keeps event quality taxonomies closed and explicit', () => {
    assert.deepEqual(EFFECTIVENESS_MEANINGFULNESS, ['meaningful', 'not_meaningful', 'unknown']);
    assert.ok(EFFECTIVENESS_REASON_CODES.includes('accepted_risk'));
    assert.ok(EFFECTIVENESS_REASON_CODES.includes('false_positive'));
    assert.ok(EFFECTIVENESS_REASON_CODES.includes('test_added'));
});

test('creates enriched effectiveness events with quality metadata', () => {
    const event = createEffectivenessEvent({
        eventType: 'waiver_used',
        runId: 'run-1',
        decisionStatus: 'WARNING',
        meaningfulness: 'meaningful',
        reasonCode: 'accepted_risk',
        evidenceLink: 'https://example.test/pr/1',
        followUpIssue: 'QA-123',
        reviewedBy: 'lead@example.com',
        notes: 'Temporary waiver with follow-up.'
    });

    assert.equal(event.schemaVersion, 2);
    assert.equal(event.meaningfulness, 'meaningful');
    assert.equal(event.reasonCode, 'accepted_risk');
    assert.equal(event.evidenceLink, 'https://example.test/pr/1');
    assert.equal(event.followUpIssue, 'QA-123');
    assert.equal(event.reviewedBy, 'lead@example.com');
});

test('normalizes legacy boolean meaningfulness values', () => {
    assert.equal(createEffectivenessEvent({ eventType: 'manual_qa_added', meaningfulness: true }).meaningfulness, 'meaningful');
    assert.equal(createEffectivenessEvent({ eventType: 'manual_qa_added', meaningfulness: false }).meaningfulness, 'not_meaningful');
    assert.equal(createEffectivenessEvent({ eventType: 'manual_qa_added', meaningfulness: 'unknown' }).meaningfulness, 'unknown');
});

test('rejects unsupported reason codes', () => {
    assert.throws(
        () => createEffectivenessEvent({ eventType: 'waiver_used', reasonCode: 'rubber_stamp' }),
        /Unsupported reason code/
    );
});

test('summarizes measured outcomes and estimated value separately', () => {
    const runtimeRecords = [
        {
            recordType: 'runtime_run',
            runId: 'run-1',
            decisionStatus: 'BLOCK',
            riskLevel: 'HIGH',
            model: 'gpt-4o',
            inputTokens: 100,
            outputTokens: 20,
            cachedInputTokens: 10,
            totalTokens: 120
        },
        {
            recordType: 'runtime_run',
            runId: 'run-2',
            decisionStatus: 'NEED_INFO',
            riskLevel: 'MEDIUM',
            model: 'gpt-4o',
            inputTokens: 80,
            outputTokens: 30,
            cachedInputTokens: 0,
            totalTokens: 110
        },
        {
            recordType: 'runtime_run',
            runId: 'run-3',
            decisionStatus: 'PASS',
            riskLevel: 'LOW'
        }
    ];
    const effectivenessEvents = [
        {
            recordType: 'effectiveness_event',
            runId: 'run-1',
            eventType: 'follow_up_fix_completed',
            meaningfulness: 'meaningful',
            reasonCode: 'block_resolved',
            evidenceLink: 'https://example.test/pr/1',
            followUpIssue: 'QA-1',
            reviewedBy: 'lead@example.com'
        },
        {
            recordType: 'effectiveness_event',
            runId: 'run-2',
            eventType: 'clarification_resolved',
            meaningfulness: 'meaningful',
            reasonCode: 'clarification_resolved'
        },
        {
            recordType: 'effectiveness_event',
            runId: 'run-2',
            eventType: 'tests_added_after_decision',
            meaningfulness: 'unknown'
        }
    ];

    const summary = buildEffectivenessSummary({ runtimeRecords, effectivenessEvents });

    assert.equal(summary.totalRuns, 3);
    assert.equal(summary.decisionCounts.BLOCK, 1);
    assert.equal(summary.decisionCounts.NEED_INFO, 1);
    assert.equal(summary.measuredOutcomes.nonPassRuns, 2);
    assert.equal(summary.measuredOutcomes.nonPassRunsWithFollowUp, 2);
    assert.equal(summary.measuredOutcomes.resolvedBlocks, 1);
    assert.equal(summary.measuredOutcomes.resolvedClarifications, 1);
    assert.equal(summary.eventCounts.tests_added_after_decision, 1);
    assert.equal(summary.measuredOutcomes.meaningfulEvents, 2);
    assert.equal(summary.measuredOutcomes.eventsWithReason, 2);
    assert.equal(summary.measuredOutcomes.eventsWithEvidenceLink, 1);
    assert.equal(summary.measuredOutcomes.eventsWithFollowUpIssue, 1);
    assert.equal(summary.measuredOutcomes.eventsReviewed, 1);
    assert.equal(summary.eventQualityRatios.meaningfulEventRate, 0.6667);
    assert.equal(summary.eventQualityRatios.reasonCodeCoverageRate, 0.6667);
    assert.equal(summary.costTelemetry.runsWithModel, 2);
    assert.equal(summary.costTelemetry.runsWithTokenUsage, 2);
    assert.equal(summary.costTelemetry.inputTokens, 180);
    assert.equal(summary.costTelemetry.outputTokens, 50);
    assert.equal(summary.costTelemetry.cachedInputTokens, 10);
    assert.equal(summary.costTelemetry.totalTokens, 230);
    assert.deepEqual(summary.estimatedValue, {
        reviewMinutesSavedMin: 30,
        reviewMinutesSavedMax: 65
    });
    assert.equal(summary.measuredRatios.nonPassActionConversionRate, 1);
    assert.equal(summary.measuredRatios.blockFollowUpCompletionRate, 1);
    assert.equal(summary.measuredRatios.needInfoResolutionRate, 1);
    assert.equal(summary.summaryVersion, 2);
});

test('filters summary records by a day window', () => {
    const runtimeRecords = [
        {
            recordType: 'runtime_run',
            runId: 'old-run',
            timestamp: '2026-04-01T00:00:00.000Z',
            decisionStatus: 'WARNING',
            riskLevel: 'MEDIUM'
        },
        {
            recordType: 'runtime_run',
            runId: 'new-run',
            timestamp: '2026-04-28T00:00:00.000Z',
            decisionStatus: 'WARNING',
            riskLevel: 'HIGH'
        }
    ];
    const effectivenessEvents = [
        {
            recordType: 'effectiveness_event',
            runId: 'old-run',
            timestamp: '2026-04-01T00:10:00.000Z',
            eventType: 'manual_qa_added'
        },
        {
            recordType: 'effectiveness_event',
            runId: 'new-run',
            timestamp: '2026-04-28T00:10:00.000Z',
            eventType: 'tests_added_after_decision'
        }
    ];

    const summary = buildEffectivenessSummary({
        runtimeRecords,
        effectivenessEvents,
        days: 7,
        now: new Date('2026-04-28T12:00:00.000Z')
    });

    assert.equal(summary.totalRuns, 1);
    assert.equal(summary.measuredOutcomes.testsAddedAfterDecision, 1);
    assert.equal(summary.measuredOutcomes.manualQaAdded, 0);
    assert.equal(summary.timeWindow.days, 7);
});

test('renders a human-readable effectiveness summary', () => {
    const summary = buildEffectivenessSummary({
        runtimeRecords: [
            {
                recordType: 'runtime_run',
                runId: 'run-1',
                decisionStatus: 'WARNING',
                riskLevel: 'HIGH'
            }
        ],
        effectivenessEvents: [
            {
                recordType: 'effectiveness_event',
                runId: 'run-1',
                eventType: 'tests_added_after_decision'
            }
        ],
        now: new Date('2026-04-28T12:00:00.000Z')
    });

    const markdown = renderEffectivenessMarkdown(summary);

    assert.match(markdown, /# TestMate Effectiveness Summary/);
    assert.match(markdown, /## Executive Summary/);
    assert.match(markdown, /## KPI Scorecard/);
    assert.match(markdown, /\| Non-PASS action conversion \| 100% \| 1 of 1 non-PASS runs \| measured \|/);
    assert.match(markdown, /## Event Quality/);
    assert.match(markdown, /Reason code coverage/);
    assert.match(markdown, /## Cost Telemetry/);
    assert.match(markdown, /Runs with token usage/);
    assert.match(markdown, /## Data Confidence And Limitations/);
    assert.match(markdown, /\| Review minutes saved \| 10-20 min \| Event-type heuristic ranges \| Low \|/);
    assert.doesNotMatch(markdown, /Next Actions/i);
});
