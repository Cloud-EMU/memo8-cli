import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { createApiClient } from '../lib/api.js';
import { loadGlobalConfig, setTeamId } from '../lib/config.js';
import { success, error, info, handleError } from '../lib/output.js';
import type { Team, TeamMember, ApiResponse } from '../types/index.js';

export function registerTeamCommands(program: Command): void {
  const team = program
    .command('team')
    .description('Team management');

  // team list
  team
    .command('list')
    .description('List your teams')
    .action(async () => {
      try {
        const spinner = ora('Fetching teams...').start();
        const api = createApiClient();
        const config = loadGlobalConfig();
        const currentTeamId = config.teamId;

        const { data } = await api.get<{ data: Array<Team & { membersCount?: number }> }>('/teams');
        spinner.stop();

        if (!data.data || data.data.length === 0) {
          info('No teams found.');
          return;
        }

        console.log();
        for (const t of data.data) {
          const isCurrent = t.id === currentTeamId;
          const marker = isCurrent ? chalk.green('→ ') : '  ';
          const personal = t.isPersonal ? chalk.dim(' (Personal)') : '';
          const role = chalk.dim(` [${t.role}]`);
          console.log(`${marker}${chalk.bold(t.name)}${personal}${role} ${chalk.dim(`#${t.id}`)}`);
        }
        console.log();
      } catch (err) {
        handleError(err);
      }
    });

  // team switch
  team
    .command('switch')
    .description('Switch to a different team')
    .argument('[teamId]', 'Team ID to switch to')
    .action(async (teamId?: string) => {
      try {
        const api = createApiClient();

        if (!teamId) {
          // Interactive: fetch teams and let user choose
          const spinner = ora('Fetching teams...').start();
          const { data } = await api.get<{ data: Team[] }>('/teams');
          spinner.stop();

          if (!data.data || data.data.length === 0) {
            error('No teams found.');
            return;
          }

          const { selectedTeamId } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedTeamId',
              message: 'Select a team:',
              choices: data.data.map((t) => ({
                name: `${t.name}${t.isPersonal ? ' (Personal)' : ''} [${t.role}]`,
                value: t.id,
              })),
            },
          ]);
          teamId = String(selectedTeamId);
        }

        const spinner = ora('Switching team...').start();
        await api.patch('/user/current-team', { team_id: Number(teamId) });
        setTeamId(Number(teamId));
        spinner.stop();
        success(`Switched to team #${teamId}`);
      } catch (err) {
        handleError(err);
      }
    });

  // team create
  team
    .command('create')
    .description('Create a new team')
    .option('--name <name>', 'Team name')
    .action(async (opts: { name?: string }) => {
      try {
        let name: string;
        if (opts.name) {
          name = opts.name;
        } else {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Team name:',
              validate: (v: string) => (v.length > 0 ? true : 'Team name is required'),
            },
          ]);
          name = answers.name;
        }

        const spinner = ora('Creating team...').start();
        const api = createApiClient();
        const { data } = await api.post<ApiResponse<Team>>('/teams', { name });
        spinner.stop();
        success(`Team "${data.data.name}" created (ID: ${data.data.id})`);
      } catch (err) {
        handleError(err);
      }
    });

  // team members
  team
    .command('members')
    .description('List members of the current team')
    .action(async () => {
      try {
        const config = loadGlobalConfig();
        const teamId = config.teamId;
        if (!teamId) {
          error('No team selected. Run: memo8 team switch');
          return;
        }

        const spinner = ora('Fetching members...').start();
        const api = createApiClient();
        const { data } = await api.get<{ data: TeamMember[] }>(`/teams/${teamId}/members`);
        spinner.stop();

        if (!data.data || data.data.length === 0) {
          info('No members found.');
          return;
        }

        console.log();
        for (const m of data.data) {
          const roleBadge = m.role === 'owner' ? chalk.yellow(`[${m.role}]`) : chalk.dim(`[${m.role}]`);
          console.log(`  ${chalk.bold(m.name)} ${chalk.dim(`<${m.email}>`)} ${roleBadge}`);
        }
        console.log();
      } catch (err) {
        handleError(err);
      }
    });

  // team invite
  team
    .command('invite')
    .description('Invite a member to the current team')
    .argument('<email>', 'Email address of the user to invite')
    .option('--role <role>', 'Role: admin or member', 'member')
    .action(async (email: string, opts: { role: string }) => {
      try {
        const config = loadGlobalConfig();
        const teamId = config.teamId;
        if (!teamId) {
          error('No team selected. Run: memo8 team switch');
          return;
        }

        const spinner = ora(`Inviting ${email}...`).start();
        const api = createApiClient();
        await api.post(`/teams/${teamId}/invite`, { email, role: opts.role });
        spinner.stop();
        success(`Invited ${email} as ${opts.role}`);
      } catch (err) {
        handleError(err);
      }
    });
}
