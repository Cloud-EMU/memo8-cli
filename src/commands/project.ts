import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { createApiClient } from '../lib/api.js';
import {
  success,
  handleError,
  printProjectList,
  printProjectDetail,
  printPagination,
  printStats,
} from '../lib/output.js';
import type {
  PaginatedResponse,
  ApiResponse,
  Project,
  StatsData,
} from '../types/index.js';

export function registerProjectCommands(program: Command): void {
  const project = program
    .command('project')
    .description('Manage projects');

  project
    .command('list')
    .description('List all projects')
    .option('-s, --status <status>', 'Filter by status (active, archived, completed)')
    .option('-q, --search <query>', 'Search by name/description')
    .option('--per-page <n>', 'Items per page', '15')
    .option('--page <n>', 'Page number', '1')
    .action(async (opts) => {
      try {
        const spinner = ora('Fetching projects...').start();
        const api = createApiClient();

        const params: Record<string, unknown> = {
          per_page: opts.perPage,
          page: opts.page,
        };
        if (opts.status) params.status = opts.status;
        if (opts.search) params.search = opts.search;

        const { data } = await api.get<PaginatedResponse<Project>>('/projects', params);
        spinner.stop();

        printProjectList(data.data);
        printPagination(data.meta);
      } catch (err) {
        handleError(err);
      }
    });

  project
    .command('create')
    .description('Create a new project')
    .option('--name <name>', 'Project name')
    .option('--description <desc>', 'Project description')
    .option('--status <status>', 'Status (active/archived/completed)')
    .action(async (opts: { name?: string; description?: string; status?: string }) => {
      try {
        let name: string;
        let description: string | undefined;
        let status: string;

        if (opts.name) {
          name = opts.name;
          description = opts.description || undefined;
          status = opts.status || 'active';
        } else {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Project name:',
              validate: (v: string) => (v.length > 0 ? true : 'Name is required'),
            },
            {
              type: 'input',
              name: 'description',
              message: 'Description (optional):',
            },
            {
              type: 'list',
              name: 'status',
              message: 'Status:',
              choices: ['active', 'archived', 'completed'],
              default: 'active',
            },
          ]);
          name = answers.name;
          description = answers.description || undefined;
          status = answers.status;
        }

        const spinner = ora('Creating project...').start();
        const api = createApiClient();

        const payload: Record<string, string> = { name, status };
        if (description) payload.description = description;

        const { data } = await api.post<ApiResponse<Project>>('/projects', payload);
        spinner.stop();

        success(`Project "${data.data.name}" created (#${data.data.id})`);
      } catch (err) {
        handleError(err);
      }
    });

  project
    .command('show <id>')
    .description('Show project details')
    .option('-i, --include <relations>', 'Include relations (tasks,memories)')
    .option('--with-stats', 'Include task/memory counts')
    .action(async (id: string, opts) => {
      try {
        const spinner = ora('Fetching project...').start();
        const api = createApiClient();

        const params: Record<string, unknown> = {};
        if (opts.include) params.include = opts.include;
        if (opts.withStats) params.withStats = true;

        const { data } = await api.get<{ data: Project }>(`/projects/${id}`, params);
        spinner.stop();

        printProjectDetail(data.data);
      } catch (err) {
        handleError(err);
      }
    });

  project
    .command('update <id>')
    .description('Update a project')
    .option('--name <name>', 'Project name')
    .option('--description <desc>', 'Project description')
    .option('--status <status>', 'Status (active/archived/completed)')
    .action(async (id: string, opts: { name?: string; description?: string; status?: string }) => {
      try {
        const api = createApiClient();

        let payload: Record<string, string>;

        if (opts.name || opts.description !== undefined || opts.status) {
          // Non-interactive mode
          payload = {};
          if (opts.name) payload.name = opts.name;
          if (opts.description !== undefined) payload.description = opts.description;
          if (opts.status) payload.status = opts.status;
        } else {
          // Interactive mode
          const spinner = ora('Fetching project...').start();
          const { data: current } = await api.get<{ data: Project }>(`/projects/${id}`);
          spinner.stop();

          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Project name:',
              default: current.data.name,
            },
            {
              type: 'input',
              name: 'description',
              message: 'Description:',
              default: current.data.description || '',
            },
            {
              type: 'list',
              name: 'status',
              message: 'Status:',
              choices: ['active', 'archived', 'completed'],
              default: current.data.status,
            },
          ]);
          payload = answers;
        }

        const spinner = ora('Updating project...').start();
        const { data } = await api.put<ApiResponse<Project>>(`/projects/${id}`, payload);
        spinner.stop();

        success(`Project "${data.data.name}" updated.`);
      } catch (err) {
        handleError(err);
      }
    });

  project
    .command('delete <id>')
    .description('Delete a project')
    .option('-f, --force', 'Skip confirmation')
    .action(async (id: string, opts: { force?: boolean }) => {
      try {
        if (!opts.force) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to delete project #${id}? This cannot be undone.`,
              default: false,
            },
          ]);

          if (!confirm) return;
        }

        const spinner = ora('Deleting project...').start();
        const api = createApiClient();

        await api.del(`/projects/${id}`);
        spinner.stop();

        success(`Project #${id} deleted.`);
      } catch (err) {
        handleError(err);
      }
    });

  project
    .command('stats')
    .description('Show project statistics')
    .action(async () => {
      try {
        const spinner = ora('Fetching stats...').start();
        const api = createApiClient();

        const { data } = await api.get<ApiResponse<StatsData>>('/projects/stats');
        spinner.stop();

        printStats('Project Statistics', data.data);
      } catch (err) {
        handleError(err);
      }
    });
}
