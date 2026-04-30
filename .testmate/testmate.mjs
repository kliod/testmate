#!/usr/bin/env node
/**
 * TestMate Unified Runner for CI/CD and Git Hooks
 * Usage: node .testmate/testmate.mjs <mode>
 * Example: OPENAI_API_KEY=xxx node .testmate/testmate.mjs tier-2-impact
 */

import { createHash } from 'node:crypto';
import { execSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = process.cwd();
const stateDir = path.join(__dirname, 'state');
const logDir = path.join(__dirname, 'logs');
const rawArgs = process.argv.slice(2);

let mode = 'tier-1-targeted';
let modeExplicit = false;
let testLogsPath = null;
let coverageSummaryPath = null;
let baseBranch = 'origin/main';
let dryRunPreflight = false;
let resumeToken = null;
let answersFile = null;
let showResumeToken = null;
let validateOutputFile = null;
let renderAuditFile = null;
let showMetrics = false;
let benchmarkFixturesPath = null;

for (const arg of rawArgs) {
    if (!arg.startsWith('--') && !modeExplicit) {
        mode = arg;
        modeExplicit = true;
        continue;
    }

    if (arg.startsWith('--test-logs=')) testLogsPath = arg.slice('--test-logs='.length);
    if (arg.startsWith('--coverage-summary=')) coverageSummaryPath = arg.slice('--coverage-summary='.length);
    if (arg.startsWith('--base-branch=')) baseBranch = arg.slice('--base-branch='.length);
    if (arg.startsWith('--resume=')) resumeToken = arg.slice('--resume='.length);
    if (arg.startsWith('--answers-file=')) answersFile = arg.slice('--answers-file='.length);
    if (arg.startsWith('--show-resume=')) showResumeToken = arg.slice('--show-resume='.length);
    if (arg.startsWith('--validate-output-file=')) validateOutputFile = arg.slice('--validate-output-file='.length);
    if (arg.startsWith('--render-audit-file=')) renderAuditFile = arg.slice('--render-audit-file='.length);
    if (arg.startsWith('--benchmark-fixtures=')) benchmarkFixturesPath = arg.slice('--benchmark-fixtures='.length);
    if (arg === '--benchmark-fixtures') benchmarkFixturesPath = path.join(rootDir, 'tests', 'fixtures', 'benchmarks');
    if (arg === '--show-metrics') showMetrics = true;
    if (arg === '--dry-run-preflight') dryRunPreflight = true;
}

const apiKey = process.env.OPENAI_API_KEY;
baseBranch = baseBranch !== 'origin/main'
    ? baseBranch
    : (process.env.TARGET_BRANCH || process.env.GITHUB_BASE_REF || 'origin/main');

function ensureDir(dirPath) {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
    }
}

function safeExec(command, fallback = '') {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
        return fallback;
    }
}

function hashContent(input) {
    return createHash('sha256').update(input).digest('hex');
}

function sha256Label(input) {
    return `sha256:${hashContent(input)}`;
}

function hashFile(filePath) {
    return sha256Label(readFileSync(filePath, 'utf8'));
}

function gatherDiff(baseRef) {
    try {
        return execFileSync('git', ['diff', baseRef], { encoding: 'utf8' });
    } catch (error) {
        console.warn(`git diff against ${baseRef} failed. Falling back to staged/HEAD.`);
        const staged = safeExec('git diff --cached', '');
        const head = safeExec('git diff HEAD', '');
        return staged || head || 'No git diff available (non-git environment or no changes).';
    }
}

function gatherChangedFiles(baseRef) {
    const raw = safeExec(`git diff --name-status ${baseRef}`, '') || safeExec('git diff --cached --name-status', '');
    return raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
            const parts = line.trim().split(/\s+/);
            return {
                status: parts[0] || 'M',
                path: parts[parts.length - 1] || ''
            };
        })
        .filter((entry) => entry.path);
}

function gatherRepositoryFiles() {
    const tracked = safeExec('git ls-files', '');
    const untracked = safeExec('git ls-files --others --exclude-standard', '');
    return [...new Set(`${tracked}\n${untracked}`
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean))];
}

function isTestPath(filePath) {
    return /\.(test|spec)\.[jt]sx?$/.test(filePath) || filePath.includes('__tests__');
}

function withoutKnownExtensions(filePath) {
    return filePath
        .replace(/\.(test|spec)\.[jt]sx?$/i, '')
        .replace(/\.[cm]?[jt]sx?$/i, '')
        .replace(/\.(md|json|ya?ml|sh|mdc)$/i, '');
}

function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function pathSegments(filePath) {
    return normalizePath(filePath).toLowerCase().split('/').filter(Boolean);
}

function stripTestFolderSegments(segments) {
    return segments.filter((segment) => !['tests', 'test', '__tests__', '__test__'].includes(segment));
}

function lastNonIndexSegment(segments) {
    const filtered = segments.filter((segment) => segment !== 'index');
    return filtered[filtered.length - 1] || segments[segments.length - 1] || '';
}

function buildTestPathAliases(filePath) {
    const normalized = normalizePath(filePath);
    const stem = withoutKnownExtensions(normalized).toLowerCase();
    const segments = pathSegments(stem);
    const aliases = new Set([stem]);

    aliases.add(stripTestFolderSegments(segments).join('/'));
    aliases.add(lastNonIndexSegment(segments));

    if (stem.startsWith('src/')) {
        aliases.add(stem.slice(4));
        aliases.add(`tests/${stem.slice(4)}`);
        aliases.add(`test/${stem.slice(4)}`);
        aliases.add(`__tests__/${stem.slice(4)}`);
    }

    if (stem.startsWith('tests/')) {
        aliases.add(stem.slice(6));
    }

    if (stem.startsWith('test/')) {
        aliases.add(stem.slice(5));
    }

    if (stem.startsWith('__tests__/')) {
        aliases.add(stem.slice(10));
    }

    return [...aliases].filter(Boolean);
}

function scoreRelatedTest(sourcePath, testPath) {
    const normalizedSource = normalizePath(sourcePath);
    const normalizedTest = normalizePath(testPath);
    const sourceStem = withoutKnownExtensions(normalizedSource).toLowerCase();
    const testStem = withoutKnownExtensions(normalizedTest).toLowerCase();
    const sourceSegments = pathSegments(sourceStem);
    const testSegments = pathSegments(testStem);
    const sourceComparable = stripTestFolderSegments(sourceSegments);
    const testComparable = stripTestFolderSegments(testSegments);
    const sourceTail = sourceComparable.join('/');
    const testTail = testComparable.join('/');
    const sourceLeaf = lastNonIndexSegment(sourceComparable);
    const testLeaf = lastNonIndexSegment(testComparable);
    let score = 0;
    const reasons = [];

    if (sourceStem === testStem || sourceTail === testTail) {
        score += 8;
        reasons.push('exact-stem-match');
    }

    if (sourceLeaf && sourceLeaf === testLeaf) {
        score += 4;
        reasons.push('leaf-name-match');
    }

    if (sourceStem.startsWith('src/')) {
        const srcTail = sourceStem.slice(4);
        if (testStem === `tests/${srcTail}` || testStem === `test/${srcTail}` || testStem === `__tests__/${srcTail}`) {
            score += 6;
            reasons.push('mirrored-test-root');
        }
    }

    const sourceDir = path.dirname(normalizedSource).replace(/\\/g, '/').toLowerCase();
    const testDir = path.dirname(normalizedTest).replace(/\\/g, '/').toLowerCase();
    if (sourceDir !== '.' && (testDir === sourceDir || testDir.endsWith(`/${sourceDir}`) || sourceDir.endsWith(`/${testDir}`))) {
        score += 3;
        reasons.push('directory-match');
    }

    if (testDir.includes('__tests__')) {
        const parentComparable = stripTestFolderSegments(testSegments.slice(0, -1)).join('/');
        if (parentComparable && sourceDir.endsWith(parentComparable)) {
            score += 3;
            reasons.push('nested-tests-folder');
        }
    }

    const sharedSegments = sourceComparable.filter((segment) => testComparable.includes(segment));
    if (sharedSegments.length >= 2) {
        score += 2;
        reasons.push('path-segment-overlap');
    }

    return {
        score,
        reasons
    };
}

