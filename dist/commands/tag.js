import inquirer from 'inquirer';
import ora from 'ora';
import { createApiClient } from '../lib/api.js';
import { success, handleError, printTagList, printTagDetail, printPagination, } from '../lib/output.js';
export function registerTagCommands(program) {
    const tag = program
        .command('tag')
        .description('Manage tags');
    tag
        .command('list')
        .description('List all tags')
        .option('-q, --search <query>', 'Search by name')
        .option('--per-page <n>', 'Items per page', '50')
        .option('--page <n>', 'Page number', '1')
        .action(async (opts) => {
        try {
            const spinner = ora('Fetching tags...').start();
            const api = createApiClient();
            const params = {
                per_page: opts.perPage,
                page: opts.page,
            };
            if (opts.search)
                params.search = opts.search;
            const { data } = await api.get('/tags', params);
            spinner.stop();
            printTagList(data.data);
            printPagination(data.meta);
        }
        catch (err) {
            handleError(err);
        }
    });
    tag
        .command('create')
        .description('Create a new tag')
        .option('--name <name>', 'Tag name')
        .option('--color <color>', 'Tag color hex')
        .option('--description <desc>', 'Tag description')
        .action(async (opts) => {
        try {
            let name;
            let color;
            let description;
            if (opts.name) {
                // Non-interactive mode: use flag values
                name = opts.name;
                color = opts.color || undefined;
                description = opts.description || undefined;
            }
            else {
                // Interactive mode: prompt user
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'name',
                        message: 'Tag name:',
                        validate: (v) => (v.length > 0 ? true : 'Name is required'),
                    },
                    {
                        type: 'input',
                        name: 'color',
                        message: 'Color hex (e.g. #ff6600, optional):',
                    },
                    {
                        type: 'input',
                        name: 'description',
                        message: 'Description (optional):',
                    },
                ]);
                name = answers.name;
                color = answers.color || undefined;
                description = answers.description || undefined;
            }
            const spinner = ora('Creating tag...').start();
            const api = createApiClient();
            const payload = { name };
            if (color)
                payload.color = color;
            if (description)
                payload.description = description;
            const { data, status } = await api.post('/tags', payload);
            spinner.stop();
            if (status === 200) {
                success(`Tag "${data.data.name}" already exists (#${data.data.id})`);
            }
            else {
                success(`Tag "${data.data.name}" created (#${data.data.id})`);
            }
        }
        catch (err) {
            handleError(err);
        }
    });
    tag
        .command('show <id>')
        .description('Show tag details')
        .option('--with-counts', 'Include task/memory counts')
        .action(async (id, opts) => {
        try {
            const spinner = ora('Fetching tag...').start();
            const api = createApiClient();
            const params = {};
            if (opts.withCounts)
                params.withCounts = true;
            const { data } = await api.get(`/tags/${id}`, params);
            spinner.stop();
            printTagDetail(data.data);
        }
        catch (err) {
            handleError(err);
        }
    });
    tag
        .command('update <id>')
        .description('Update a tag')
        .option('--name <name>', 'Tag name')
        .option('--color <color>', 'Color hex')
        .option('--description <desc>', 'Tag description')
        .action(async (id, opts) => {
        try {
            const api = createApiClient();
            let payload;
            if (opts.name || opts.color || opts.description !== undefined) {
                // Non-interactive mode
                payload = {};
                if (opts.name)
                    payload.name = opts.name;
                if (opts.color)
                    payload.color = opts.color;
                if (opts.description !== undefined)
                    payload.description = opts.description;
            }
            else {
                // Interactive mode
                const spinner = ora('Fetching tag...').start();
                const { data: current } = await api.get(`/tags/${id}`);
                spinner.stop();
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'name',
                        message: 'Tag name:',
                        default: current.data.name,
                    },
                    {
                        type: 'input',
                        name: 'color',
                        message: 'Color hex:',
                        default: current.data.color || '',
                    },
                    {
                        type: 'input',
                        name: 'description',
                        message: 'Description:',
                        default: current.data.description || '',
                    },
                ]);
                payload = answers;
            }
            const spinner = ora('Updating tag...').start();
            const { data } = await api.put(`/tags/${id}`, payload);
            spinner.stop();
            success(`Tag "${data.data.name}" updated.`);
        }
        catch (err) {
            handleError(err);
        }
    });
    tag
        .command('delete <id>')
        .description('Delete a tag')
        .option('-f, --force', 'Skip confirmation')
        .action(async (id, opts) => {
        try {
            if (!opts.force) {
                const { confirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `Are you sure you want to delete tag #${id}?`,
                        default: false,
                    },
                ]);
                if (!confirm)
                    return;
            }
            const spinner = ora('Deleting tag...').start();
            const api = createApiClient();
            await api.del(`/tags/${id}`);
            spinner.stop();
            success(`Tag #${id} deleted.`);
        }
        catch (err) {
            handleError(err);
        }
    });
    tag
        .command('with-counts')
        .description('List all tags with task/memory counts')
        .action(async () => {
        try {
            const spinner = ora('Fetching tags...').start();
            const api = createApiClient();
            const { data } = await api.get('/tags/with-counts');
            spinner.stop();
            printTagList(data.data);
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=tag.js.map