import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { createApiClient } from '../lib/api.js';
import {
  success,
  handleError,
  printTagList,
  printTagDetail,
  printPagination,
} from '../lib/output.js';
import type {
  PaginatedResponse,
  ApiResponse,
  Tag,
} from '../types/index.js';

export function registerTagCommands(program: Command): void {
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

        const params: Record<string, unknown> = {
          per_page: opts.perPage,
          page: opts.page,
        };
        if (opts.search) params.search = opts.search;

        const { data } = await api.get<PaginatedResponse<Tag>>('/tags', params);
        spinner.stop();

        printTagList(data.data);
        printPagination(data.meta);
      } catch (err) {
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
        let name: string;
        let color: string | undefined;
        let description: string | undefined;

        if (opts.name) {
          // Non-interactive mode: use flag values
          name = opts.name;
          color = opts.color || undefined;
          description = opts.description || undefined;
        } else {
          // Interactive mode: prompt user
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Tag name:',
              validate: (v: string) => (v.length > 0 ? true : 'Name is required'),
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

        const payload: Record<string, string> = { name };
        if (color) payload.color = color;
        if (description) payload.description = description;

        const { data, status } = await api.post<ApiResponse<Tag>>('/tags', payload);
        spinner.stop();

        if (status === 200) {
          success(`Tag "${data.data.name}" already exists (#${data.data.id})`);
        } else {
          success(`Tag "${data.data.name}" created (#${data.data.id})`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  tag
    .command('show <id>')
    .description('Show tag details')
    .option('--with-counts', 'Include task/memory counts')
    .action(async (id: string, opts) => {
      try {
        const spinner = ora('Fetching tag...').start();
        const api = createApiClient();

        const params: Record<string, unknown> = {};
        if (opts.withCounts) params.withCounts = true;

        const { data } = await api.get<{ data: Tag }>(`/tags/${id}`, params);
        spinner.stop();

        printTagDetail(data.data);
      } catch (err) {
        handleError(err);
      }
    });

  tag
    .command('update <id>')
    .description('Update a tag')
    .option('--name <name>', 'Tag name')
    .option('--color <color>', 'Color hex')
    .option('--description <desc>', 'Tag description')
    .action(async (id: string, opts: { name?: string; color?: string; description?: string }) => {
      try {
        const api = createApiClient();

        let payload: Record<string, string>;

        if (opts.name || opts.color || opts.description !== undefined) {
          // Non-interactive mode
          payload = {};
          if (opts.name) payload.name = opts.name;
          if (opts.color) payload.color = opts.color;
          if (opts.description !== undefined) payload.description = opts.description;
        } else {
          // Interactive mode
          const spinner = ora('Fetching tag...').start();
          const { data: current } = await api.get<{ data: Tag }>(`/tags/${id}`);
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
        const { data } = await api.put<ApiResponse<Tag>>(`/tags/${id}`, payload);
        spinner.stop();

        success(`Tag "${data.data.name}" updated.`);
      } catch (err) {
        handleError(err);
      }
    });

  tag
    .command('delete <id>')
    .description('Delete a tag')
    .option('-f, --force', 'Skip confirmation')
    .action(async (id: string, opts: { force?: boolean }) => {
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

          if (!confirm) return;
        }

        const spinner = ora('Deleting tag...').start();
        const api = createApiClient();

        await api.del(`/tags/${id}`);
        spinner.stop();

        success(`Tag #${id} deleted.`);
      } catch (err) {
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

        const { data } = await api.get<{ data: Tag[] }>('/tags/with-counts');
        spinner.stop();

        printTagList(data.data);
      } catch (err) {
        handleError(err);
      }
    });
}
