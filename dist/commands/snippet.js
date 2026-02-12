import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { createApiClient } from '../lib/api.js';
import { getProjectId } from '../lib/config.js';
import { success, warn, info, handleError, printTable, printPagination, } from '../lib/output.js';
const COMMON_LANGUAGES = [
    'javascript',
    'typescript',
    'php',
    'python',
    'go',
    'rust',
    'java',
    'ruby',
    'css',
    'scss',
    'html',
    'sql',
    'bash',
    'yaml',
    'json',
    'other',
];
export function registerSnippetCommands(program) {
    const snippet = program
        .command('snippet')
        .description('Manage code snippets');
    snippet
        .command('list')
        .description('List snippets')
        .option('--per-page <n>', 'Items per page', '15')
        .option('--page <n>', 'Page number', '1')
        .action(async (opts) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Fetching snippets...').start();
            const api = createApiClient();
            const params = {
                per_page: opts.perPage,
                page: opts.page,
            };
            const { data } = await api.get(`/projects/${projectId}/snippets`, params);
            spinner.stop();
            if (data.data.length === 0) {
                info('No snippets found.');
                return;
            }
            const headers = ['ID', 'Title', 'Language', 'Usage', 'Updated'];
            const rows = data.data.map((s) => [
                String(s.id),
                s.title.length > 35 ? s.title.substring(0, 32) + '...' : s.title,
                s.language || '-',
                String(s.usageCount),
                new Date(s.updatedAt).toLocaleDateString(),
            ]);
            printTable(headers, rows);
            printPagination(data.meta);
        }
        catch (err) {
            handleError(err);
        }
    });
    snippet
        .command('add')
        .description('Add a new snippet')
        .option('--title <title>', 'Snippet title')
        .option('--language <lang>', 'Language')
        .option('--code <code>', 'Code content')
        .option('--description <desc>', 'Description')
        .option('--tags <tags>', 'Comma-separated tags')
        .action(async (opts) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            let title;
            let code;
            let language;
            let description;
            let tags;
            if (opts.title && opts.code) {
                // Non-interactive mode: use flag values
                title = opts.title;
                code = opts.code.trim();
                language = opts.language && opts.language !== 'other' ? opts.language : undefined;
                description = opts.description || undefined;
                if (opts.tags?.trim()) {
                    tags = opts.tags.split(',').map((t) => t.trim()).filter(Boolean);
                }
            }
            else {
                // Interactive mode: prompt user
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'title',
                        message: 'Snippet title:',
                        validate: (v) => (v.length > 0 ? true : 'Title is required'),
                    },
                    {
                        type: 'input',
                        name: 'description',
                        message: 'Description (optional):',
                    },
                    {
                        type: 'list',
                        name: 'language',
                        message: 'Language:',
                        choices: COMMON_LANGUAGES,
                    },
                    {
                        type: 'editor',
                        name: 'code',
                        message: 'Code (editor will open):',
                        validate: (v) => (v.trim().length > 0 ? true : 'Code is required'),
                    },
                    {
                        type: 'input',
                        name: 'tags',
                        message: 'Tags (comma-separated, optional):',
                    },
                ]);
                title = answers.title;
                code = answers.code.trim();
                language = answers.language !== 'other' ? answers.language : undefined;
                description = answers.description || undefined;
                if (answers.tags?.trim()) {
                    tags = answers.tags.split(',').map((t) => t.trim()).filter(Boolean);
                }
            }
            const spinner = ora('Creating snippet...').start();
            const api = createApiClient();
            const payload = {
                title,
                code,
                language,
            };
            if (description)
                payload.description = description;
            if (tags && tags.length > 0)
                payload.tags = tags;
            const { data } = await api.post(`/projects/${projectId}/snippets`, payload);
            spinner.stop();
            success(`Snippet "${data.data.title}" created (#${data.data.id})`);
        }
        catch (err) {
            handleError(err);
        }
    });
    snippet
        .command('show <id>')
        .description('Show snippet details')
        .action(async (id) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Fetching snippet...').start();
            const api = createApiClient();
            const { data } = await api.get(`/projects/${projectId}/snippets/${id}`);
            spinner.stop();
            const s = data.data;
            console.log();
            console.log(chalk.bold(`Snippet #${s.id}: ${s.title}`));
            console.log(chalk.gray('-'.repeat(50)));
            console.log(`  Language:    ${s.language || chalk.gray('(none)')}`);
            console.log(`  Usage:       ${s.usageCount} times`);
            if (s.description) {
                console.log(`  Description: ${s.description}`);
            }
            if (s.tags && s.tags.length > 0) {
                console.log(`  Tags:        ${s.tags.join(', ')}`);
            }
            console.log(`  Created:     ${new Date(s.createdAt).toLocaleString()}`);
            console.log(`  Updated:     ${new Date(s.updatedAt).toLocaleString()}`);
            console.log();
            console.log(chalk.bold('Code'));
            console.log(chalk.gray('-'.repeat(50)));
            console.log(s.code);
            console.log();
        }
        catch (err) {
            handleError(err);
        }
    });
    snippet
        .command('search <query>')
        .description('Search snippets')
        .action(async (query) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Searching snippets...').start();
            const api = createApiClient();
            const { data } = await api.get(`/projects/${projectId}/snippets/search`, { q: query });
            spinner.stop();
            if (data.data.length === 0) {
                info('No snippets found matching your query.');
                return;
            }
            const headers = ['ID', 'Title', 'Language', 'Usage', 'Updated'];
            const rows = data.data.map((s) => [
                String(s.id),
                s.title.length > 35 ? s.title.substring(0, 32) + '...' : s.title,
                s.language || '-',
                String(s.usageCount),
                new Date(s.updatedAt).toLocaleDateString(),
            ]);
            printTable(headers, rows);
        }
        catch (err) {
            handleError(err);
        }
    });
    snippet
        .command('copy <id>')
        .description('Copy snippet code to stdout')
        .action(async (id) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const api = createApiClient();
            const { data } = await api.get(`/projects/${projectId}/snippets/${id}`);
            // Write raw code to stdout so it can be piped
            process.stdout.write(data.data.code);
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=snippet.js.map