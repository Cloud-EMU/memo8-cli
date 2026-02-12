import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { createApiClient } from '../lib/api.js';
import { saveLocalConfig } from '../lib/config.js';
import { success, info, handleError } from '../lib/output.js';
import type { PaginatedResponse, Project } from '../types/index.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize memo8 in current directory (creates .memo8.json)')
    .option('-p, --project <id>', 'Project ID (skip interactive selection)')
    .action(async (opts: { project?: string }) => {
      try {
        const api = createApiClient();

        if (opts.project) {
          // Non-interactive mode: use provided project ID
          const spinner = ora('Fetching project...').start();
          const { data } = await api.get<{ data: Project }>(`/projects/${opts.project}`);
          spinner.stop();

          saveLocalConfig({
            projectId: data.data.id,
            projectName: data.data.name,
          });

          success(`Initialized memo8 with project "${data.data.name}" (#${data.data.id})`);
          info('Created .memo8.json in current directory.');
          return;
        }

        // Interactive mode
        const spinner = ora('Fetching projects...').start();
        const { data } = await api.get<PaginatedResponse<Project>>('/projects', {
          per_page: 100,
        });
        spinner.stop();

        if (data.data.length === 0) {
          info('No projects found. Create one first with: memo8 project create');
          return;
        }

        const choices = data.data.map((p) => ({
          name: `${p.name} (#${p.id}) - ${p.status}`,
          value: { id: p.id, name: p.name },
        }));

        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'project',
            message: 'Select a project for this directory:',
            choices,
          },
        ]);

        saveLocalConfig({
          projectId: answer.project.id,
          projectName: answer.project.name,
        });

        success(`Initialized memo8 with project "${answer.project.name}" (#${answer.project.id})`);
        info('Created .memo8.json in current directory.');
      } catch (err) {
        handleError(err);
      }
    });
}
