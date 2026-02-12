import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
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
} from '../lib/output.js';
import type {
  ApiResponse,
  TechStack,
  DependencyNote,
  FrameworkInfo,
  StackSection,
  DependencyItem,
} from '../types/index.js';

export function registerStackCommands(program: Command): void {
  const stack = program
    .command('stack')
    .description('Manage tech stack information');

  stack
    .command('scan')
    .description('Scan local package files and send to API for parsing')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const files: Record<string, string> = {};

        const composerPath = path.join(process.cwd(), 'composer.json');
        if (fs.existsSync(composerPath)) {
          files['composer.json'] = fs.readFileSync(composerPath, 'utf-8');
          info('Found composer.json');
        }

        const packagePath = path.join(process.cwd(), 'package.json');
        if (fs.existsSync(packagePath)) {
          files['package.json'] = fs.readFileSync(packagePath, 'utf-8');
          info('Found package.json');
        }

        if (Object.keys(files).length === 0) {
          warn('No composer.json or package.json found in current directory.');
          return;
        }

        const spinner = ora('Parsing tech stack...').start();
        const api = createApiClient();

        const { data } = await api.post<ApiResponse<TechStack>>(
          `/projects/${projectId}/tech-stack/parse`,
          { files }
        );
        spinner.stop();

        success('Tech stack parsed successfully!');

        const stackData = data.data.stackData;
        if (stackData) {
          printStackInfo(stackData.sections, stackData.frameworks);
        }
      } catch (err) {
        handleError(err);
      }
    });

  stack
    .command('show')
    .description('Show current tech stack')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching tech stack...').start();
        const api = createApiClient();

        const { data } = await api.get<ApiResponse<TechStack | null>>(
          `/projects/${projectId}/tech-stack`
        );
        spinner.stop();

        if (!data.data) {
          info('No tech stack data available. Run: memo8 stack scan');
          return;
        }

        const stackData = data.data.stackData;
        if (!stackData) {
          info('No tech stack data available. Run: memo8 stack scan');
          return;
        }

        printStackInfo(stackData.sections, stackData.frameworks);

        if (data.data.dependencyNotes && data.data.dependencyNotes.length > 0) {
          console.log();
          console.log(chalk.bold('Notes'));
          console.log(chalk.gray('-'.repeat(50)));
          const noteHeaders = ['Package', 'Note', 'Added'];
          const noteRows = data.data.dependencyNotes.map((n: DependencyNote) => [
            n.packageName,
            n.note.length > 50 ? n.note.substring(0, 47) + '...' : n.note,
            new Date(n.createdAt).toLocaleDateString(),
          ]);
          printTable(noteHeaders, noteRows);
        }
      } catch (err) {
        handleError(err);
      }
    });

  stack
    .command('note <packageName>')
    .description('Add a note for a dependency')
    .option('--note <note>', 'Note text')
    .action(async (packageName: string, opts: { note?: string }) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        let note: string;

        if (opts.note) {
          note = opts.note;
        } else {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'note',
              message: `Note for "${packageName}":`,
              validate: (v: string) => (v.length > 0 ? true : 'Note is required'),
            },
          ]);
          note = answers.note;
        }

        const spinner = ora('Adding note...').start();
        const api = createApiClient();

        await api.post<ApiResponse<DependencyNote>>(
          `/projects/${projectId}/tech-stack/notes`,
          { package_name: packageName, note }
        );
        spinner.stop();

        success(`Note added for "${packageName}".`);
      } catch (err) {
        handleError(err);
      }
    });

  stack
    .command('context')
    .description('Get tech stack context summary for AI')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Generating context...').start();
        const api = createApiClient();

        const { data } = await api.get<ApiResponse<{ summary: string | null }>>(
          `/projects/${projectId}/tech-stack/summary`
        );
        spinner.stop();

        if (!data.data.summary) {
          info('No tech stack data available. Run: memo8 stack scan');
          return;
        }
        console.log(data.data.summary);
      } catch (err) {
        handleError(err);
      }
    });
}

function printStackInfo(sections: StackSection[], frameworks: FrameworkInfo[]): void {
  if (frameworks.length > 0) {
    console.log();
    console.log(chalk.bold('Frameworks'));
    console.log(chalk.gray('-'.repeat(50)));
    const fwHeaders = ['Name', 'Version', 'Type'];
    const fwRows = frameworks.map((f: FrameworkInfo) => [
      f.name,
      f.version,
      f.type,
    ]);
    printTable(fwHeaders, fwRows);
  }

  sections.forEach((section: StackSection) => {
    console.log();
    console.log(
      chalk.bold(`${section.language}`) +
        (section.languageVersion ? chalk.gray(` v${section.languageVersion}`) : '')
    );
    console.log(chalk.gray('-'.repeat(50)));

    if (section.dependencies.length > 0) {
      console.log(chalk.cyan('  Dependencies:'));
      const depHeaders = ['Name', 'Version', 'Type'];
      const depRows = section.dependencies.map((d: DependencyItem) => [
        d.name,
        d.version,
        d.type,
      ]);
      printTable(depHeaders, depRows);
    }

    if (section.devDependencies.length > 0) {
      console.log(chalk.cyan('  Dev Dependencies:'));
      const devHeaders = ['Name', 'Version', 'Type'];
      const devRows = section.devDependencies.map((d: DependencyItem) => [
        d.name,
        d.version,
        d.type,
      ]);
      printTable(devHeaders, devRows);
    }
  });
}