function findRelatedTests(changedFiles, repositoryFiles = gatherRepositoryFiles()) {
    const tests = repositoryFiles.filter(isTestPath);
    return changedFiles.map((entry) => {
        if (isTestPath(entry.path)) {
            return {
                path: entry.path,
                relatedTests: [entry.path],
                heuristic: 'changed test file'
            };
        }

        const scored = tests
            .map((testPath) => ({
                testPath,
                ...scoreRelatedTest(entry.path, testPath)
            }))
            .filter((candidate) => candidate.score >= 4)
            .sort((left, right) => right.score - left.score || left.testPath.localeCompare(right.testPath));
        const aliases = buildTestPathAliases(entry.path);
        const relatedTests = [...new Set(scored.map((candidate) => candidate.testPath))];
        const topReasons = [...new Set(scored.flatMap((candidate) => candidate.reasons))];

        return {
            path: entry.path,
            relatedTests,
            heuristic: relatedTests.length
                ? `score-based:${topReasons.join('+') || 'matched'}`
                : `none:${aliases.slice(0, 3).join('|') || 'no-alias'}`
        };
    });
}

function readJson(filePath, fallback = null) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        return fallback;
    }
}

function readPackageScripts() {
    const packagePath = path.join(rootDir, 'package.json');
    if (!existsSync(packagePath)) {
        return {};
    }

    const pkg = readJson(packagePath, {});
    return pkg?.scripts || {};
}

function readPolicySummary() {
    return readJson(path.join(__dirname, 'policy-summary.json'), {});
}

function promptFileForMode(modeName) {
    const promptFiles = {
        pre_commit: 'pre-commit.md',
        pre_mr: 'pre-mr.md',
        pre_merge: 'pre-merge.md',
        pre_release: 'pre-release.md',
        'tier-1-targeted': 'tier-1-targeted.md',
        'tier-2-impact': 'tier-2-impact.md',
        'tier-3-full': 'tier-3-full.md'
    };
    return promptFiles[modeName] || `${modeName}.md`;
}

function readAgentCards() {
    return readJson(path.join(__dirname, 'agent-cards.json'), {});
}

function selectAgentCards(agentCards, candidateAgents) {
    return candidateAgents
        .filter((agent) => agentCards[agent])
        .map((agent) => ({
            agent,
            ...agentCards[agent]
        }));
}

function classifyChangeType(changedFiles) {
    const paths = changedFiles.map((entry) => entry.path.toLowerCase());
    if (!paths.length) return 'unknown';
    if (paths.every((entry) => entry.endsWith('.md') || entry.includes('docs/') || entry.includes('readme'))) return 'documentation';
    if (paths.some((entry) => entry.includes('auth') || entry.includes('permission'))) return 'auth';
    if (paths.some((entry) => entry.includes('form') || entry.includes('validation'))) return 'form';
    if (paths.some((entry) => entry.includes('api') || entry.includes('client') || entry.includes('schema'))) return 'api';
    if (paths.some((entry) => entry.includes('test') || entry.includes('spec'))) return 'test-only';
    if (paths.some((entry) => /\.(css|scss|less)$/.test(entry))) return 'styling';
    return 'application-code';
}

function collectAddedLinesByFile(diff) {
    const lines = diff.split(/\r?\n/);
    const byFile = new Map();
    let currentFile = null;

    for (const line of lines) {
        if (line.startsWith('+++ b/')) {
            currentFile = line.slice(6).trim();
            if (!byFile.has(currentFile)) {
                byFile.set(currentFile, []);
            }
            continue;
        }

        if (!currentFile || !line.startsWith('+') || line.startsWith('+++')) {
            continue;
        }

        byFile.get(currentFile).push(line.slice(1));
    }

    return byFile;
}

function splitDiffByFile(diff) {
    const chunks = [];
    const parts = diff.split(/(?=^diff --git )/m).filter(Boolean);

    for (const text of parts) {
        const match = text.match(/^diff --git a\/.+ b\/(.+)$/m);
        const fallbackMatch = text.match(/^\+\+\+ b\/(.+)$/m);
        const filePath = match?.[1] || fallbackMatch?.[1] || '';
        chunks.push({ path: filePath.trim(), text });
    }

    return chunks.length ? chunks : [{ path: '', text: diff }];
}

function selectRelevantDiff(diff, preflight, maxChars = 60000) {
    if (diff.length <= maxChars) {
        return {
            text: diff,
            sliced: false,
            originalChars: diff.length,
            selectedChars: diff.length,
            selectedFiles: preflight.changedFiles.map((entry) => entry.path),
            omittedFiles: []
        };
    }

    const chunks = splitDiffByFile(diff);
    const riskTerms = [
        'auth',
        'permission',
        'security',
        'api',
        'schema',
        'client',
        'form',
        'validation',
        'cache',
        'query',
        'route',
        'router',
        'upload',
        'test',
        'spec',
        'package.json',
        'package-lock',
        '.github',
        '.gitlab-ci',
        '.testmate'
    ];
    const testPaths = new Set(preflight.testFilesChanged || []);
    const relatedTestPaths = new Set((preflight.relatedTests || []).flatMap((entry) => entry.relatedTests || []));
    const priorityPaths = new Set([
        ...testPaths,
        ...relatedTestPaths,
        ...preflight.changedFiles
            .filter((entry) => {
                const lower = entry.path.toLowerCase();
                return entry.status.startsWith('D')
                    || riskTerms.some((term) => lower.includes(term))
                    || /\.(mjs|cjs|js|jsx|ts|tsx|json|ya?ml)$/.test(lower);
            })
            .map((entry) => entry.path)
    ]);

    const selected = [];
    const omitted = [];
    let selectedChars = 0;

    for (const chunk of chunks) {
        const isPriority = priorityPaths.has(chunk.path);
        if (isPriority && selectedChars + chunk.text.length <= maxChars) {
            selected.push(chunk);
            selectedChars += chunk.text.length;
        } else {
            omitted.push(chunk.path || '<unknown>');
        }
    }

    if (!selected.length) {
        for (const chunk of chunks) {
            if (selectedChars + chunk.text.length > maxChars) break;
            selected.push(chunk);
            selectedChars += chunk.text.length;
        }
        const selectedSet = new Set(selected.map((chunk) => chunk.path));
        omitted.length = 0;
        omitted.push(...chunks.filter((chunk) => !selectedSet.has(chunk.path)).map((chunk) => chunk.path || '<unknown>'));
    }

    const header = [
        '# Diff slice generated by TestMate',
        `# Original diff chars: ${diff.length}`,
        `# Selected diff chars: ${selectedChars}`,
        `# Selected files: ${selected.map((chunk) => chunk.path || '<unknown>').join(', ') || 'none'}`,
        `# Omitted files: ${omitted.join(', ') || 'none'}`,
        '# Full diff is preserved in resume state and version hashes.',
        ''
    ].join('\n');

    return {
        text: `${header}${selected.map((chunk) => chunk.text).join('\n')}`,
        sliced: true,
        originalChars: diff.length,
        selectedChars,
        selectedFiles: selected.map((chunk) => chunk.path || '<unknown>'),
        omittedFiles: omitted
    };
}

