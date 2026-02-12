import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { createApiClient } from '../lib/api.js';
import { setAuth, clearAuth, loadGlobalConfig } from '../lib/config.js';
import { success, error, info, handleError } from '../lib/output.js';
import type { ApiResponse, AuthData, User } from '../types/index.js';

export function registerAuthCommands(program: Command): void {
  program
    .command('login')
    .description('Login to memo8')
    .option('--email <email>', 'Email address')
    .option('--password <password>', 'Password')
    .action(async (opts: { email?: string; password?: string }) => {
      try {
        let email: string;
        let password: string;

        if (opts.email && opts.password) {
          email = opts.email;
          password = opts.password;
        } else {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'email',
              message: 'Email:',
              default: opts.email || undefined,
              validate: (v: string) => (v.includes('@') ? true : 'Enter a valid email'),
            },
            {
              type: 'password',
              name: 'password',
              message: 'Password:',
              mask: '*',
              validate: (v: string) => (v.length > 0 ? true : 'Password is required'),
            },
          ]);
          email = answers.email;
          password = answers.password;
        }

        const spinner = ora('Logging in...').start();
        const api = createApiClient();

        const { data } = await api.post<ApiResponse<AuthData>>('/login', {
          email,
          password,
          device_name: 'memo8-cli',
        });

        setAuth(data.data.token, data.data.user);
        spinner.stop();
        success(`Welcome back, ${data.data.user.name}!`);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('register')
    .description('Create a new memo8 account')
    .option('--name <name>', 'Full name')
    .option('--email <email>', 'Email address')
    .option('--password <password>', 'Password')
    .action(async (opts: { name?: string; email?: string; password?: string }) => {
      try {
        let name: string;
        let email: string;
        let password: string;
        let passwordConfirmation: string;

        if (opts.name && opts.email && opts.password) {
          name = opts.name;
          email = opts.email;
          password = opts.password;
          passwordConfirmation = opts.password;
        } else {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Name:',
              default: opts.name || undefined,
              validate: (v: string) => (v.length > 0 ? true : 'Name is required'),
            },
            {
              type: 'input',
              name: 'email',
              message: 'Email:',
              default: opts.email || undefined,
              validate: (v: string) => (v.includes('@') ? true : 'Enter a valid email'),
            },
            {
              type: 'password',
              name: 'password',
              message: 'Password:',
              mask: '*',
              validate: (v: string) => (v.length >= 8 ? true : 'Password must be at least 8 characters'),
            },
            {
              type: 'password',
              name: 'password_confirmation',
              message: 'Confirm password:',
              mask: '*',
            },
          ]);
          name = answers.name;
          email = answers.email;
          password = answers.password;
          passwordConfirmation = answers.password_confirmation;
        }

        const spinner = ora('Creating account...').start();
        const api = createApiClient();

        const { data } = await api.post<ApiResponse<AuthData>>('/register', {
          name,
          email,
          password,
          password_confirmation: passwordConfirmation,
          device_name: 'memo8-cli',
        });

        setAuth(data.data.token, data.data.user);
        spinner.stop();
        success(`Account created! Welcome, ${data.data.user.name}!`);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('logout')
    .description('Logout from memo8')
    .action(async () => {
      try {
        const spinner = ora('Logging out...').start();
        const api = createApiClient();

        await api.post('/logout');
        clearAuth();
        spinner.stop();
        success('Logged out successfully.');
      } catch (err) {
        // Clear local auth even if API call fails
        clearAuth();
        if (err instanceof Error && err.message.includes('Session expired')) {
          success('Logged out successfully.');
        } else {
          handleError(err);
        }
      }
    });

  program
    .command('status')
    .description('Show current authentication status')
    .action(async () => {
      try {
        const config = loadGlobalConfig();
        if (!config.token) {
          info('Not authenticated. Run: memo8 login');
          return;
        }

        const spinner = ora('Checking status...').start();
        const api = createApiClient();

        const { data } = await api.get<User>('/user');
        spinner.stop();

        console.log();
        info('Authenticated');
        console.log(`  Name:  ${data.name}`);
        console.log(`  Email: ${data.email}`);
        console.log(`  ID:    ${data.id}`);
        console.log();
      } catch (err) {
        error('Not authenticated or session expired. Run: memo8 login');
      }
    });
}
