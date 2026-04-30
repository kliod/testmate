import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    loadGoldenFixtures,
    replayGoldenFixtures,
    replayGoldenFixture,
    summarizeReplayResults
} from './testmate-fixtures.mjs';

const schema = JSON.parse(readFileSync('.testmate/ai-quality-output.schema.json', 'utf8'));

test('loads the starter golden fixture suite', () => {
    const fixtures = loadGoldenFixtures();

    assert.ok(fixtures.length >= 5);
    assert.ok(fixtures.some(fixture => fixture.id === 'auth-guard-role-change'));
    assert.ok(fixtures.some(fixture => fixture.id === 'focused-test-introduced'));
});

test('replays all golden fixtures successfully', () => {
    const results = replayGoldenFixtures({ schema });
    const summary = summarizeReplayResults(results);

    assert.equal(summary.total, results.length);
    assert.equal(summary.failed, 0);
    assert.equal(summary.passed, results.length);
});

test('reports fixture failures when expected labels do not match', () => {
    const fixture = loadGoldenFixtures().find(item => item.id === 'form-submit-missing-validation');
    const result = replayGoldenFixture({
        ...fixture,
        expectedLabels: {
            ...fixture.expectedLabels,
            status: 'PASS'
        }
    }, schema);

    assert.equal(result.passed, false);
    assert.equal(result.contractErrors.length, 0);
});
