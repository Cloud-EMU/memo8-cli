import { Command } from 'commander';
import fs from 'fs';
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
  Convention,
} from '../types/index.js';

const CONVENTION_CATEGORIES = [
  'naming',
  'formatting',
  'architecture',
  'testing',
  'documentation',
  'error_handling',
  'security',
  'performance',
  'database',
  'api',
  'other',
];

export function registerConventionCommands(program: Command): void {
  const convention = program
    .command('convention')
    .description('Manage project conventions');

  convention
    .command('list')
    .description('List conventions')
    .option('-c, --category <category>', 'Filter by category')
    .option('--per-page <n>', 'Items per page', '15')
    .option('--page <n>', 'Page number', '1')
    .action(async (opts) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching conventions...').start();
        const api = createApiClient();

        const params: Record<string, unknown> = {
          per_page: opts.perPage,
          page: opts.page,
        };
        if (opts.category) params.category = opts.category;

        const { data } = await api.get<PaginatedResponse<Convention>>(
          `/projects/${projectId}/conventions`,
          params
        );
        spinner.stop();

        if (data.data.length === 0) {
          info('No conventions found.');
          return;
        }

        const headers = ['ID', 'Title', 'Category', 'Source', 'Active'];
        const rows = data.data.map((c: Convention) => [
          String(c.id),
          c.title.length > 35 ? c.title.substring(0, 32) + '...' : c.title,
          c.category,
          c.source,
          c.isActive ? chalk.green('Yes') : chalk.red('No'),
        ]);
        printTable(headers, rows);
        printPagination(data.meta);
      } catch (err) {
        handleError(err);
      }
    });

  convention
    .command('add')
    .description('Add a new convention')
    .option('--title <title>', 'Convention title')
    .option('--category <cat>', 'Category')
    .option('--description <desc>', 'Description')
    .option('--code-example <code>', 'Code example')
    .option('--anti-pattern <code>', 'Anti-pattern example')
    .action(async (opts) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        let title: string;
        let description: string;
        let category: string;
        let codeExample: string | undefined;
        let antiPatternExample: string | undefined;

        if (opts.title && opts.description) {
          // Non-interactive mode: use flag values with defaults
          title = opts.title;
          description = opts.description;
          category = opts.category || 'other';
          codeExample = opts.codeExample || undefined;
          antiPatternExample = opts.antiPattern || undefined;
        } else {
          // Interactive mode: prompt user
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'title',
              message: 'Convention title:',
              validate: (v: string) => (v.length > 0 ? true : 'Title is required'),
            },
            {
              type: 'input',
              name: 'description',
              message: 'Description:',
              validate: (v: string) => (v.length > 0 ? true : 'Description is required'),
            },
            {
              type: 'list',
              name: 'category',
              message: 'Category:',
              choices: CONVENTION_CATEGORIES,
            },
            {
              type: 'editor',
              name: 'code_example',
              message: 'Code example (good pattern) - opens editor:',
            },
            {
              type: 'editor',
              name: 'anti_pattern_example',
              message: 'Anti-pattern example (bad pattern) - opens editor:',
            },
          ]);
          title = answers.title;
          description = answers.description;
          category = answers.category;
          codeExample = answers.code_example?.trim() || undefined;
          antiPatternExample = answers.anti_pattern_example?.trim() || undefined;
        }

        const spinner = ora('Creating convention...').start();
        const api = createApiClient();

        const payload: Record<string, unknown> = {
          title,
          description,
          category,
          source: 'manual',
        };
        if (codeExample) payload.code_example = codeExample;
        if (antiPatternExample) payload.anti_pattern_example = antiPatternExample;

        const { data } = await api.post<ApiResponse<Convention>>(
          `/projects/${projectId}/conventions`,
          payload
        );
        spinner.stop();

        success(`Convention "${data.data.title}" created (#${data.data.id})`);
      } catch (err) {
        handleError(err);
      }
    });

  convention
    .command('show <id>')
    .description('Show convention details')
    .action(async (id: string) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching convention...').start();
        const api = createApiClient();

        const { data } = await api.get<{ data: Convention }>(
          `/projects/${projectId}/conventions/${id}`
        );
        spinner.stop();

        const c = data.data;
        console.log();
        console.log(chalk.bold(`Convention #${c.id}: ${c.title}`));
        console.log(chalk.gray('-'.repeat(50)));
        console.log(`  Category:    ${c.category}`);
        console.log(`  Source:      ${c.source}`);
        console.log(`  Confidence:  ${c.confidenceScore}%`);
        console.log(`  Active:      ${c.isActive ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`  Created:     ${new Date(c.createdAt).toLocaleString()}`);
        console.log();
        console.log(chalk.bold('Description'));
        console.log(c.description);

        if (c.codeExample) {
          console.log();
          console.log(chalk.bold.green('Good Pattern'));
          console.log(chalk.gray('-'.repeat(50)));
          console.log(c.codeExample);
        }

        if (c.antiPatternExample) {
          console.log();
          console.log(chalk.bold.red('Anti-Pattern'));
          console.log(chalk.gray('-'.repeat(50)));
          console.log(c.antiPatternExample);
        }
        console.log();
      } catch (err) {
        handleError(err);
      }
    });

  convention
    .command('detect')
    .description('Auto-detect conventions from codebase')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Starting convention detection...').start();
        const api = createApiClient();

        await api.post(`/projects/${projectId}/conventions/detect`);
        spinner.stop();

        success('Convention detection started.');
        info('This runs in the background. Check results with: memo8 convention list');
      } catch (err) {
        handleError(err);
      }
    });

  convention
    .command('check <file>')
    .description('Check which conventions apply to a file')
    .action(async (file: string) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const filePath = fs.existsSync(file) ? file : undefined;
        if (!filePath) {
          warn(`File not found: ${file}`);
          return;
        }

        const content = fs.readFileSync(filePath, 'utf-8');

        const spinner = ora('Checking conventions...').start();
        const api = createApiClient();

        const { data } = await api.post<{ data: Convention[] }>(
          `/projects/${projectId}/conventions/check`,
          { file_path: file, content }
        );
        spinner.stop();

        if (data.data.length === 0) {
          info('No applicable conventions found for this file.');
          return;
        }

        console.log();
        console.log(chalk.bold(`Conventions applicable to ${file}:`));
        console.log();

        const headers = ['ID', 'Title', 'Category', 'Confidence'];
        const rows = data.data.map((c: Convention) => [
          String(c.id),
          c.title.length > 35 ? c.title.substring(0, 32) + '...' : c.title,
          c.category,
          `${c.confidenceScore}%`,
        ]);
        printTable(headers, rows);
      } catch (err) {
        handleError(err);
      }
    });
}
