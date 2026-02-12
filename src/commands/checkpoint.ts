import { Command } from 'commander';
import { execSync } from 'child_process';
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
  Checkpoint,
} from '../types/index.js';

function getGitInfo(): { commitHash: string | null; branch: string | null } {
  let commitHash: string | null = null;
  let branch: string | null = null;

  try {
    commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    // Not a git repo or git not available
  }

  try {
    branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    // Not a git repo or git not available
  }

  return { commitHash, branch };
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':
      return chalk.green(status);
    case 'rolled_back':
      return chalk.yellow(status);
    case 'archived':
      return chalk.gray(status);
    default:
      return status;
  }
}

export function registerCheckpointCommands(program: Command): void {
  const checkpoint = program
    .command('checkpoint')
    .description('Manage development checkpoints');

  checkpoint
    .command('create')
    .description('Create a new checkpoint')
    .option('-n, --name <name>', 'Checkpoint name')
    .option('-t, --task <id>', 'Associated task ID')
    .option('--description <desc>', 'Checkpoint description')
    .action(async (opts) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        let name = opts.name;
        if (!name) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Checkpoint name:',
              validate: (v: string) => (v.length > 0 ? true : 'Name is required'),
            },
          ]);
          name = answers.name;
        }

        const { commitHash, branch } = getGitInfo();

        if (commitHash) {
          info(`Git commit: ${commitHash.substring(0, 8)}`);
        }
        if (branch) {
          info(`Git branch: ${branch}`);
        }

        const spinner = ora('Creating checkpoint...').start();
        const api = createApiClient();

        const payload: Record<string, unknown> = {
          name,
          git_commit_hash: commitHash,
          git_branch: branch,
        };
        if (opts.task) payload.task_id = Number(opts.task);
        if (opts.description) payload.description = opts.description;

        const { data } = await api.post<ApiResponse<Checkpoint>>(
          `/projects/${projectId}/checkpoints`,
          payload
        );
        spinner.stop();

        success(`Checkpoint "${data.data.name}" created (#${data.data.id})`);
      } catch (err) {
        handleError(err);
      }
    });

  checkpoint
    .command('list')
    .description('List checkpoints')
    .option('--per-page <n>', 'Items per page', '15')
    .option('--page <n>', 'Page number', '1')
    .action(async (opts) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching checkpoints...').start();
        const api = createApiClient();

        const params: Record<string, unknown> = {
          per_page: opts.perPage,
          page: opts.page,
        };

        const { data } = await api.get<PaginatedResponse<Checkpoint>>(
          `/projects/${projectId}/checkpoints`,
          params
        );
        spinner.stop();

        if (data.data.length === 0) {
          info('No checkpoints found.');
          return;
        }

        const headers = ['ID', 'Name', 'Branch', 'Commit', 'Status', 'Date'];
        const rows = data.data.map((cp: Checkpoint) => [
          String(cp.id),
          cp.name.length > 25 ? cp.name.substring(0, 22) + '...' : cp.name,
          cp.gitBranch || '-',
          cp.gitCommitHash ? cp.gitCommitHash.substring(0, 8) : '-',
          statusColor(cp.status),
          new Date(cp.createdAt).toLocaleDateString(),
        ]);
        printTable(headers, rows);
        printPagination(data.meta);
      } catch (err) {
        handleError(err);
      }
    });

  checkpoint
    .command('show <id>')
    .description('Show checkpoint details')
    .action(async (id: string) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching checkpoint...').start();
        const api = createApiClient();

        const { data } = await api.get<{ data: Checkpoint }>(
          `/projects/${projectId}/checkpoints/${id}`
        );
        spinner.stop();

        const cp = data.data;
        console.log();
        console.log(chalk.bold(`Checkpoint #${cp.id}: ${cp.name}`));
        console.log(chalk.gray('-'.repeat(50)));
        console.log(`  Status:     ${statusColor(cp.status)}`);
        if (cp.description) {
          console.log(`  Description: ${cp.description}`);
        }
        if (cp.gitBranch) {
          console.log(`  Branch:     ${cp.gitBranch}`);
        }
        if (cp.gitCommitHash) {
          console.log(`  Commit:     ${cp.gitCommitHash}`);
        }
        if (cp.taskId) {
          console.log(`  Task:       #${cp.taskId}`);
        }
        console.log(`  Created:    ${new Date(cp.createdAt).toLocaleString()}`);
        console.log(`  Updated:    ${new Date(cp.updatedAt).toLocaleString()}`);

        if (cp.snapshotData) {
          console.log();
          console.log(chalk.bold('Snapshot Data'));
          console.log(chalk.gray('-'.repeat(50)));
          console.log(JSON.stringify(cp.snapshotData, null, 2));
        }
        console.log();
      } catch (err) {
        handleError(err);
      }
    });

  checkpoint
    .command('diff <id>')
    .description('Show diff information for a checkpoint')
    .action(async (id: string) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching diff info...').start();
        const api = createApiClient();

        const { data } = await api.get<{ data: Checkpoint }>(
          `/projects/${projectId}/checkpoints/${id}`
        );
        spinner.stop();

        const cp = data.data;
        if (!cp.gitCommitHash) {
          warn('This checkpoint has no git commit hash. Cannot show diff.');
          return;
        }

        console.log();
        console.log(chalk.bold('Diff Instructions'));
        console.log(chalk.gray('-'.repeat(50)));
        console.log();
        console.log('  To see changes since this checkpoint, run:');
        console.log();
        console.log(chalk.cyan(`    git diff ${cp.gitCommitHash}..HEAD`));
        console.log();
        console.log('  To see a summary of changed files:');
        console.log();
        console.log(chalk.cyan(`    git diff --stat ${cp.gitCommitHash}..HEAD`));
        console.log();
        console.log('  To see the log since this checkpoint:');
        console.log();
        console.log(chalk.cyan(`    git log --oneline ${cp.gitCommitHash}..HEAD`));
        console.log();
      } catch (err) {
        handleError(err);
      }
    });

  checkpoint
    .command('rollback <id>')
    .description('Get rollback instructions for a checkpoint')
    .option('-y, --yes', 'Auto-execute rollback without confirmation')
    .action(async (id: string, opts: { yes?: boolean }) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching rollback info...').start();
        const api = createApiClient();

        const { data } = await api.post<ApiResponse<{ instructions: string[]; checkpoint: Checkpoint }>>(
          `/projects/${projectId}/checkpoints/${id}/rollback-instructions`
        );
        spinner.stop();

        const result = data.data;
        const cp = result.checkpoint;

        console.log();
        console.log(chalk.bold(`Rollback to Checkpoint #${cp.id}: ${cp.name}`));
        console.log(chalk.gray('-'.repeat(50)));

        if (cp.gitCommitHash) {
          console.log(`  Target commit: ${cp.gitCommitHash}`);
        }
        if (cp.gitBranch) {
          console.log(`  Target branch: ${cp.gitBranch}`);
        }
        console.log();

        if (result.instructions && result.instructions.length > 0) {
          console.log(chalk.bold('Steps:'));
          result.instructions.forEach((step, i) => {
            console.log(`  ${i + 1}. ${step}`);
          });
        } else if (cp.gitCommitHash) {
          console.log(chalk.bold('Suggested Steps:'));
          console.log(`  1. ${chalk.cyan(`git stash`)} (save current changes)`);
          console.log(`  2. ${chalk.cyan(`git checkout ${cp.gitCommitHash}`)} (go to checkpoint)`);
          console.log(`  3. Review the state of the code`);
          console.log(`  4. ${chalk.cyan(`git checkout -`)} (go back to your branch)`);
        }
        console.log();

        if (cp.gitCommitHash) {
          let execute = opts.yes || false;

          if (!execute) {
            const answers = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'execute',
                message: chalk.yellow('Do you want to checkout to this commit? (Your current changes will be stashed)'),
                default: false,
              },
            ]);
            execute = answers.execute;
          }

          if (execute) {
            try {
              info('Stashing current changes...');
              execSync('git stash', { encoding: 'utf-8', stdio: 'pipe' });

              info(`Checking out ${cp.gitCommitHash.substring(0, 8)}...`);
              execSync(`git checkout ${cp.gitCommitHash}`, { encoding: 'utf-8', stdio: 'pipe' });

              success(`Rolled back to checkpoint commit ${cp.gitCommitHash.substring(0, 8)}.`);
              info('You are now in detached HEAD state. Use "git checkout -" to go back.');
            } catch (gitErr) {
              warn('Git operation failed. Please run the commands manually.');
              if (gitErr instanceof Error) {
                console.error(chalk.red(`  ${gitErr.message}`));
              }
            }
          }
        }
      } catch (err) {
        handleError(err);
      }
    });
}
