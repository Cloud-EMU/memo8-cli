import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { createApiClient } from '../lib/api.js';
import { getProjectId } from '../lib/config.js';
import {
  success,
  warn,
  info,
  handleError,
  printTaskList,
  printTaskDetail,
  printPagination,
  printStats,
} from '../lib/output.js';
import type {
  PaginatedResponse,
  ApiResponse,
  Task,
  StatsData,
  DependencyGraphNode,
} from '../types/index.js';

export function registerTaskCommands(program: Command): void {
  const task = program
    .command('task')
    .description('Manage tasks');

  task
    .command('list')
    .description('List tasks')
    .option('-p, --project <id>', 'Filter by project ID')
    .option('-s, --status <status>', 'Filter by status (pending, in_progress, completed, cancelled)')
    .option('--priority <priority>', 'Filter by priority (low, medium, high, urgent)')
    .option('-q, --search <query>', 'Search by title/description')
    .option('--root-only', 'Only show root tasks (no subtasks)')
    .option('--per-page <n>', 'Items per page', '15')
    .option('--page <n>', 'Page number', '1')
    .action(async (opts) => {
      try {
        const spinner = ora('Fetching tasks...').start();
        const api = createApiClient();

        const params: Record<string, unknown> = {
          per_page: opts.perPage,
          page: opts.page,
        };
        const projectId = opts.project || getProjectId();
        if (projectId) params.project_id = projectId;
        if (opts.status) params.status = opts.status;
        if (opts.priority) params.priority = opts.priority;
        if (opts.search) params.search = opts.search;
        if (opts.rootOnly) params.root_only = true;

        const { data } = await api.get<PaginatedResponse<Task>>('/tasks', params);
        spinner.stop();

        printTaskList(data.data);
        printPagination(data.meta);
      } catch (err) {
        handleError(err);
      }
    });

  task
    .command('create')
    .description('Create a new task')
    .option('-p, --project <id>', 'Project ID (uses local config if not provided)')
    .option('--title <title>', 'Task title')
    .option('--description <desc>', 'Task description')
    .option('--priority <priority>', 'Priority (low/medium/high/urgent)')
    .option('--status <status>', 'Status (pending/in_progress/completed/cancelled)')
    .option('--tags <ids>', 'Comma-separated tag IDs')
    .action(async (opts) => {
      try {
        const projectId = opts.project || getProjectId();
        if (!projectId) {
          warn('No project specified. Use --project <id> or run: memo8 init');
          return;
        }

        let title: string;
        let description: string | undefined;
        let status: string;
        let priority: string;
        let tagIds: number[] | undefined;

        if (opts.title) {
          // Non-interactive mode: use flag values with defaults
          title = opts.title;
          description = opts.description || undefined;
          status = opts.status || 'pending';
          priority = opts.priority || 'medium';
          if (opts.tags) {
            tagIds = opts.tags.split(',').map(Number);
          }
        } else {
          // Interactive mode: prompt user
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'title',
              message: 'Task title:',
              validate: (v: string) => (v.length > 0 ? true : 'Title is required'),
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
              choices: ['pending', 'in_progress', 'completed', 'cancelled'],
              default: 'pending',
            },
            {
              type: 'list',
              name: 'priority',
              message: 'Priority:',
              choices: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
            },
          ]);
          title = answers.title;
          description = answers.description || undefined;
          status = answers.status;
          priority = answers.priority;
        }

        const spinner = ora('Creating task...').start();
        const api = createApiClient();

        const payload: Record<string, unknown> = {
          title,
          status,
          priority,
          project_id: Number(projectId),
        };
        if (description) payload.description = description;
        if (tagIds && tagIds.length > 0) payload.tag_ids = tagIds;

        const { data } = await api.post<ApiResponse<Task>>('/tasks', payload);
        spinner.stop();

        success(`Task "${data.data.title}" created (#${data.data.id})`);
      } catch (err) {
        handleError(err);
      }
    });

  task
    .command('show <id>')
    .description('Show task details')
    .option('-i, --include <relations>', 'Include relations (project,tags,memories,subtasks,parent)', 'project,tags,subtasks')
    .action(async (id: string, opts) => {
      try {
        const spinner = ora('Fetching task...').start();
        const api = createApiClient();

        const params: Record<string, unknown> = {};
        if (opts.include) params.include = opts.include;

        const { data } = await api.get<{ data: Task }>(`/tasks/${id}`, params);
        spinner.stop();

        printTaskDetail(data.data);
      } catch (err) {
        handleError(err);
      }
    });

  task
    .command('update <id>')
    .description('Update a task')
    .option('--title <title>', 'Task title')
    .option('--description <desc>', 'Task description')
    .option('--status <status>', 'Status (pending/in_progress/completed/cancelled)')
    .option('--priority <priority>', 'Priority (low/medium/high/urgent)')
    .action(async (id: string, opts: { title?: string; description?: string; status?: string; priority?: string }) => {
      try {
        const api = createApiClient();

        let payload: Record<string, string>;

        if (opts.title || opts.description !== undefined || opts.status || opts.priority) {
          // Non-interactive mode
          payload = {};
          if (opts.title) payload.title = opts.title;
          if (opts.description !== undefined) payload.description = opts.description;
          if (opts.status) payload.status = opts.status;
          if (opts.priority) payload.priority = opts.priority;
        } else {
          // Interactive mode
          const spinner = ora('Fetching task...').start();
          const { data: current } = await api.get<{ data: Task }>(`/tasks/${id}`);
          spinner.stop();

          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'title',
              message: 'Title:',
              default: current.data.title,
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
              choices: ['pending', 'in_progress', 'completed', 'cancelled'],
              default: current.data.status,
            },
            {
              type: 'list',
              name: 'priority',
              message: 'Priority:',
              choices: ['low', 'medium', 'high', 'urgent'],
              default: current.data.priority,
            },
          ]);
          payload = answers;
        }

        const spinner = ora('Updating task...').start();
        const { data } = await api.put<ApiResponse<Task>>(`/tasks/${id}`, payload);
        spinner.stop();

        success(`Task "${data.data.title}" updated.`);
      } catch (err) {
        handleError(err);
      }
    });

  task
    .command('delete <id>')
    .description('Delete a task')
    .option('-f, --force', 'Skip confirmation')
    .action(async (id: string, opts: { force?: boolean }) => {
      try {
        if (!opts.force) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to delete task #${id}?`,
              default: false,
            },
          ]);

          if (!confirm) return;
        }

        const spinner = ora('Deleting task...').start();
        const api = createApiClient();

        await api.del(`/tasks/${id}`);
        spinner.stop();

        success(`Task #${id} deleted.`);
      } catch (err) {
        handleError(err);
      }
    });

  // Shortcut commands
  task
    .command('start <id>')
    .description('Start a task (set status to in_progress)')
    .action(async (id: string) => {
      try {
        const spinner = ora('Starting task...').start();
        const api = createApiClient();

        const { data } = await api.put<ApiResponse<Task>>(`/tasks/${id}`, {
          status: 'in_progress',
        });
        spinner.stop();

        success(`Task #${id} "${data.data.title}" is now in progress.`);
      } catch (err) {
        handleError(err);
      }
    });

  task
    .command('stop <id>')
    .description('Stop a task (set status to pending)')
    .action(async (id: string) => {
      try {
        const spinner = ora('Stopping task...').start();
        const api = createApiClient();

        const { data } = await api.put<ApiResponse<Task>>(`/tasks/${id}`, {
          status: 'pending',
        });
        spinner.stop();

        success(`Task #${id} "${data.data.title}" moved back to pending.`);
      } catch (err) {
        handleError(err);
      }
    });

  task
    .command('done <id>')
    .description('Complete a task (set status to completed)')
    .action(async (id: string) => {
      try {
        const spinner = ora('Completing task...').start();
        const api = createApiClient();

        const { data } = await api.put<ApiResponse<Task>>(`/tasks/${id}`, {
          status: 'completed',
        });
        spinner.stop();

        success(`Task #${id} "${data.data.title}" completed!`);
      } catch (err) {
        handleError(err);
      }
    });

  task
    .command('sub <parentId>')
    .description('Create a subtask under a parent task')
    .option('--title <title>', 'Subtask title')
    .option('--description <desc>', 'Subtask description')
    .option('--priority <priority>', 'Priority (low/medium/high/urgent)')
    .option('--status <status>', 'Status (pending/in_progress/completed/cancelled)')
    .action(async (parentId: string, opts: { title?: string; description?: string; priority?: string; status?: string }) => {
      try {
        const api = createApiClient();
        let spinner = ora('Fetching parent task...').start();

        const { data: parent } = await api.get<{ data: Task }>(`/tasks/${parentId}`);
        spinner.stop();

        let title: string;
        let description: string | undefined;
        let priority: string;
        let status: string;

        if (opts.title) {
          // Non-interactive mode
          title = opts.title;
          description = opts.description || undefined;
          priority = opts.priority || 'medium';
          status = opts.status || 'pending';
        } else {
          // Interactive mode
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'title',
              message: `Subtask title (under "${parent.data.title}"):`,
              validate: (v: string) => (v.length > 0 ? true : 'Title is required'),
            },
            {
              type: 'input',
              name: 'description',
              message: 'Description (optional):',
            },
            {
              type: 'list',
              name: 'priority',
              message: 'Priority:',
              choices: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
            },
          ]);
          title = answers.title;
          description = answers.description || undefined;
          priority = answers.priority;
          status = 'pending';
        }

        spinner = ora('Creating subtask...').start();
        const { data } = await api.post<ApiResponse<Task>>('/tasks', {
          title,
          description,
          status,
          priority,
          project_id: parent.data.projectId,
          parent_task_id: Number(parentId),
        });
        spinner.stop();

        success(`Subtask "${data.data.title}" created (#${data.data.id}) under #${parentId}`);
      } catch (err) {
        handleError(err);
      }
    });

  task
    .command('graph')
    .description('Show task dependency graph')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching dependency graph...').start();
        const api = createApiClient();

        const { data } = await api.get<ApiResponse<DependencyGraphNode[]>>(
          `/projects/${projectId}/tasks/dependency-graph`
        );
        spinner.stop();

        const nodes = data.data;
        if (!nodes || nodes.length === 0) {
          info('No tasks with dependencies found.');
          return;
        }

        console.log();
        console.log(chalk.bold('Task Dependency Graph'));
        console.log(chalk.gray('─'.repeat(50)));
        for (const node of nodes) {
          const deps = node.dependsOn.length > 0
            ? chalk.gray(` → depends on: ${node.dependsOn.map(d => `#${d}`).join(', ')}`)
            : '';
          const order = node.executionOrder !== null
            ? chalk.cyan(` [order: ${node.executionOrder}]`)
            : '';
          console.log(`  #${node.id} ${node.title} [${node.status}]${order}${deps}`);
        }
        console.log();
      } catch (err) {
        handleError(err);
      }
    });

  task
    .command('next')
    .description('Show next available tasks to work on')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching next tasks...').start();
        const api = createApiClient();

        const { data } = await api.get<ApiResponse<Task[]>>(
          `/projects/${projectId}/tasks/next`
        );
        spinner.stop();

        const tasks = data.data;
        if (!tasks || tasks.length === 0) {
          info('No available tasks. All done or blocked!');
          return;
        }

        console.log();
        console.log(chalk.bold('Next Available Tasks'));
        console.log(chalk.gray('─'.repeat(50)));
        for (const t of tasks) {
          console.log(`  #${t.id} ${t.title} [${t.priority}]`);
        }
        console.log();
      } catch (err) {
        handleError(err);
      }
    });

  task
    .command('stats')
    .description('Show task statistics')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching stats...').start();
        const api = createApiClient();

        const { data } = await api.get<ApiResponse<StatsData>>('/tasks/stats', {
          project_id: projectId,
        });
        spinner.stop();

        printStats('Task Statistics', data.data);
      } catch (err) {
        handleError(err);
      }
    });
}
