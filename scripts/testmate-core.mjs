import path from 'node:path';

export const FORMAL_MODES = ['pre_commit', 'pre_mr', 'pre_merge', 'pre_release'];

export const MODE_CONFIG = {
    'tier-1-targeted': {
        promptFile: 'tier-1-targeted.md',
        formalMode: 'pre_commit',
        analysisScope: 'DIFF'
    },
    'tier-2-impact': {
        promptFile: 'tier-2-impact.md',
        formalMode: 'pre_mr',
        analysisScope: 'AFFECTED'
    },
    'tier-3-full': {
        promptFile: 'tier-3-full.md',
        formalMode: 'pre_release',
        analysisScope: 'FULL'
    },
    pre_commit: {
        promptFile: 'pre-commit.md',
        formalMode: 'pre_commit',
        analysisScope: 'DIFF'
    },
    pre_mr: {
        promptFile: 'pre-mr.md',
        formalMode: 'pre_mr',
        analysisScope: 'AFFECTED'
    },
    pre_merge: {
        promptFile: 'pre-merge.md',
        formalMode: 'pre_merge',
        analysisScope: 'AFFECTED'
    },
    pre_release: {
        promptFile: 'pre-release.md',
        formalMode: 'pre_release',
        analysisScope: 'FULL'
    }
};

export function parseChangedFiles(diffText) {
    return diffText
        .split(/\r?\n/)
        .filter(line => line.startsWith('diff --git '))
        .map(line => {
            const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
            return match ? match[2] : null;
        })
        .filter(Boolean);
}

export function detectFrameworks(packageJson) {
    const dependencyNames = Object.keys({
        ...(packageJson?.dependencies || {}),
        ...(packageJson?.devDependencies || {})
    });
    const knownFrameworks = [
        'react',
        'next',
        'vue',
        'nuxt',
        'svelte',
        '@sveltejs/kit',
        'angular',
        '@angular/core',
        'solid-js',
        'astro'
    ];
    return knownFrameworks.filter(name => dependencyNames.includes(name));
}

export function detectTestRunner(packageJson) {
    const scripts = packageJson?.scripts || {};
    const scriptText = Object.values(scripts).join(' ');
    const runners = [
        ['vitest', /(^|\s)vitest(\s|$)/],
        ['jest', /(^|\s)jest(\s|$)/],
        ['playwright', /(^|\s)playwright(\s|$)/],
        ['cypress', /(^|\s)cypress(\s|$)/],
        ['node:test', /node\s+--test/]
    ];
    return runners
        .filter(([, pattern]) => pattern.test(scriptText))
        .map(([name]) => name);
}

export function isTestFile(filePath) {
    return /\.(test|spec)\.(cjs|mjs|js|jsx|ts|tsx)$/.test(filePath);
}

export function detectFocusedOrSkippedTests({
    changedFiles,
    cwd,
    exists,
    readFile,
    toolErrors = []
}) {
    const findings = [];
    for (const filePath of changedFiles.filter(isTestFile)) {
        const absolutePath = path.join(cwd, filePath);
        if (!exists(absolutePath)) continue;
        let content = '';
        try {
            content = readFile(absolutePath);
        } catch {
            toolErrors.push(`could not read changed test file: ${filePath}`);
            continue;
        }
        if (/\b(describe|it|test)\.only\s*\(/.test(content)) {
            findings.push({ file: filePath, type: 'focused_test' });
        }
        if (/\b(describe|it|test)\.skip\s*\(/.test(content)) {
            findings.push({ file: filePath, type: 'skipped_test' });
        }
    }
    return findings;
}

export function buildPreflightSummary({
    requestedMode,
    formalMode,
    analysisScope,
    baseBranch,
    changedFiles,
    packageJson,
    focusedOrSkippedTests,
    testLogsProvided,
    coverageSummaryProvided,
    toolErrors = []
}) {
    return {
        source: 'deterministic_preflight',
        requestedMode,
        formalMode,
        analysisScope,
        baseBranch,
        changedFiles,
        changedFilesCount: changedFiles.length,
        packageScripts: packageJson?.scripts || {},
        detectedFrameworks: detectFrameworks(packageJson),
        detectedTestRunners: detectTestRunner(packageJson),
        focusedOrSkippedTests,
        inputs: {
            testLogsProvided: Boolean(testLogsProvided),
            coverageSummaryProvided: Boolean(coverageSummaryProvided)
        },
        toolErrors
    };
}

export function valueType(value) {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
}

export function validateQualityGateOutput(data, schema, {
    requestedMode,
    expectedMode,
    expectedAnalysisScope
}) {
    const errors = [];

    if (data.mode !== expectedMode) {
        errors.push(`Invalid mode for requested ${requestedMode}: expected ${expectedMode}, received ${data.mode}`);
    }

    if (data.analysisScope !== expectedAnalysisScope) {
        errors.push(`Invalid analysisScope for ${expectedMode}: expected ${expectedAnalysisScope}, received ${data.analysisScope}`);
    }

    if (typeof data.auditLogPath === 'string' && !data.auditLogPath.startsWith(`logs/${expectedMode}_`)) {
        errors.push(`Invalid auditLogPath for ${expectedMode}: expected logs/${expectedMode}_<timestamp>.md, received ${data.auditLogPath}`);
    }

    for (const field of schema.required || []) {
        if (!(field in data)) {
            errors.push(`Missing required field: ${field}`);
        }
    }

    for (const [field, definition] of Object.entries(schema.properties || {})) {
        if (!(field in data)) continue;
        const value = data[field];

        if (definition.enum && !definition.enum.includes(value)) {
            errors.push(`Invalid ${field}: ${value}`);
        }

        if (definition.type && valueType(value) !== definition.type) {
            errors.push(`Invalid type for ${field}: expected ${definition.type}, received ${valueType(value)}`);
        }

        if (definition.type === 'array' && Array.isArray(value) && definition.items?.type) {
            value.forEach((item, index) => {
                if (valueType(item) !== definition.items.type) {
                    errors.push(`Invalid type for ${field}[${index}]: expected ${definition.items.type}, received ${valueType(item)}`);
                }
            });
        }

        if (definition.pattern && typeof value === 'string') {
            const pattern = new RegExp(definition.pattern);
            if (!pattern.test(value)) {
                errors.push(`Invalid ${field}: does not match ${definition.pattern}`);
            }
        }
    }

    return errors;
}

export function createAuditLogPath(formalMode, now = new Date()) {
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return path.join('logs', `${formalMode}_${timestamp}.md`).replace(/\\/g, '/');
}

export function resolveAuditLogPath(parsedAuditLogPath, formalMode, now = new Date()) {
    if (!FORMAL_MODES.includes(formalMode)) {
        throw new Error(`Audit logs are only allowed for formal modes. Received: ${formalMode}`);
    }

    const safeBasename = path.basename(parsedAuditLogPath).replace(/[^\w.-]/g, '_');
    const requiredPrefix = `${formalMode}_`;
    const filename = safeBasename.startsWith(requiredPrefix) && safeBasename.endsWith('.md')
        ? safeBasename
        : path.basename(createAuditLogPath(formalMode, now));

    return path.join('logs', filename);
}
