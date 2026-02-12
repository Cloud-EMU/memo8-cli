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
  printTable,
  printPagination,
} from '../lib/output.js';
import type {
  ApiResponse,
  PaginatedResponse,
  Decision,
} from '../types/index.js';

const DECISION_STATUSES = [
  'proposed',
  'accepted',
  'deprecated',
  'superseded',
];

function statusColor(status: string): string {
  switch (status) {
    case 'proposed':
      return chalk.yellow(status);
    case 'accepted':
      return chalk.green(status);
    case 'deprecated':
      return chalk.red(status);
    case 'superseded':
      return chalk.gray(status);
    default:
      return status;
  }
}

export function registerDecisionCommands(program: Command): void {
  const decision = program
    .command('decision')
    .description('Manage decision log');

  decision
    .command('list')
    .description('List decisions')
    .option('-s, --status <status>', 'Filter by status')
    .option('--per-page <n>', 'Items per page', '15')
    .option('--page <n>', 'Page number', '1')
    .action(async (opts) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching decisions...').start();
        const api = createApiClient();

        const params: Record<string, unknown> = {
          per_page: opts.perPage,
          page: opts.page,
        };
        if (opts.status) params.status = opts.status;

        const { data } = await api.get<PaginatedResponse<Decision>>(
          `/projects/${projectId}/decisions`,
          params
        );
        spinner.stop();

        if (data.data.length === 0) {
          info('No decisions found.');
          return;
        }

        const headers = ['ID', 'Title', 'Status', 'Tags', 'Date'];
        const rows = data.data.map((d: Decision) => [
          String(d.id),
          d.title.length > 35 ? d.title.substring(0, 32) + '...' : d.title,
          statusColor(d.status),
          d.tags ? d.tags.join(', ') : '-',
          new Date(d.createdAt).toLocaleDateString(),
        ]);
        printTable(headers, rows);
        printPagination(data.meta);
      } catch (err) {
        handleError(err);
      }
    });

  decision
    .command('add')
    .description('Add a new decision')
    .option('--quick', 'Quick mode with inline options')
    .option('--title <title>', 'Decision title')
    .option('--decision <decision>', 'Decision text')
    .option('--context <ctx>', 'Context')
    .option('--status <status>', 'Status (proposed/accepted/deprecated/superseded)')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(async (opts) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        let payload: Record<string, unknown>;

        if (opts.title && opts.decision) {
          // Non-interactive mode: use flag values with defaults
          payload = {
            title: opts.title,
            decision: opts.decision,
            status: opts.status || 'accepted',
          };
          if (opts.context) payload.context = opts.context;
          if (opts.tags?.trim()) {
            payload.tags = opts.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          }
        } else {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'title',
              message: 'Decision title:',
              default: opts.title || undefined,
              validate: (v: string) => (v.length > 0 ? true : 'Title is required'),
            },
            {
              type: 'editor',
              name: 'context',
              message: 'Context (what is the issue/problem?):',
            },
            {
              type: 'editor',
              name: 'decision',
              message: 'Decision (what was decided?):',
              default: opts.decision || undefined,
              validate: (v: string) => (v.trim().length > 0 ? true : 'Decision is required'),
            },
            {
              type: 'confirm',
              name: 'hasAlternatives',
              message: 'Add alternatives considered?',
              default: false,
            },
          ]);

          const alternatives: Array<{ option: string; reason: string }> = [];
          if (answers.hasAlternatives) {
            let addMore = true;
            while (addMore) {
              const alt = await inquirer.prompt([
                {
                  type: 'input',
                  name: 'option',
                  message: 'Alternative option:',
                  validate: (v: string) => (v.length > 0 ? true : 'Option is required'),
                },
                {
                  type: 'input',
                  name: 'reason',
                  message: 'Why was it rejected?',
                },
                {
                  type: 'confirm',
                  name: 'addMore',
                  message: 'Add another alternative?',
                  default: false,
                },
              ]);
              alternatives.push({ option: alt.option, reason: alt.reason });
              addMore = alt.addMore;
            }
          }

          const moreAnswers = await inquirer.prompt([
            {
              type: 'editor',
              name: 'consequences',
              message: 'Consequences (optional):',
            },
            {
              type: 'list',
              name: 'status',
              message: 'Status:',
              choices: DECISION_STATUSES,
              default: 'accepted',
            },
            {
              type: 'input',
              name: 'tags',
              message: 'Tags (comma-separated, optional):',
            },
          ]);

          payload = {
            title: answers.title,
            context: answers.context?.trim() || undefined,
            decision: answers.decision.trim(),
            status: moreAnswers.status,
          };
          if (alternatives.length > 0) payload.alternatives = alternatives;
          if (moreAnswers.consequences?.trim()) payload.consequences = moreAnswers.consequences.trim();
          if (moreAnswers.tags?.trim()) {
            payload.tags = moreAnswers.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          }
        }

        const spinner = ora('Creating decision...').start();
        const api = createApiClient();

        const { data } = await api.post<ApiResponse<Decision>>(
          `/projects/${projectId}/decisions`,
          payload
        );
        spinner.stop();

        success(`Decision "${data.data.title}" created (#${data.data.id})`);
      } catch (err) {
        handleError(err);
      }
    });

  decision
    .command('show <id>')
    .description('Show decision details')
    .action(async (id: string) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching decision...').start();
        const api = createApiClient();

        const { data } = await api.get<{ data: Decision }>(
          `/projects/${projectId}/decisions/${id}`
        );
        spinner.stop();

        const d = data.data;
        console.log();
        console.log(chalk.bold(`Decision #${d.id}: ${d.title}`));
        console.log(chalk.gray('-'.repeat(50)));
        console.log(`  Status:      ${statusColor(d.status)}`);
        if (d.tags && d.tags.length > 0) {
          console.log(`  Tags:        ${d.tags.join(', ')}`);
        }
        if (d.supersededBy) {
          console.log(`  Superseded:  by #${d.supersededBy}`);
        }
        console.log(`  Created:     ${new Date(d.createdAt).toLocaleString()}`);
        console.log(`  Updated:     ${new Date(d.updatedAt).toLocaleString()}`);

        if (d.context) {
          console.log();
          console.log(chalk.bold('Context'));
          console.log(chalk.gray('-'.repeat(50)));
          console.log(d.context);
        }

        console.log();
        console.log(chalk.bold('Decision'));
        console.log(chalk.gray('-'.repeat(50)));
        console.log(d.decision);

        if (d.alternatives && d.alternatives.length > 0) {
          console.log();
          console.log(chalk.bold('Alternatives Considered'));
          console.log(chalk.gray('-'.repeat(50)));
          d.alternatives.forEach((alt, i) => {
            console.log(`  ${i + 1}. ${chalk.cyan(alt.option)}`);
            if (alt.reason) {
              console.log(`     ${chalk.gray(alt.reason)}`);
            }
          });
        }

        if (d.consequences) {
          console.log();
          console.log(chalk.bold('Consequences'));
          console.log(chalk.gray('-'.repeat(50)));
          console.log(d.consequences);
        }
        console.log();
      } catch (err) {
        handleError(err);
      }
    });

  decision
    .command('search <query>')
    .description('Search decisions')
    .action(async (query: string) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Searching decisions...').start();
        const api = createApiClient();

        const { data } = await api.get<{ data: Decision[] }>(
          `/projects/${projectId}/decisions/search`,
          { q: query }
        );
        spinner.stop();

        if (data.data.length === 0) {
          info('No decisions found matching your query.');
          return;
        }

        const headers = ['ID', 'Title', 'Status', 'Tags', 'Date'];
        const rows = data.data.map((d: Decision) => [
          String(d.id),
          d.title.length > 35 ? d.title.substring(0, 32) + '...' : d.title,
          statusColor(d.status),
          d.tags ? d.tags.join(', ') : '-',
          new Date(d.createdAt).toLocaleDateString(),
        ]);
        printTable(headers, rows);
      } catch (err) {
        handleError(err);
      }
    });

  decision
    .command('supersede <id>')
    .description('Mark a decision as superseded')
    .option('--new-decision-id <newId>', 'New decision ID that supersedes this one')
    .action(async (id: string, opts: { newDecisionId?: string }) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        let newDecisionId: string;

        if (opts.newDecisionId) {
          newDecisionId = opts.newDecisionId;
        } else {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'newDecisionId',
              message: 'New decision ID that supersedes this one:',
              validate: (v: string) => {
                const num = Number(v);
                return !isNaN(num) && num > 0 ? true : 'Please enter a valid decision ID';
              },
            },
          ]);
          newDecisionId = answers.newDecisionId;
        }

        const spinner = ora('Superseding decision...').start();
        const api = createApiClient();

        await api.post(`/projects/${projectId}/decisions/${id}/supersede`, {
          new_decision_id: Number(newDecisionId),
        });
        spinner.stop();

        success(`Decision #${id} marked as superseded by #${newDecisionId}.`);
      } catch (err) {
        handleError(err);
      }
    });
}