function buildPreflight(diff, changedFiles, packageScripts, activeMode, embeddedTestLogsPath, options = {}) {
    const changedPaths = changedFiles.map((entry) => entry.path);
    const lowerPaths = changedPaths.map((entry) => entry.toLowerCase());
    const addedLinesByFile = collectAddedLinesByFile(diff);
    const relevantAddedLines = [];

    for (const [file, lines] of addedLinesByFile.entries()) {
        const lowerFile = file.toLowerCase();
        const isTextOnly = lowerFile.endsWith('.md') || lowerFile.includes('docs/') || lowerFile.includes('readme');
        if (!isTextOnly) {
            relevantAddedLines.push(...lines);
        }
    }

    const lowerDiff = relevantAddedLines.join('\n').toLowerCase();
    const riskTriggers = new Set();
    const candidateAgents = new Set();
    const skippedAgents = [];

    const fileExtensions = [...new Set(changedPaths.map((entry) => path.extname(entry).toLowerCase()).filter(Boolean))];
    const configChanged = lowerPaths.some((entry) => /package\.json|package-lock\.json|pnpm-lock|yarn\.lock|tsconfig|vitest|jest|playwright|cypress|webpack|vite|next\.config|eslint|prettier/.test(entry));
    const testFilesChanged = changedFiles
        .filter((entry) => isTestPath(entry.path))
        .map((entry) => entry.path);
    const relatedTests = findRelatedTests(changedFiles, options.repositoryFiles || gatherRepositoryFiles());
    const docsOnly = lowerPaths.length > 0 && lowerPaths.every((entry) => entry.endsWith('.md') || entry.includes('docs/') || entry.includes('readme'));
    const styleOnly = lowerPaths.length > 0 && lowerPaths.every((entry) => /\.(css|scss|less)$/.test(entry));
    const deletedTests = changedFiles.some((entry) => entry.status.startsWith('D') && (/\.(test|spec)\.[jt]sx?$/.test(entry.path) || entry.path.includes('__tests__')));
    const focusedOrSkippedTests = [...addedLinesByFile.entries()].some(([file, lines]) => {
        const lowerFile = file.toLowerCase();
        const isCodeOrTest = /\.(test|spec)\.[jt]sx?$/.test(lowerFile)
            || /\.(mjs|cjs|js|jsx|ts|tsx)$/.test(lowerFile)
            || lowerFile.includes('__tests__');
        return isCodeOrTest && lines.some((line) => /(\.only\(|\bfit\(|\bfdescribe\(|\.skip\(|\bxit\(|\bxdescribe\()/.test(line));
    });
    const bugFixSignals = /(fix|bug|regression|incident|hotfix)/.test(lowerDiff);

    if (configChanged) riskTriggers.add('config-change');
    if (deletedTests) riskTriggers.add('deleted-tests');
    if (focusedOrSkippedTests) riskTriggers.add('focused-or-skipped-tests');
    if (bugFixSignals) riskTriggers.add('bug-fix-signal');

    if (lowerPaths.some((entry) => entry.includes('auth') || entry.includes('permission') || entry.includes('guard')) || /(401|403|forbidden|unauthorized)/.test(lowerDiff)) {
        riskTriggers.add('auth-permission');
        candidateAgents.add('Auth & Permission Agent');
        candidateAgents.add('Security Agent');
    }

    if (lowerPaths.some((entry) => entry.includes('form') || entry.includes('validation')) || /(react-hook-form|zod|yup|onsubmit|submit)/.test(lowerDiff)) {
        riskTriggers.add('form-submit');
        candidateAgents.add('Form & Validation Agent');
        candidateAgents.add('Component Test Agent');
    }

    if (lowerPaths.some((entry) => entry.includes('api') || entry.includes('schema') || entry.includes('client') || entry.includes('mock')) || /(fetch\(|axios|graphql|mutation|post\(|put\(|delete\()/.test(lowerDiff)) {
        riskTriggers.add('api-mutation');
        candidateAgents.add('API Mock & Contract Agent');
        candidateAgents.add('Integration Test Agent');
    }

    if (lowerPaths.some((entry) => entry.includes('cache') || entry.includes('query') || entry.includes('swr') || entry.includes('apollo')) || /(reactquery|queryclient|invalidatequeries|optimistic)/.test(lowerDiff)) {
        riskTriggers.add('cache-data');
        candidateAgents.add('Data Fetching & Cache Agent');
        candidateAgents.add('Integration Test Agent');
    }

    if (lowerPaths.some((entry) => /\.(tsx|jsx)$/.test(entry)) || /(onclick|onchange|onblur|button|dialog|modal)/.test(lowerDiff)) {
        riskTriggers.add('interactive-ui');
        candidateAgents.add('Component Test Agent');
    }

    if (lowerPaths.some((entry) => entry.includes('upload') || entry.includes('router') || entry.includes('route'))) {
        riskTriggers.add('critical-journey');
        candidateAgents.add('E2E Test Agent');
        candidateAgents.add('Integration Test Agent');
    }

    if (lowerPaths.some((entry) => entry.includes('a11y') || entry.includes('accessibility')) || /(aria-|role=|tabindex|focus)/.test(lowerDiff)) {
        riskTriggers.add('accessibility-sensitive');
        candidateAgents.add('Accessibility Agent');
    }

    if (styleOnly || lowerPaths.some((entry) => entry.includes('design-system') || entry.includes('storybook'))) {
        riskTriggers.add('visual-shared-ui');
        candidateAgents.add('Visual Regression Agent');
    }

    if (!docsOnly && !styleOnly) {
        candidateAgents.add('Change Impact Analyst');
        candidateAgents.add('Test Strategy Agent');
    }

    if (bugFixSignals || deletedTests || focusedOrSkippedTests) {
        candidateAgents.add('Regression Auditor');
    } else {
        skippedAgents.push({
            agent: 'Regression Auditor',
            reason: 'No bug-fix markers, deleted tests, or focused/skipped tests detected in preflight.'
        });
    }

    if (configChanged || Object.keys(packageScripts).length === 0) {
        candidateAgents.add('Discovery Agent');
    } else {
        skippedAgents.push({
            agent: 'Discovery Agent',
            reason: 'Package scripts are already discoverable and no stack-defining config changed.'
        });
    }

    if (activeMode === 'tier-2-impact' || activeMode === 'pre-merge' || activeMode === 'pre-mr') {
        candidateAgents.add('Semantic Drift Analyst');
    } else {
        skippedAgents.push({
            agent: 'Semantic Drift Analyst',
            reason: 'Reserved for integrity and merge-oriented analysis tiers.'
        });
    }

    if (embeddedTestLogsPath) {
        candidateAgents.add('Flaky Test Investigator');
    } else {
        skippedAgents.push({
            agent: 'Flaky Test Investigator',
            reason: 'No embedded test logs were provided.'
        });
    }

    if (activeMode === 'tier-3-full' || activeMode === 'pre-release') {
        candidateAgents.add('Performance Agent');
        candidateAgents.add('MR Quality Reporter');
    } else if (activeMode === 'tier-2-impact' || activeMode === 'pre-merge' || activeMode === 'pre-mr') {
        candidateAgents.add('MR Quality Reporter');
    } else {
        skippedAgents.push({
            agent: 'Performance Agent',
            reason: 'Reserved for full stability and release analysis.'
        });
        skippedAgents.push({
            agent: 'MR Quality Reporter',
            reason: 'Reserved for MR, merge, and release-oriented reporting.'
        });
    }

    if ([...riskTriggers].some((trigger) => ['auth-permission', 'api-mutation', 'cache-data', 'critical-journey'].includes(trigger)) || configChanged) {
        candidateAgents.add('Security Agent');
    } else {
        skippedAgents.push({
            agent: 'Security Agent',
            reason: 'No auth, security boundary, mutation, cache, journey, or config-change trigger detected.'
        });
    }

    const changeType = classifyChangeType(changedFiles);
    let riskLevelHint = 'LOW';
    if (docsOnly) {
        riskLevelHint = 'LOW';
    } else if ([...riskTriggers].some((trigger) => ['auth-permission', 'api-mutation', 'critical-journey', 'deleted-tests', 'focused-or-skipped-tests'].includes(trigger))) {
        riskLevelHint = 'HIGH';
    } else if ([...riskTriggers].some((trigger) => ['cache-data', 'form-submit', 'interactive-ui', 'visual-shared-ui'].includes(trigger))) {
        riskLevelHint = 'MEDIUM';
    }
    if ([...riskTriggers].some((trigger) => ['auth-permission', 'focused-or-skipped-tests'].includes(trigger))) {
        riskLevelHint = 'CRITICAL';
    }

    const deterministicBlockers = [];
    if (deletedTests) deterministicBlockers.push('Detected deleted test files in the change set.');
    if (focusedOrSkippedTests) deterministicBlockers.push('Detected focused or skipped tests in the diff.');

    const decisionFactors = {
        impact: riskLevelHint,
        likelihood: riskLevelHint === 'LOW' ? 0.2 : riskLevelHint === 'MEDIUM' ? 0.45 : riskLevelHint === 'HIGH' ? 0.7 : 0.9,
        confidence: docsOnly || styleOnly ? 0.9 : 0.72,
        coverageGap: deletedTests || focusedOrSkippedTests ? 'BLOCKING' : testFilesChanged.length ? 'MINOR' : (riskLevelHint === 'HIGH' || riskLevelHint === 'CRITICAL') ? 'MATERIAL' : 'NONE',
        businessCriticality: riskLevelHint === 'CRITICAL' ? 'CRITICAL' : riskLevelHint === 'HIGH' ? 'HIGH' : 'MEDIUM'
    };

    return {
        mode: activeMode,
        baseBranch,
        changeType,
        docsOnly,
        styleOnly,
        configChanged,
        fileExtensions,
        changedFiles,
        changedFileCount: changedFiles.length,
        testFilesChanged,
        relatedTests,
        riskTriggers: [...riskTriggers],
        candidateAgents: [...candidateAgents],
        skippedAgents,
        riskLevelHint,
        deterministicBlockers,
        packageScripts: Object.keys(packageScripts),
        preflightConfidence: decisionFactors.confidence,
        decisionFactors
    };
}

function formatSchemaPath(pathSegments) {
    return pathSegments.length ? pathSegments.join('.') : '<root>';
}

function validateAgainstSchema(value, schema, pathSegments = []) {
    const errors = [];
    const location = formatSchemaPath(pathSegments);

    if (Object.prototype.hasOwnProperty.call(schema, 'const') && value !== schema.const) {
        errors.push(`${location} must equal ${JSON.stringify(schema.const)}`);
        return errors;
    }

    if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${location} must be one of: ${schema.enum.join(', ')}`);
        return errors;
    }

    if (schema.type) {
        const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
        if (actualType !== schema.type) {
            errors.push(`${location} must be ${schema.type}, got ${actualType}`);
            return errors;
        }
    }

    if (schema.type === 'number') {
        if (typeof schema.minimum === 'number' && value < schema.minimum) {
            errors.push(`${location} must be >= ${schema.minimum}`);
        }
        if (typeof schema.maximum === 'number' && value > schema.maximum) {
            errors.push(`${location} must be <= ${schema.maximum}`);
        }
    }

    if (schema.type === 'string') {
        if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
            errors.push(`${location} must contain at least ${schema.minLength} characters`);
        }
        if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
            errors.push(`${location} must contain at most ${schema.maxLength} characters`);
        }
        if (schema.pattern) {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(value)) {
                errors.push(`${location} must match pattern ${schema.pattern}`);
            }
        }
    }

    if (schema.type === 'array') {
        if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
            errors.push(`${location} must contain at least ${schema.minItems} items`);
        }
        if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
            errors.push(`${location} must contain at most ${schema.maxItems} items`);
        }
        if (schema.items) {
            value.forEach((item, index) => {
                errors.push(...validateAgainstSchema(item, schema.items, [...pathSegments, String(index)]));
            });
        }
    }

    if (schema.type === 'object') {
        const required = schema.required || [];
        for (const field of required) {
            if (!(field in value)) {
                errors.push(`${location}.${field} is required`);
            }
        }

        const properties = schema.properties || {};
        for (const [field, fieldValue] of Object.entries(value)) {
            if (properties[field]) {
                errors.push(...validateAgainstSchema(fieldValue, properties[field], [...pathSegments, field]));
            } else if (schema.additionalProperties === false) {
                errors.push(`${location}.${field} is not allowed`);
            }
        }
    }

    return errors;
}

function validateStructuredOutput(parsedData) {
    const schema = readJson(path.join(__dirname, 'ai-quality-output.schema.json'));
    if (!schema) {
        throw new Error('Could not read .testmate/ai-quality-output.schema.json.');
    }

    const errors = validateAgainstSchema(parsedData, schema);

    if (parsedData.status === 'NEED_INFO') {
        const questions = parsedData.questionsForUser || [];
        const expected = parsedData.interaction?.answersExpected || [];
        if (!questions.length && !expected.length) {
            errors.push('NEED_INFO requires questionsForUser or interaction.answersExpected');
        }
    }

    if (errors.length) {
        throw new Error(`Structured output failed schema validation:\n- ${errors.join('\n- ')}`);
    }
}

function normalizeInteraction(parsedData) {
    if (parsedData.status !== 'NEED_INFO') {
        return parsedData.interaction || {
            state: 'complete',
            blockedDecision: '',
            resumeToken: '',
            answersExpected: [],
            receivedAnswers: []
        };
    }

    const rawInteraction = parsedData.interaction || {};
    const expected = Array.isArray(rawInteraction.answersExpected) && rawInteraction.answersExpected.length
        ? rawInteraction.answersExpected
        : (parsedData.questionsForUser || []).map((question, index) => ({
            id: `question_${index + 1}`,
            question,
            unblocks: rawInteraction.blockedDecision || parsedData.summary || 'analysis decision'
        }));

    return {
        state: rawInteraction.state || 'need_info',
        blockedDecision: rawInteraction.blockedDecision || parsedData.summary || 'analysis decision',
        resumeToken: rawInteraction.resumeToken || '',
        answersExpected: expected.map((item, index) => ({
            id: item.id || `question_${index + 1}`,
            question: item.question || parsedData.questionsForUser?.[index] || '',
            unblocks: item.unblocks || rawInteraction.blockedDecision || parsedData.summary || 'analysis decision'
        })),
        receivedAnswers: Array.isArray(rawInteraction.receivedAnswers) ? rawInteraction.receivedAnswers : []
    };
}

async function executeLLM(requestPayload) {
    if (process.env.TESTMATE_MOCK_OPENAI_RESPONSE) {
        const data = JSON.parse(process.env.TESTMATE_MOCK_OPENAI_RESPONSE);
        const responseText = data?.choices?.[0]?.message?.content;
        if (!responseText) {
            throw new Error('Mock OpenAI response did not include choices[0].message.content.');
        }
        return responseText;
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestPayload)
    });

    const responseBody = await res.text();
    let data;
    try {
        data = JSON.parse(responseBody);
    } catch (error) {
        throw new Error(`OpenAI API returned a non-JSON response (${res.status}): ${responseBody.slice(0, 1000)}`);
    }

    if (!res.ok) {
        const message = data?.error?.message || responseBody;
        throw new Error(`OpenAI API request failed (${res.status}): ${message}`);
    }

    const responseText = data?.choices?.[0]?.message?.content;
    if (!responseText) {
        throw new Error('OpenAI API response did not include choices[0].message.content.');
    }

    return responseText;
}

function parseResponse(responseText) {
    const jsonMatch = responseText.match(/```json([\s\S]*?)```/);
    let parsedData = null;
    let markdownAudit = responseText;

    if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[1].trim());
        markdownAudit = responseText.replace(jsonMatch[0], '').trim();
    }

    if (!parsedData) {
        throw new Error('Model response did not include a JSON payload fenced with ```json.');
    }

    parsedData.interaction = normalizeInteraction(parsedData);
    validateStructuredOutput(parsedData);
    return { parsedData, markdownAudit };
}

function readTextIfPresent(filePath, label) {
    if (!filePath) return '';
    try {
        return readFileSync(filePath, 'utf8');
    } catch (error) {
        console.warn(`Could not read ${label} at ${filePath}`);
        return '';
    }
}

function statePaths(token) {
    return {
        statePath: path.join(stateDir, `${token}.json`),
        questionsPath: path.join(stateDir, `${token}.questions.json`)
    };
}

function saveJson(filePath, value) {
    ensureDir(path.dirname(filePath));
    writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function loadResumeState(token) {
    const { statePath, questionsPath } = statePaths(token);
    if (!existsSync(statePath)) {
        throw new Error(`Resume state not found for token: ${token}`);
    }

    const state = readJson(statePath);
    if (!state) {
        throw new Error(`Resume state is unreadable: ${statePath}`);
    }

    return { state, statePath, questionsPath };
}

function buildQuestionsTemplate(interaction) {
    return {
        resumeToken: interaction.resumeToken,
        blockedDecision: interaction.blockedDecision,
        answers: interaction.answersExpected.map((item) => ({
            id: item.id,
            question: item.question,
            unblocks: item.unblocks,
            answer: ''
        }))
    };
}

function printResumeHelp(token, questionsPath) {
    console.error(`Questions saved to: ${questionsPath}`);
    console.error('Resume with:');
    console.error(`node .testmate/testmate.mjs --resume=${token} --answers-file="${questionsPath}"`);
}

function buildAuditLog(parsedData, markdownAudit, preflight) {
    const summaryText = [
        parsedData.summary,
        ...(parsedData.findings || []),
        ...(parsedData.blockers || []),
        ...(parsedData.warnings || [])
    ].map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('\n');
    const useRussianHeadings = /[А-Яа-яЁё]/.test(summaryText);
    const labels = useRussianHeadings
        ? {
            decisionSummary: 'Итоговое решение',
            status: 'Статус',
            mode: 'Режим',
            analysisScope: 'Область анализа',
            riskLevel: 'Уровень риска',
            changeType: 'Тип изменения',
            preflight: 'Предварительный анализ',
            decisionFlow: 'Ход решения',
            decisionFactors: 'Факторы решения',
            metrics: 'Метрики',
            versioning: 'Версии и хэши',
            interaction: 'Взаимодействие'
        }
        : {
            decisionSummary: 'Decision Summary',
            status: 'Status',
            mode: 'Mode',
            analysisScope: 'Analysis Scope',
            riskLevel: 'Risk Level',
            changeType: 'Change Type',
            preflight: 'Preflight',
            decisionFlow: 'Decision Flow',
            decisionFactors: 'Decision Factors',
            metrics: 'Metrics',
            versioning: 'Versions And Hashes',
            interaction: 'Interaction'
        };
    const lines = [
        `# ${labels.decisionSummary}`,
        '',
        `- ${labels.status}: ${parsedData.status}`,
        `- ${labels.mode}: ${parsedData.mode}`,
        `- ${labels.analysisScope}: ${parsedData.analysisScope}`,
        `- ${labels.riskLevel}: ${parsedData.riskLevel}`,
        `- ${labels.changeType}: ${parsedData.changeType}`,
        '',
        `## ${labels.preflight}`,
        '',
        '```json',
        JSON.stringify(preflight, null, 2),
        '```',
        '',
        `## ${labels.decisionFactors}`,
        '',
        '```json',
        JSON.stringify(parsedData.decisionFactors || preflight.decisionFactors, null, 2),
        '```'
    ];

    const selectedAgents = parsedData.subagentsRun?.length
        ? parsedData.subagentsRun
        : preflight.candidateAgents;
    const skippedAgents = parsedData.skippedAgents?.length
        ? parsedData.skippedAgents
        : preflight.skippedAgents;
    const decisionFlow = {
        stateSource: 'preflight',
        preflightConfidence: preflight.preflightConfidence,
        baselineRisk: preflight.riskLevelHint,
        finalRisk: parsedData.riskLevel,
        candidateAgents: preflight.candidateAgents,
        selectedAgents,
        skippedAgents,
        deterministicBlockers: preflight.deterministicBlockers,
        routeAdjusted: JSON.stringify(selectedAgents) !== JSON.stringify(preflight.candidateAgents),
        finalStatus: parsedData.status,
        interactionState: parsedData.interaction?.state || 'complete',
        blockedDecision: parsedData.interaction?.blockedDecision || ''
    };

    lines.push('', `## ${labels.decisionFlow}`, '', '```json', JSON.stringify(decisionFlow, null, 2), '```');

    if (parsedData.metrics && Object.keys(parsedData.metrics).length) {
        lines.push('', `## ${labels.metrics}`, '', '```json', JSON.stringify(parsedData.metrics, null, 2), '```');
    }

    if (parsedData.metrics?.versioning) {
        lines.push('', `## ${labels.versioning}`, '', '```json', JSON.stringify(parsedData.metrics.versioning, null, 2), '```');
    }

    if (parsedData.interaction?.state && parsedData.interaction.state !== 'complete') {
        lines.push('', `## ${labels.interaction}`, '', '```json', JSON.stringify(parsedData.interaction, null, 2), '```');
    }

    lines.push('', markdownAudit, '');
    return `${lines.join('\n')}\n`;
}

function buildFreshPayload(context) {
    const diffForPrompt = context.diffForPrompt || {
        text: context.diff,
        sliced: false,
        originalChars: context.diff.length,
        selectedChars: context.diff.length,
        selectedFiles: context.preflight.changedFiles?.map((entry) => entry.path) || [],
        omittedFiles: []
    };
    const sections = [
        context.promptContent,
        '',
        'Policy summary:',
        '```json',
        JSON.stringify(context.policySummary, null, 2),
        '```',
        '',
        'Selected agent cards:',
        '```json',
        JSON.stringify(context.selectedAgentCards, null, 2),
        '```',
        '',
        'Preflight summary:',
        '```json',
        JSON.stringify(context.preflight, null, 2),
        '```',
        '',
        'Package scripts:',
        '```json',
        JSON.stringify(context.packageScripts, null, 2),
        '```',
        '',
        'Diff context metadata:',
        '```json',
        JSON.stringify({
            sliced: diffForPrompt.sliced,
            originalChars: diffForPrompt.originalChars,
            selectedChars: diffForPrompt.selectedChars,
            selectedFiles: diffForPrompt.selectedFiles,
            omittedFiles: diffForPrompt.omittedFiles
        }, null, 2),
        '```',
        '',
        diffForPrompt.sliced ? 'Selected git diff:' : 'Git diff:',
        '```diff',
        diffForPrompt.text,
        '```'
    ];

    if (context.testLogsText) {
        sections.push('', 'Embedded CI Test Failure Logs:', '```', context.testLogsText, '```');
    }

    if (context.coverageText) {
        sections.push('', 'Embedded coverage summary:', '```json', context.coverageText, '```');
    }

    return {
        model: process.env.AI_MODEL || 'gpt-4o',
        messages: [
            { role: 'system', content: context.orchestrator },
            { role: 'user', content: sections.join('\n') }
        ],
        temperature: 0.1
    };
}

function readBenchmarkFixtures(fixturesPath) {
    const resolved = path.resolve(rootDir, fixturesPath);
    const entries = readdirSync(resolved, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => path.join(resolved, entry.name))
        .sort();

    return entries.map((filePath) => ({
        filePath,
        data: readJson(filePath)
    })).filter((entry) => entry.data);
}

function buildPromptPayloadForBenchmark(context, diffForPrompt) {
    return buildFreshPayload({
        ...context,
        diffForPrompt
    });
}

function readBenchmarkBaseline() {
    const baselinePath = path.join(__dirname, 'benchmark-baselines.json');
    if (!existsSync(baselinePath)) {
        return { baselinePath, fixtures: {} };
    }

    return {
        baselinePath,
        ...readJson(baselinePath)
    };
}

function compareRiskLevel(actual, minimum) {
    const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    return order.indexOf(actual) >= order.indexOf(minimum);
}

function evaluateBenchmarkResult(result, baseline = {}) {
    const passedChecks = [];
    const failedChecks = [];

    if (typeof baseline.minDiffReductionPercent === 'number') {
        const label = `diffReductionPercent >= ${baseline.minDiffReductionPercent}`;
        if (result.diffReductionPercent >= baseline.minDiffReductionPercent) {
            passedChecks.push(label);
        } else {
            failedChecks.push(label);
        }
    }

    if (typeof baseline.minPromptReductionPercent === 'number') {
        const label = `promptReductionPercent >= ${baseline.minPromptReductionPercent}`;
        if (result.promptReductionPercent >= baseline.minPromptReductionPercent) {
            passedChecks.push(label);
        } else {
            failedChecks.push(label);
        }
    }

    if (typeof baseline.expectSliced === 'boolean') {
        const label = `diffSliced === ${baseline.expectSliced}`;
        if (result.diffSliced === baseline.expectSliced) {
            passedChecks.push(label);
        } else {
            failedChecks.push(label);
        }
    }

    if (typeof baseline.maxCandidateAgents === 'number') {
        const label = `candidateAgents.length <= ${baseline.maxCandidateAgents}`;
        if (result.candidateAgents.length <= baseline.maxCandidateAgents) {
            passedChecks.push(label);
        } else {
            failedChecks.push(label);
        }
    }

    if (baseline.minimumRiskLevel) {
        const label = `riskLevelHint >= ${baseline.minimumRiskLevel}`;
        if (compareRiskLevel(result.riskLevelHint, baseline.minimumRiskLevel)) {
            passedChecks.push(label);
        } else {
            failedChecks.push(label);
        }
    }

    for (const agent of baseline.requiredAgents || []) {
        const label = `candidateAgents includes ${agent}`;
        if (result.candidateAgents.includes(agent)) {
            passedChecks.push(label);
        } else {
            failedChecks.push(label);
        }
    }

    return {
        status: failedChecks.length ? 'ATTENTION' : 'OK',
        passedChecks,
        failedChecks,
        note: baseline.note || ''
    };
}

function runBenchmarkFixtures(fixturesPath) {
    const benchmarkDir = fixturesPath || path.join(rootDir, 'tests', 'fixtures', 'benchmarks');
    const packageScripts = readPackageScripts();
    const policySummary = readPolicySummary();
    const agentCards = readAgentCards();
    const orchestrator = readFileSync(path.join(__dirname, 'agents/web-testing-orchestrator.md'), 'utf8');
    const fixtures = readBenchmarkFixtures(benchmarkDir);
    const benchmarkBaseline = readBenchmarkBaseline();

    const results = fixtures.map(({ filePath, data }) => {
        const changedFiles = data.changedFiles || [];
        const diff = data.diff || '';
        const modeForFixture = data.mode || 'tier-1-targeted';
        const promptContent = readFileSync(path.join(__dirname, 'prompts', promptFileForMode(modeForFixture)), 'utf8');
        const preflight = buildPreflight(
            diff,
            changedFiles,
            packageScripts,
            modeForFixture,
            null,
            { repositoryFiles: data.repositoryFiles || [] }
        );
        const selectedAgentCards = selectAgentCards(agentCards, preflight.candidateAgents);
        const fullDiffForPrompt = {
            text: diff,
            sliced: false,
            originalChars: diff.length,
            selectedChars: diff.length,
            selectedFiles: changedFiles.map((entry) => entry.path),
            omittedFiles: []
        };
        const slicedDiffForPrompt = selectRelevantDiff(diff, preflight, data.maxPromptDiffChars || 60000);
        const payloadContext = {
            mode: modeForFixture,
            baseBranch: 'benchmark',
            diff,
            diffForPrompt: slicedDiffForPrompt,
            preflight,
            policySummary,
            selectedAgentCards,
            packageScripts,
            promptContent,
            orchestrator,
            testLogsText: '',
            coverageText: ''
        };
        const fullPromptPayload = buildPromptPayloadForBenchmark(payloadContext, fullDiffForPrompt);
        const slicedPromptPayload = buildPromptPayloadForBenchmark(payloadContext, slicedDiffForPrompt);
        const fullPromptChars = measurePromptChars(fullPromptPayload);
        const slicedPromptChars = measurePromptChars(slicedPromptPayload);
        const diffReductionPercent = diff.length
            ? Math.round((1 - (slicedDiffForPrompt.selectedChars / diff.length)) * 100)
            : 0;
        const promptReductionPercent = fullPromptChars
            ? Math.round((1 - (slicedPromptChars / fullPromptChars)) * 100)
            : 0;

        const result = {
            fixture: data.name || path.basename(filePath, '.json'),
            mode: modeForFixture,
            description: data.description || '',
            changedFiles: changedFiles.length,
            riskLevelHint: preflight.riskLevelHint,
            candidateAgents: preflight.candidateAgents,
            relatedTestsFound: preflight.relatedTests.filter((entry) => entry.relatedTests.length > 0).length,
            diffOriginalChars: diff.length,
            diffSelectedChars: slicedDiffForPrompt.selectedChars,
            diffReductionPercent,
            promptFullChars: fullPromptChars,
            promptSelectedChars: slicedPromptChars,
            promptReductionPercent,
            diffSliced: slicedDiffForPrompt.sliced,
            selectedFiles: slicedDiffForPrompt.selectedFiles,
            omittedFiles: slicedDiffForPrompt.omittedFiles
        };

        const baseline = benchmarkBaseline.fixtures?.[result.fixture];
        if (baseline) {
            result.baseline = evaluateBenchmarkResult(result, baseline);
        }

        return result;
    });

    const fixturesWithBaseline = results.filter((result) => result.baseline);
    const summary = {
        fixtureCount: results.length,
        averageDiffReductionPercent: average(results.map((result) => result.diffReductionPercent)),
        averagePromptReductionPercent: average(results.map((result) => result.promptReductionPercent)),
        maxPromptReductionPercent: Math.max(...results.map((result) => result.promptReductionPercent), 0),
        minPromptReductionPercent: Math.min(...results.map((result) => result.promptReductionPercent), 0),
        baselineFixturesChecked: fixturesWithBaseline.length,
        baselinePassed: fixturesWithBaseline.filter((result) => result.baseline.status === 'OK').length,
        baselineAttention: fixturesWithBaseline.filter((result) => result.baseline.status !== 'OK').length,
        baselineStatus: fixturesWithBaseline.every((result) => result.baseline.status === 'OK') ? 'OK' : 'ATTENTION'
    };

    console.log(JSON.stringify({
        summary,
        baselinePath: benchmarkBaseline.baselinePath,
        reviewNote: 'Per-fixture baselines define what counts as healthy slicing and routing. Small diffs may show 0% prompt reduction without being regressions.',
        results
    }, null, 2));
}

function measurePromptChars(payload) {
    return payload.messages.reduce((total, message) => total + String(message.content || '').length, 0);
}

function buildVersioning(context) {
    return {
        policyHash: hashFile(path.join(__dirname, 'AGENTS.md')),
        policySummaryHash: hashFile(path.join(__dirname, 'policy-summary.json')),
        agentCardsHash: hashFile(path.join(__dirname, 'agent-cards.json')),
        selectedAgentCardsHash: sha256Label(JSON.stringify(context.selectedAgentCards || [])),
        tierPromptHash: sha256Label(context.promptContent || ''),
        orchestratorHash: sha256Label(context.orchestrator || ''),
        diffHash: sha256Label(context.diff || '')
    };
}

function recordAnalytics(parsedData, preflight, auditLogPath) {
    const analyticsPath = path.join(stateDir, 'metrics.jsonl');
    const event = {
        timestamp: new Date().toISOString(),
        status: parsedData.status,
        mode: parsedData.mode,
        analysisScope: parsedData.analysisScope,
        riskLevel: parsedData.riskLevel,
        changeType: parsedData.changeType,
        auditLogPath,
        changedFiles: preflight.changedFileCount,
        selectedAgents: preflight.candidateAgents.length,
        riskTriggers: preflight.riskTriggers,
        metrics: {
            runtimeMs: parsedData.metrics?.runtimeMs,
            model: parsedData.metrics?.model,
            promptChars: parsedData.metrics?.promptChars,
            responseChars: parsedData.metrics?.responseChars,
            retryCount: parsedData.metrics?.retryCount,
            diffSliced: parsedData.metrics?.diffSliced,
            diffOriginalChars: parsedData.metrics?.diffOriginalChars,
            diffSelectedChars: parsedData.metrics?.diffSelectedChars,
            diffOmittedFiles: parsedData.metrics?.diffOmittedFiles
        }
    };

    ensureDir(path.dirname(analyticsPath));
    writeFileSync(analyticsPath, `${JSON.stringify(event)}\n`, { encoding: 'utf8', flag: 'a' });
}

function average(values) {
    const numeric = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
    if (!numeric.length) return 0;
    return Math.round(numeric.reduce((sum, value) => sum + value, 0) / numeric.length);
}

function showMetricsSummary() {
    const analyticsPath = path.join(stateDir, 'metrics.jsonl');
    if (!existsSync(analyticsPath)) {
        console.log('No local TestMate metrics found.');
        console.log(`Expected path: ${analyticsPath}`);
        return;
    }

    const events = readFileSync(analyticsPath, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                return null;
            }
        })
        .filter(Boolean);

    const countsByStatus = {};
    const countsByMode = {};
    for (const event of events) {
        countsByStatus[event.status] = (countsByStatus[event.status] || 0) + 1;
        countsByMode[event.mode] = (countsByMode[event.mode] || 0) + 1;
    }

    const summary = {
        totalRuns: events.length,
        countsByStatus,
        countsByMode,
        averageRuntimeMs: average(events.map((event) => event.metrics?.runtimeMs)),
        averagePromptChars: average(events.map((event) => event.metrics?.promptChars)),
        averageResponseChars: average(events.map((event) => event.metrics?.responseChars)),
        averageRetryCount: average(events.map((event) => event.metrics?.retryCount)),
        averageSelectedAgents: average(events.map((event) => event.selectedAgents)),
        averageDiffSelectedChars: average(events.map((event) => event.metrics?.diffSelectedChars)),
        averageDiffOriginalChars: average(events.map((event) => event.metrics?.diffOriginalChars))
    };

    console.log(JSON.stringify(summary, null, 2));
}

function buildResumePayload(state, answersPayload) {
    const answerSummary = answersPayload.answers.map((item) => ({
        id: item.id,
        answer: item.answer
    }));

    return {
        model: process.env.AI_MODEL || 'gpt-4o',
        messages: [
            { role: 'system', content: state.orchestrator },
            {
                role: 'user',
                content: `${state.promptContent}

This is a resume after NEED_INFO.

Saved policy summary:
\`\`\`json
${JSON.stringify(state.policySummary, null, 2)}
\`\`\`

Saved selected agent cards:
\`\`\`json
${JSON.stringify(state.selectedAgentCards, null, 2)}
\`\`\`

Saved preflight summary:
\`\`\`json
${JSON.stringify(state.preflight, null, 2)}
\`\`\`

Saved package scripts:
\`\`\`json
${JSON.stringify(state.packageScripts, null, 2)}
\`\`\`

Saved selected git diff:
\`\`\`diff
${state.diffForPrompt?.text || state.diff}
\`\`\`

Saved diff context metadata:
\`\`\`json
${JSON.stringify(state.diffForPrompt || {
    sliced: false,
    originalChars: state.diff.length,
    selectedChars: state.diff.length,
    selectedFiles: state.preflight.changedFiles?.map((entry) => entry.path) || [],
    omittedFiles: []
}, null, 2)}
\`\`\`

Blocked decision:
\`\`\`json
${JSON.stringify({
    blockedDecision: state.interaction.blockedDecision,
    answersExpected: state.interaction.answersExpected
}, null, 2)}
\`\`\`

Received answers:
\`\`\`json
${JSON.stringify(answerSummary, null, 2)}
\`\`\`

Do not restart analysis from scratch. Re-evaluate the blocked decision using the saved context and the new answers.`
            }
        ],
        temperature: 0.1
    };
}

function createResumeState(parsedData, context, markdownAudit) {
    const token = parsedData.interaction.resumeToken || `need-info-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    parsedData.interaction.resumeToken = token;
    const { statePath, questionsPath } = statePaths(token);
    const questions = buildQuestionsTemplate(parsedData.interaction);

    const resumableState = {
        version: 1,
        resumeToken: token,
        mode: context.mode,
        baseBranch: context.baseBranch,
        diffHash: hashContent(context.diff),
        createdAt: new Date().toISOString(),
        promptContent: context.promptContent,
        orchestrator: context.orchestrator,
        policySummary: context.policySummary,
        selectedAgentCards: context.selectedAgentCards,
        packageScripts: context.packageScripts,
        preflight: context.preflight,
        diff: context.diff,
        diffForPrompt: context.diffForPrompt,
        versioning: context.versioning || buildVersioning(context),
        interaction: parsedData.interaction,
        lastStatus: parsedData.status,
        lastSummary: parsedData.summary,
        lastAudit: markdownAudit
    };

    saveJson(statePath, resumableState);
    saveJson(questionsPath, questions);

    return { token, statePath, questionsPath, questions };
}

function loadAnswersPayload(filePath, token) {
    if (!filePath) {
        const fallbackPath = statePaths(token).questionsPath;
        if (existsSync(fallbackPath)) {
            return { payload: readJson(fallbackPath), sourcePath: fallbackPath };
        }
        throw new Error('Answers file is required for resume. Use --answers-file=<path>.');
    }

    const payload = readJson(filePath);
    if (!payload) {
        throw new Error(`Answers file is unreadable: ${filePath}`);
    }

    return { payload, sourcePath: filePath };
}

function validateAnswers(state, answersPayload) {
    const expected = state.interaction.answersExpected || [];
    const provided = new Map((answersPayload.answers || []).map((item) => [item.id, item.answer]));
    const missing = expected.filter((item) => !provided.get(item.id) || !String(provided.get(item.id)).trim());

    if (missing.length) {
        throw new Error(`Missing answers for: ${missing.map((item) => item.id).join(', ')}`);
    }

    return expected.map((item) => ({
        id: item.id,
        question: item.question,
        unblocks: item.unblocks,
        answer: String(provided.get(item.id)).trim()
    }));
}

function showResume(token) {
    const { state, questionsPath } = loadResumeState(token);
    const questions = readJson(questionsPath, buildQuestionsTemplate(state.interaction));

    console.log(`Resume token: ${token}`);
    console.log(`Blocked decision: ${state.interaction.blockedDecision}`);
    console.log(`Questions file: ${questionsPath}`);
    console.log('');
    console.log(JSON.stringify(questions, null, 2));
}

function validateOutputFileForCli(filePath) {
    const responseText = readFileSync(filePath, 'utf8');
    const { parsedData } = parseResponse(responseText.trim().startsWith('{')
        ? `\`\`\`json\n${responseText}\n\`\`\``
        : responseText);
    console.log(`Structured output is valid: ${parsedData.status}`);
}

function renderAuditFileForCli(filePath) {
    const fixture = readJson(filePath);
    if (!fixture || typeof fixture !== 'object') {
        throw new Error(`Audit fixture is unreadable: ${filePath}`);
    }

    const parsedData = fixture.parsedData;
    const preflight = fixture.preflight;
    const markdownAudit = fixture.markdownAudit || '';

    if (!parsedData || !preflight) {
        throw new Error('Audit fixture must include parsedData and preflight.');
    }

    parsedData.interaction = normalizeInteraction(parsedData);
    validateStructuredOutput(parsedData);
    console.log(buildAuditLog(parsedData, markdownAudit, preflight));
}

async function executeWithRetry(payload) {
    let responseText = await executeLLM(payload);
    let retryCount = 0;

    try {
        return {
            ...parseResponse(responseText),
            retryCount,
            responseChars: responseText.length
        };
    } catch (parseError) {
        retryCount = 1;
        const retryPayload = {
            ...payload,
            messages: [
                ...payload.messages,
                {
                    role: 'user',
                    content: `Your previous response failed validation.\nReturn a JSON block that includes the required fields and then a concise markdown audit.\nValidation error: ${parseError.message}`
                }
            ]
        };
        responseText = await executeLLM(retryPayload);
        return {
            ...parseResponse(responseText),
            retryCount,
            responseChars: responseText.length
        };
    }
}

async function runFresh() {
    const diff = gatherDiff(baseBranch);
    const changedFiles = gatherChangedFiles(baseBranch);
    const packageScripts = readPackageScripts();
    const policySummary = readPolicySummary();
    const agentCards = readAgentCards();
    const preflight = buildPreflight(diff, changedFiles, packageScripts, mode, testLogsPath);
    const selectedAgentCards = selectAgentCards(agentCards, preflight.candidateAgents);

    console.log(`\nAssessing quality using TestMate [${mode}]...`);
    console.log(`Base branch: ${baseBranch}`);
    console.log();

    if (dryRunPreflight) {
        console.log(JSON.stringify(preflight, null, 2));
        process.exit(preflight.deterministicBlockers.length ? 1 : 0);
    }

    if (preflight.deterministicBlockers.length) {
        console.error('TestMate blocked this change during deterministic preflight:');
        for (const blocker of preflight.deterministicBlockers) {
            console.error(`- ${blocker}`);
        }
        process.exit(1);
    }

    if (!apiKey) {
        console.error('OPENAI_API_KEY is not set.');
        console.error('Please provide an API key to execute the Orchestrator.');
        process.exit(1);
    }

    const promptContent = readFileSync(path.join(__dirname, 'prompts', promptFileForMode(mode)), 'utf8');
    const orchestrator = readFileSync(path.join(__dirname, 'agents/web-testing-orchestrator.md'), 'utf8');
    const testLogsText = readTextIfPresent(testLogsPath, 'test logs');
    const coverageText = readTextIfPresent(coverageSummaryPath, 'coverage summary');

    if (testLogsText) console.log(`Embedded test logs from ${testLogsPath}`);
    if (coverageText) console.log(`Embedded coverage data from ${coverageSummaryPath}`);

    const context = {
        mode,
        baseBranch,
        diff,
        preflight,
        policySummary,
        selectedAgentCards,
        packageScripts,
        promptContent,
        orchestrator,
        testLogsText,
        coverageText
    };
    context.diffForPrompt = selectRelevantDiff(diff, preflight);

    const payload = buildFreshPayload(context);
    const promptChars = measurePromptChars(payload);
    const versioning = buildVersioning(context);
    context.versioning = versioning;
    const startedAt = Date.now();
    const { parsedData, markdownAudit, retryCount, responseChars } = await executeWithRetry(payload);

    parsedData.metrics = {
        ...(parsedData.metrics || {}),
        runtimeMs: Date.now() - startedAt,
        selectedAgents: preflight.candidateAgents.length,
        changedFiles: preflight.changedFileCount,
        model: payload.model,
        promptChars,
        responseChars,
        retryCount,
        diffSliced: context.diffForPrompt.sliced,
        diffOriginalChars: context.diffForPrompt.originalChars,
        diffSelectedChars: context.diffForPrompt.selectedChars,
        diffOmittedFiles: context.diffForPrompt.omittedFiles.length,
        versioning
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const rawPath = parsedData.auditLogPath || `${mode}_${timestamp}.md`;
    const safeFilename = path.basename(rawPath).replace(/[^\w.-]/g, '_');
    const auditLogPath = path.join(logDir, safeFilename.endsWith('.md') ? safeFilename : `${safeFilename}.md`);
    ensureDir(path.dirname(auditLogPath));
    writeFileSync(auditLogPath, buildAuditLog(parsedData, markdownAudit, preflight), { encoding: 'utf8', flag: 'wx' });
    recordAnalytics(parsedData, preflight, auditLogPath);
    console.log(`Audit report written to: ${auditLogPath}`);

    if (parsedData.status === 'NEED_INFO') {
        const resume = createResumeState(parsedData, context, markdownAudit);
        console.error('\nAnalysis paused: NEED_INFO');
        console.error(`Blocked decision: ${parsedData.interaction.blockedDecision}`);
        console.error('');
        for (const question of parsedData.interaction.answersExpected) {
            console.error(`- [${question.id}] ${question.question}`);
            console.error(`  Unblocks: ${question.unblocks}`);
        }
        console.error('');
        printResumeHelp(resume.token, resume.questionsPath);
        process.exit(1);
    }

    if (parsedData.status === 'BLOCK') {
        console.error('\nTestMate blocked this code change. Fix issues before proceeding.');
        process.exit(1);
    }

    console.log(`\nTestMate finished with ${parsedData.status}. Proceeding...`);
}

async function runResume(token) {
    const { state, questionsPath } = loadResumeState(token);
    const currentDiff = gatherDiff(state.baseBranch);
    const currentDiffHash = hashContent(currentDiff);

    console.log(`\nResuming TestMate analysis [${token}]...`);
    console.log(`Blocked decision: ${state.interaction.blockedDecision}`);
    console.log();

    if (currentDiffHash !== state.diffHash) {
        console.error('Saved resume state no longer matches the current diff.');
        console.error('Run a fresh analysis instead of resuming this state.');
        process.exit(1);
    }

    if (!apiKey) {
        console.error('OPENAI_API_KEY is not set.');
        console.error('Please provide an API key to execute the Orchestrator.');
        process.exit(1);
    }

    const { payload: answersPayload, sourcePath } = loadAnswersPayload(answersFile, token);
    const receivedAnswers = validateAnswers(state, answersPayload);
    console.log(`Loaded answers from ${sourcePath}`);

    const payload = buildResumePayload(state, { answers: receivedAnswers });
    const promptChars = measurePromptChars(payload);
    const versioning = {
        ...(state.versioning || {}),
        diffHash: sha256Label(currentDiff)
    };
    const startedAt = Date.now();
    const { parsedData, markdownAudit, retryCount, responseChars } = await executeWithRetry(payload);

    parsedData.metrics = {
        ...(parsedData.metrics || {}),
        runtimeMs: Date.now() - startedAt,
        selectedAgents: state.preflight.candidateAgents.length,
        changedFiles: state.preflight.changedFileCount,
        model: payload.model,
        promptChars,
        responseChars,
        retryCount,
        diffSliced: Boolean(state.diffForPrompt?.sliced),
        diffOriginalChars: state.diffForPrompt?.originalChars ?? currentDiff.length,
        diffSelectedChars: state.diffForPrompt?.selectedChars ?? currentDiff.length,
        diffOmittedFiles: state.diffForPrompt?.omittedFiles?.length || 0,
        versioning
    };

    parsedData.interaction = {
        ...parsedData.interaction,
        receivedAnswers
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const rawPath = parsedData.auditLogPath || `${state.mode}_${timestamp}.md`;
    const safeFilename = path.basename(rawPath).replace(/[^\w.-]/g, '_');
    const auditLogPath = path.join(logDir, safeFilename.endsWith('.md') ? safeFilename : `${safeFilename}.md`);
    ensureDir(path.dirname(auditLogPath));
    writeFileSync(auditLogPath, buildAuditLog(parsedData, markdownAudit, state.preflight), { encoding: 'utf8', flag: 'wx' });
    recordAnalytics(parsedData, state.preflight, auditLogPath);
    console.log(`Audit report written to: ${auditLogPath}`);

    if (parsedData.status === 'NEED_INFO') {
        const context = {
            mode: state.mode,
            baseBranch: state.baseBranch,
            diff: state.diff,
            preflight: state.preflight,
            policySummary: state.policySummary,
            selectedAgentCards: state.selectedAgentCards,
            packageScripts: state.packageScripts,
        promptContent: state.promptContent,
        orchestrator: state.orchestrator,
        diffForPrompt: state.diffForPrompt
    };
        const resume = createResumeState(parsedData, context, markdownAudit);
        console.error('\nAnalysis is still waiting for more information.');
        for (const question of parsedData.interaction.answersExpected) {
            console.error(`- [${question.id}] ${question.question}`);
            console.error(`  Unblocks: ${question.unblocks}`);
        }
        console.error('');
        printResumeHelp(resume.token, resume.questionsPath);
        process.exit(1);
    }

    if (parsedData.status === 'BLOCK') {
        console.error('\nTestMate blocked this code change after resume.');
        process.exit(1);
    }

    if (existsSync(questionsPath)) {
        const answered = buildQuestionsTemplate({
            ...state.interaction,
            receivedAnswers
        });
        answered.answers = answered.answers.map((item) => ({
            ...item,
            answer: receivedAnswers.find((answer) => answer.id === item.id)?.answer || ''
        }));
        saveJson(questionsPath, answered);
    }

    console.log(`\nTestMate finished with ${parsedData.status}. Proceeding...`);
}

async function main() {
    ensureDir(stateDir);
    ensureDir(logDir);

    if (validateOutputFile) {
        validateOutputFileForCli(validateOutputFile);
        return;
    }

    if (renderAuditFile) {
        renderAuditFileForCli(renderAuditFile);
        return;
    }

    if (benchmarkFixturesPath) {
        runBenchmarkFixtures(benchmarkFixturesPath);
        return;
    }

    if (showMetrics) {
        showMetricsSummary();
        return;
    }

    if (showResumeToken) {
        showResume(showResumeToken);
        return;
    }

    if (resumeToken) {
        await runResume(resumeToken);
        return;
    }

    await runFresh();
}

main().catch((error) => {
    console.error('Execution failed', error);
    process.exit(1);
});
