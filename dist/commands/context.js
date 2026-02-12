import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ora from 'ora';
import chalk from 'chalk';
import { createApiClient } from '../lib/api.js';
import { getProjectId } from '../lib/config.js';
import { success, warn, info, handleError, } from '../lib/output.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function getCliRootDir() {
    // From src/commands/ or dist/commands/ → go up 2 levels to cli/
    return path.resolve(__dirname, '..', '..');
}
function readHelperFile(filename) {
    const helperPath = path.join(getCliRootDir(), 'ai-rules', filename);
    if (fs.existsSync(helperPath)) {
        return fs.readFileSync(helperPath, 'utf-8').trim();
    }
    return '';
}
export function registerContextCommands(program) {
    program
        .command('context')
        .description('Build AI context for the current project')
        .option('-t, --task <id>', 'Build context for a specific task')
        .option('--topic <query>', 'Build context for a specific topic')
        .option('--copy', 'Print info about copying to clipboard')
        .action(async (opts) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Building AI context...').start();
            const api = createApiClient();
            let endpoint;
            const params = {};
            if (opts.task) {
                endpoint = `/projects/${projectId}/ai-context/task/${opts.task}`;
            }
            else if (opts.topic) {
                endpoint = `/projects/${projectId}/ai-context/topic`;
                params.q = opts.topic;
            }
            else {
                endpoint = `/projects/${projectId}/ai-context`;
            }
            const { data } = await api.get(endpoint, params);
            spinner.stop();
            const context = data.data;
            if (!opts.topic) {
                const helper = readHelperFile('CLAUDE.md');
                if (helper) {
                    console.log(helper);
                    console.log('\n## Live Project Data\n');
                }
            }
            console.log(context.context);
            if (opts.copy) {
                console.log();
                info(`Token estimate: ~${context.tokenEstimate} tokens`);
                info('To copy to clipboard, pipe the output:');
                console.log(chalk.cyan('  memo8 context | pbcopy'));
                console.log(chalk.cyan('  memo8 context --task 5 | xclip -selection clipboard'));
            }
        }
        catch (err) {
            handleError(err);
        }
    });
    program
        .command('context:cursor')
        .description('Generate .cursor/rules/memo8.mdc with project context')
        .action(async () => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Building context for Cursor rules...').start();
            const api = createApiClient();
            const { data } = await api.get(`/projects/${projectId}/ai-context`);
            spinner.stop();
            const rulesDir = path.join(process.cwd(), '.cursor', 'rules');
            const rulePath = path.join(rulesDir, 'memo8.mdc');
            if (!fs.existsSync(rulesDir)) {
                fs.mkdirSync(rulesDir, { recursive: true });
            }
            const helper = readHelperFile('cursor-rules.md');
            const contextBlock = data.data.context;
            const mdcContent = [
                '---',
                'description: "memo8 project context - conventions, tech stack, decisions"',
                'alwaysApply: true',
                '---',
                '',
                helper,
                '',
                '## Live Project Data',
                '',
                contextBlock,
                '',
            ].join('\n');
            fs.writeFileSync(rulePath, mdcContent);
            success('Created .cursor/rules/memo8.mdc with project context.');
            info(`Token estimate: ~${data.data.tokenEstimate} tokens`);
        }
        catch (err) {
            handleError(err);
        }
    });
    program
        .command('context:update-claude-md')
        .description('Update .claude/CLAUDE.md with project context')
        .action(async () => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Building context for CLAUDE.md...').start();
            const api = createApiClient();
            const { data } = await api.get(`/projects/${projectId}/ai-context`);
            spinner.stop();
            const claudeDir = path.join(process.cwd(), '.claude');
            const claudeMdPath = path.join(claudeDir, 'CLAUDE.md');
            // Ensure .claude directory exists
            if (!fs.existsSync(claudeDir)) {
                fs.mkdirSync(claudeDir, { recursive: true });
            }
            const helper = readHelperFile('CLAUDE.md');
            const contextBlock = data.data.context;
            const marker = '<!-- memo8-context-start -->';
            const endMarker = '<!-- memo8-context-end -->';
            const liveData = contextBlock ? `\n## Live Project Data\n\n${contextBlock}` : '';
            const wrappedContext = `${marker}\n${helper}${liveData}\n${endMarker}`;
            if (fs.existsSync(claudeMdPath)) {
                let existing = fs.readFileSync(claudeMdPath, 'utf-8');
                // Check if there is already a memo8 context block
                const startIdx = existing.indexOf(marker);
                const endIdx = existing.indexOf(endMarker);
                if (startIdx !== -1 && endIdx !== -1) {
                    // Replace existing block
                    existing =
                        existing.substring(0, startIdx) +
                            wrappedContext +
                            existing.substring(endIdx + endMarker.length);
                }
                else {
                    // Append to file
                    existing = existing.trimEnd() + '\n\n' + wrappedContext + '\n';
                }
                fs.writeFileSync(claudeMdPath, existing);
                success('Updated .claude/CLAUDE.md with latest project context.');
            }
            else {
                // Create new file
                const content = `# Project Context\n\n${wrappedContext}\n`;
                fs.writeFileSync(claudeMdPath, content);
                success('Created .claude/CLAUDE.md with project context.');
            }
            info(`Token estimate: ~${data.data.tokenEstimate} tokens`);
        }
        catch (err) {
            handleError(err);
        }
    });
    program
        .command('context:codex')
        .description('Generate AGENTS.md with project context (OpenAI Codex)')
        .action(async () => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Building context for AGENTS.md...').start();
            const api = createApiClient();
            const { data } = await api.get(`/projects/${projectId}/ai-context`);
            spinner.stop();
            const agentsMdPath = path.join(process.cwd(), 'AGENTS.md');
            const helper = readHelperFile('codex-rules.md');
            const contextBlock = data.data.context;
            const marker = '<!-- memo8-context-start -->';
            const endMarker = '<!-- memo8-context-end -->';
            const liveData = contextBlock ? `\n## Live Project Data\n\n${contextBlock}` : '';
            const wrappedContext = `${marker}\n${helper}${liveData}\n${endMarker}`;
            if (fs.existsSync(agentsMdPath)) {
                let existing = fs.readFileSync(agentsMdPath, 'utf-8');
                const startIdx = existing.indexOf(marker);
                const endIdx = existing.indexOf(endMarker);
                if (startIdx !== -1 && endIdx !== -1) {
                    existing =
                        existing.substring(0, startIdx) +
                            wrappedContext +
                            existing.substring(endIdx + endMarker.length);
                }
                else {
                    existing = existing.trimEnd() + '\n\n' + wrappedContext + '\n';
                }
                fs.writeFileSync(agentsMdPath, existing);
                success('Updated AGENTS.md with latest project context.');
            }
            else {
                const content = `# Project Context\n\n${wrappedContext}\n`;
                fs.writeFileSync(agentsMdPath, content);
                success('Created AGENTS.md with project context.');
            }
            info(`Token estimate: ~${data.data.tokenEstimate} tokens`);
        }
        catch (err) {
            handleError(err);
        }
    });
    program
        .command('context:gemini')
        .description('Generate .gemini/GEMINI.md with project context (Google Gemini)')
        .action(async () => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Building context for GEMINI.md...').start();
            const api = createApiClient();
            const { data } = await api.get(`/projects/${projectId}/ai-context`);
            spinner.stop();
            const geminiDir = path.join(process.cwd(), '.gemini');
            const geminiMdPath = path.join(geminiDir, 'GEMINI.md');
            if (!fs.existsSync(geminiDir)) {
                fs.mkdirSync(geminiDir, { recursive: true });
            }
            const helper = readHelperFile('gemini-rules.md');
            const contextBlock = data.data.context;
            const marker = '<!-- memo8-context-start -->';
            const endMarker = '<!-- memo8-context-end -->';
            const liveData = contextBlock ? `\n## Live Project Data\n\n${contextBlock}` : '';
            const wrappedContext = `${marker}\n${helper}${liveData}\n${endMarker}`;
            if (fs.existsSync(geminiMdPath)) {
                let existing = fs.readFileSync(geminiMdPath, 'utf-8');
                const startIdx = existing.indexOf(marker);
                const endIdx = existing.indexOf(endMarker);
                if (startIdx !== -1 && endIdx !== -1) {
                    existing =
                        existing.substring(0, startIdx) +
                            wrappedContext +
                            existing.substring(endIdx + endMarker.length);
                }
                else {
                    existing = existing.trimEnd() + '\n\n' + wrappedContext + '\n';
                }
                fs.writeFileSync(geminiMdPath, existing);
                success('Updated .gemini/GEMINI.md with latest project context.');
            }
            else {
                const content = `# Project Context\n\n${wrappedContext}\n`;
                fs.writeFileSync(geminiMdPath, content);
                success('Created .gemini/GEMINI.md with project context.');
            }
            info(`Token estimate: ~${data.data.tokenEstimate} tokens`);
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=context.js.map