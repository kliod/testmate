#!/usr/bin/env node
/**
 * TestMate Unified Runner for CI/CD and Git Hooks
 * Usage: node scripts/testmate.mjs <mode>
 * Example: OPENAI_API_KEY=xxx node scripts/testmate.mjs tier-2-impact
 */

import { execSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mode = process.argv[2] || 'tier-1-targeted';
const apiKey = process.env.OPENAI_API_KEY;

// Parse optional arguments
let testLogsPath = null;
let coverageSummaryPath = null;
let baseBranch = 'origin/main';

process.argv.forEach(arg => {
    if (arg.startsWith('--test-logs=')) testLogsPath = arg.split('=')[1];
    if (arg.startsWith('--coverage-summary=')) coverageSummaryPath = arg.split('=')[1];
    if (arg.startsWith('--base-branch=')) baseBranch = arg.split('=')[1];
});

// Priority: explicit arg -> CI ENV -> fallback
baseBranch = baseBranch !== 'origin/main' ? baseBranch : (process.env.TARGET_BRANCH || process.env.GITHUB_BASE_REF || 'origin/main');

console.log(`\n🚀 Asssessing quality using TestMate [${mode}]...`);
console.log(`🌲 Base branch: ${baseBranch}`);
console.log();

if (!apiKey) {
    console.error("❌ OPENAI_API_KEY is not set.");
    console.error("Please provide an API key to execute the Orchestrator.");
    process.exit(1);
}

// 1. Gather context
let diff = '';
try {
    diff = execFileSync('git', ['diff', baseBranch]).toString();
} catch (e) {
    console.warn(`⚠️ git diff against ${baseBranch} failed. Falling back to staged/HEAD.`);
    try {
        // Try staged changes first, then HEAD
        diff = execSync('git diff --cached').toString() || execSync('git diff HEAD').toString();
    } catch (fallbackError) {
        console.warn('⚠️ All git diff attempts failed. Proceeding with empty diff.');
        diff = 'No git diff available (Non-git environment or no changes).';
    }
}

const promptContent = readFileSync(path.join(__dirname, `../prompts/${mode}.md`), 'utf8');
const orchestrator = readFileSync(path.join(__dirname, '../agents/web-testing-orchestrator.md'), 'utf8');

let testLogsContent = '';
if (testLogsPath) {
    try {
        testLogsContent = `\n\nHere are the CI Test Failure Logs:\n\`\`\`\n${readFileSync(testLogsPath, 'utf8')}\n\`\`\``;
        console.log(`📎 Embedded test logs from ${testLogsPath}`);
    } catch (e) {
        console.warn(`⚠️ Could not read test logs at ${testLogsPath}`);
    }
}

let coverageContent = '';
if (coverageSummaryPath) {
    try {
        coverageContent = `\n\nHere is the Jest Coverage Summary payload:\n\`\`\`json\n${readFileSync(coverageSummaryPath, 'utf8')}\n\`\`\`\nIf line coverage for any modified file drops below threshold, FLAG IT AS A BLOCK.`;
        console.log(`📎 Embedded coverage data from ${coverageSummaryPath}`);
    } catch (e) {
        console.warn(`⚠️ Could not read coverage at ${coverageSummaryPath}`);
    }
}

// 2. Build payload
const payload = {
    model: process.env.AI_MODEL || "gpt-4o",
    messages: [
        { role: "system", content: orchestrator },
        { role: "user", content: `${promptContent}\n\nHere is the diff:\n\`\`\`diff\n${diff}\n\`\`\`${testLogsContent}${coverageContent}` }
    ],
    temperature: 0.1
};

// 3. Execute
async function run() {
    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        const responseText = data.choices[0].message.content;
        
        // Разделяем JSON и Markdown
        let jsonMatch = responseText.match(/```json([\s\S]*?)```/);
        let parsedData = null;
        let markdownAudit = responseText;
        
        if (jsonMatch) {
            try {
                parsedData = JSON.parse(jsonMatch[1].trim());
                // Удаляем JSON из ответа, оставляя только чистый лог Markdown
                markdownAudit = responseText.replace(jsonMatch[0], '').trim();
            } catch (e) {
                console.warn("⚠️ Failed to parse orchestrator JSON.");
            }
        }

        // Записываем сам Аудит-лог в Markdown файл
        if (parsedData) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            
            // Security: Sanitize path to prevent traversal
            let rawPath = parsedData.auditLogPath || `${mode}_${timestamp}.md`;
            const safeFilename = path.basename(rawPath).replace(/[^\w.-]/g, '_');
            const auditLogPath = path.join('logs', safeFilename.endsWith('.md') ? safeFilename : `${safeFilename}.md`);

            const dir = path.dirname(auditLogPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            appendFileSync(auditLogPath, `\n\n---\n\n## 🕒 Run Date: ${new Date().toISOString()}\n\n${markdownAudit}`, 'utf8');
            console.log(`📝 Отчет добавлен в: ${auditLogPath}`);

            if (parsedData.status === 'NEED_INFO') {
                console.error("\n🛑 TestMate ПРЕРВАЛ РАБОТУ (NEED_INFO). Требуется контекст:");
                if (parsedData.questionsForUser) {
                    parsedData.questionsForUser.forEach((q, i) => console.error(`  ${i+1}. ${q}`));
                }
                process.exit(1);
            } else if (parsedData.status === 'BLOCK') {
                console.error("\n🛑 TestMate BLOCKED this code change. Fix issues before proceeding.");
                process.exit(1);
            } else {
                console.log(`\n✅ TestMate finished with ${parsedData.status}. Proceeding...`);
                process.exit(0);
            }
        } else {
            // Fallback если вдруг ИИ вернул неформатированный текст
            console.log(responseText);
            if (responseText.includes('"status": "BLOCK"')) {
                process.exit(1);
            }
            process.exit(0);
        }
    } catch (e) {
        console.error("Execution failed", e);
        process.exit(1);
    }
}

run();
