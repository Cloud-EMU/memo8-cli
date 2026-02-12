import inquirer from 'inquirer';
import ora from 'ora';
import { createApiClient } from '../lib/api.js';
import { getProjectId } from '../lib/config.js';
import { success, warn, handleError, printMemoryList, printMemoryDetail, printPagination, printStats, } from '../lib/output.js';
export function registerMemoryCommands(program) {
    const memory = program
        .command('memory')
        .description('Manage memories');
    memory
        .command('list')
        .description('List memories')
        .option('-p, --project <id>', 'Filter by project ID')
        .option('-t, --type <type>', 'Filter by type (note, snippet, link, file, image)')
        .option('-q, --search <query>', 'Search by title/content')
        .option('--per-page <n>', 'Items per page', '15')
        .option('--page <n>', 'Page number', '1')
        .action(async (opts) => {
        try {
            const spinner = ora('Fetching memories...').start();
            const api = createApiClient();
            const params = {
                per_page: opts.perPage,
                page: opts.page,
            };
            const projectId = opts.project || getProjectId();
            if (projectId)
                params.project_id = projectId;
            if (opts.type)
                params.type = opts.type;
            if (opts.search)
                params.search = opts.search;
            const { data } = await api.get('/memories', params);
            spinner.stop();
            printMemoryList(data.data);
            printPagination(data.meta);
        }
        catch (err) {
            handleError(err);
        }
    });
    memory
        .command('add')
        .description('Add a new memory')
        .option('-p, --project <id>', 'Project ID (uses local config if not provided)')
        .option('--title <title>', 'Memory title')
        .option('--content <content>', 'Memory content')
        .option('--type <type>', 'Type (note/code_snippet/link/idea/documentation)')
        .option('--tags <ids>', 'Comma-separated tag IDs')
        .option('--code-flow <chain>', 'Comma-separated call chain (e.g. "A.method(),B.method(),C.method()")')
        .action(async (opts) => {
        try {
            const projectId = opts.project || getProjectId();
            if (!projectId) {
                warn('No project specified. Use --project <id> or run: memo8 init');
                return;
            }
            let title;
            let content;
            let type;
            let tagIds;
            if (opts.title && opts.content) {
                // Non-interactive mode: use flag values with defaults
                title = opts.title;
                content = opts.content;
                type = opts.type || 'note';
                if (opts.tags) {
                    tagIds = opts.tags.split(',').map(Number);
                }
            }
            else {
                // Interactive mode: prompt user
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'title',
                        message: 'Memory title:',
                        validate: (v) => (v.length > 0 ? true : 'Title is required'),
                    },
                    {
                        type: 'editor',
                        name: 'content',
                        message: 'Content:',
                    },
                    {
                        type: 'list',
                        name: 'type',
                        message: 'Type:',
                        choices: ['note', 'code_snippet', 'link', 'idea', 'documentation'],
                        default: 'note',
                    },
                ]);
                title = answers.title;
                content = answers.content;
                type = answers.type;
            }
            const spinner = ora('Creating memory...').start();
            const api = createApiClient();
            const payload = {
                title,
                content,
                type,
                project_id: Number(projectId),
            };
            if (tagIds && tagIds.length > 0)
                payload.tag_ids = tagIds;
            if (opts.codeFlow) {
                payload.metadata = { code_flow: opts.codeFlow.split(',').map((s) => s.trim()) };
            }
            const { data } = await api.post('/memories', payload);
            spinner.stop();
            success(`Memory "${data.data.title}" created (#${data.data.id})`);
        }
        catch (err) {
            handleError(err);
        }
    });
    memory
        .command('show <id>')
        .description('Show memory details')
        .option('-i, --include <relations>', 'Include relations (project,tags,tasks)', 'project,tags,tasks')
        .action(async (id, opts) => {
        try {
            const spinner = ora('Fetching memory...').start();
            const api = createApiClient();
            const params = {};
            if (opts.include)
                params.include = opts.include;
            const { data } = await api.get(`/memories/${id}`, params);
            spinner.stop();
            printMemoryDetail(data.data);
        }
        catch (err) {
            handleError(err);
        }
    });
    memory
        .command('update <id>')
        .description('Update a memory')
        .option('--title <title>', 'Memory title')
        .option('--content <content>', 'Memory content')
        .option('--type <type>', 'Type (note/code_snippet/link/idea/documentation)')
        .option('--code-flow <chain>', 'Comma-separated call chain (e.g. "A.method(),B.method(),C.method()")')
        .action(async (id, opts) => {
        try {
            const api = createApiClient();
            let payload;
            if (opts.title || opts.content || opts.type || opts.codeFlow) {
                // Non-interactive mode
                payload = {};
                if (opts.title)
                    payload.title = opts.title;
                if (opts.content)
                    payload.content = opts.content;
                if (opts.type)
                    payload.type = opts.type;
                if (opts.codeFlow) {
                    payload.metadata = { code_flow: opts.codeFlow.split(',').map((s) => s.trim()) };
                }
            }
            else {
                // Interactive mode
                const spinner = ora('Fetching memory...').start();
                const { data: current } = await api.get(`/memories/${id}`);
                spinner.stop();
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'title',
                        message: 'Title:',
                        default: current.data.title,
                    },
                    {
                        type: 'editor',
                        name: 'content',
                        message: 'Content:',
                        default: current.data.content,
                    },
                    {
                        type: 'list',
                        name: 'type',
                        message: 'Type:',
                        choices: ['note', 'code_snippet', 'link', 'idea', 'documentation'],
                        default: current.data.type,
                    },
                ]);
                payload = answers;
            }
            const spinner = ora('Updating memory...').start();
            const { data } = await api.put(`/memories/${id}`, payload);
            spinner.stop();
            success(`Memory "${data.data.title}" updated.`);
        }
        catch (err) {
            handleError(err);
        }
    });
    memory
        .command('delete <id>')
        .description('Delete a memory')
        .option('-f, --force', 'Skip confirmation')
        .action(async (id, opts) => {
        try {
            if (!opts.force) {
                const { confirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `Are you sure you want to delete memory #${id}?`,
                        default: false,
                    },
                ]);
                if (!confirm)
                    return;
            }
            const spinner = ora('Deleting memory...').start();
            const api = createApiClient();
            await api.del(`/memories/${id}`);
            spinner.stop();
            success(`Memory #${id} deleted.`);
        }
        catch (err) {
            handleError(err);
        }
    });
    memory
        .command('search <query>')
        .description('Semantic search memories')
        .action(async (query) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Searching...').start();
            const api = createApiClient();
            const { data } = await api.get('/memories/search', {
                q: query,
                project_id: projectId,
            });
            spinner.stop();
            printMemoryList(data.data);
        }
        catch (err) {
            handleError(err);
        }
    });
    memory
        .command('link <id>')
        .description('Link a memory to a task')
        .requiredOption('--task <taskId>', 'Task ID to link')
        .action(async (id, opts) => {
        try {
            const spinner = ora('Linking...').start();
            const api = createApiClient();
            await api.post(`/memories/${id}/link-task`, {
                task_id: Number(opts.task),
            });
            spinner.stop();
            success(`Memory #${id} linked to task #${opts.task}`);
        }
        catch (err) {
            handleError(err);
        }
    });
    memory
        .command('unlink <id>')
        .description('Unlink a memory from a task')
        .requiredOption('--task <taskId>', 'Task ID to unlink')
        .action(async (id, opts) => {
        try {
            const spinner = ora('Unlinking...').start();
            const api = createApiClient();
            await api.post(`/memories/${id}/unlink-task`, {
                task_id: Number(opts.task),
            });
            spinner.stop();
            success(`Memory #${id} unlinked from task #${opts.task}`);
        }
        catch (err) {
            handleError(err);
        }
    });
    memory
        .command('stats')
        .description('Show memory statistics')
        .action(async () => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Fetching stats...').start();
            const api = createApiClient();
            const { data } = await api.get('/memories/stats', {
                project_id: projectId,
            });
            spinner.stop();
            printStats('Memory Statistics', data.data);
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=memory.js.map