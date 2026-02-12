import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { createApiClient } from '../lib/api.js';
import { getProjectId } from '../lib/config.js';
import { success, warn, info, handleError, printPagination, } from '../lib/output.js';
function printPlanSummary(plan) {
    console.log();
    console.log(chalk.bold(`Plan #${plan.id}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  Status:    ${planStatusColor(plan.status)}`);
    console.log(`  Prompt:    ${plan.prompt.length > 60 ? plan.prompt.substring(0, 57) + '...' : plan.prompt}`);
    if (plan.approvedAt) {
        console.log(`  Approved:  ${new Date(plan.approvedAt).toLocaleString()}`);
    }
    console.log(`  Created:   ${new Date(plan.createdAt).toLocaleString()}`);
    console.log();
}
function planStatusColor(status) {
    switch (status) {
        case 'generating':
            return chalk.yellow('⏳ Generating');
        case 'ready':
            return chalk.blue('✓ Ready');
        case 'approved':
            return chalk.green('✓ Approved');
        case 'modified':
            return chalk.cyan('↻ Modified');
        case 'rejected':
            return chalk.red('✗ Rejected');
        default:
            return status;
    }
}
function printPlanPreview(plan) {
    const planData = plan.planData;
    if (!planData) {
        warn('No plan data available.');
        return;
    }
    console.log();
    if (planData.projectSummary) {
        console.log(chalk.bold('Project Summary'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(planData.projectSummary);
        console.log();
    }
    planData.sections.forEach((section, si) => {
        console.log(chalk.bold.cyan(`📋 ${si + 1}. ${section.name}`));
        if (section.description) {
            console.log(chalk.gray(`   ${section.description}`));
        }
        console.log();
        section.tasks.forEach((task, ti) => {
            const priority = task.priority || 'medium';
            const priorityStr = priority === 'urgent' ? chalk.red.bold(priority)
                : priority === 'high' ? chalk.yellow(priority)
                    : priority === 'medium' ? chalk.blue(priority)
                        : chalk.gray(priority);
            console.log(`   ${chalk.white(`${si + 1}.${ti + 1}`)} ${task.title} ${chalk.gray('[')}${priorityStr}${chalk.gray(']')}`);
            if (task.description) {
                console.log(chalk.gray(`       ${task.description}`));
            }
            if (task.subtasks && task.subtasks.length > 0) {
                task.subtasks.forEach((sub) => {
                    console.log(chalk.gray(`       └─ ${sub.title}`));
                });
            }
        });
        console.log();
    });
    if (planData.estimatedTotalTasks) {
        console.log(chalk.gray(`Estimated total tasks: ${planData.estimatedTotalTasks}`));
    }
    console.log();
}
export function registerPlanCommands(program) {
    const plan = program
        .command('plan')
        .description('AI-powered project planning');
    plan
        .command('create')
        .description('Create an AI-generated project plan')
        .option('-p, --project <id>', 'Project ID (uses local config if not provided)')
        .option('--prompt <prompt>', 'Plan description (skip editor)')
        .option('--auto-approve', 'Automatically approve the generated plan')
        .action(async (opts) => {
        try {
            const projectId = opts.project || getProjectId();
            if (!projectId) {
                warn('No project specified. Use --project <id> or run: memo8 init');
                return;
            }
            // Check usage
            const api = createApiClient();
            const { data: usageResp } = await api.get('/ai/plans/usage');
            const usageData = usageResp.data;
            if (usageData.remaining <= 0) {
                warn(`Daily plan limit reached (${usageData.used}/${usageData.limit}). Try again tomorrow.`);
                return;
            }
            info(`Plans remaining today: ${usageData.remaining}/${usageData.limit}`);
            console.log();
            let promptText;
            if (opts.prompt) {
                promptText = opts.prompt;
            }
            else {
                const answers = await inquirer.prompt([
                    {
                        type: 'editor',
                        name: 'prompt',
                        message: 'Describe your project (an editor will open):',
                        validate: (v) => (v.trim().length >= 10 ? true : 'Please provide at least 10 characters'),
                    },
                ]);
                promptText = answers.prompt;
            }
            const spinner = ora('Generating plan with AI... (this may take a moment)').start();
            const { data } = await api.post('/ai/plans', {
                project_id: Number(projectId),
                prompt: promptText.trim(),
            });
            spinner.stop();
            success('Plan generated!');
            printPlanPreview(data.data);
            // Non-interactive auto-approve
            if (opts.autoApprove) {
                const approveSpinner = ora('Approving plan and creating tasks...').start();
                await api.post(`/ai/plans/${data.data.id}/approve`);
                approveSpinner.stop();
                success('Plan approved! Tasks have been created.');
                return;
            }
            // Interactive Approve/Modify/Reject loop
            let currentPlan = data.data;
            let done = false;
            while (!done) {
                const { action } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'action',
                        message: 'What would you like to do?',
                        choices: [
                            { name: '✓ Approve & Create Tasks', value: 'approve' },
                            { name: '↻ Request Changes', value: 'modify' },
                            { name: '✗ Reject & Discard', value: 'reject' },
                        ],
                    },
                ]);
                if (action === 'approve') {
                    const approveSpinner = ora('Approving plan and creating tasks...').start();
                    await api.post(`/ai/plans/${currentPlan.id}/approve`);
                    approveSpinner.stop();
                    success('Plan approved! Tasks have been created.');
                    done = true;
                }
                else if (action === 'modify') {
                    const { modification } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'modification',
                            message: 'What changes would you like?',
                            validate: (v) => (v.trim().length > 0 ? true : 'Please describe your changes'),
                        },
                    ]);
                    const modifySpinner = ora('Modifying plan...').start();
                    const { data: modifiedData } = await api.post(`/ai/plans/${currentPlan.id}/modify`, { prompt: modification.trim() });
                    modifySpinner.stop();
                    success('Plan modified!');
                    currentPlan = modifiedData.data;
                    printPlanPreview(currentPlan);
                }
                else {
                    const { confirmReject } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'confirmReject',
                            message: 'Are you sure you want to discard this plan?',
                            default: false,
                        },
                    ]);
                    if (confirmReject) {
                        await api.del(`/ai/plans/${currentPlan.id}`);
                        info('Plan discarded.');
                        done = true;
                    }
                }
            }
        }
        catch (err) {
            handleError(err);
        }
    });
    plan
        .command('list')
        .description('List AI plans')
        .option('-p, --project <id>', 'Filter by project ID')
        .option('--per-page <n>', 'Items per page', '15')
        .option('--page <n>', 'Page number', '1')
        .action(async (opts) => {
        try {
            const spinner = ora('Fetching plans...').start();
            const api = createApiClient();
            const params = {
                per_page: opts.perPage,
                page: opts.page,
            };
            const projectId = opts.project || getProjectId();
            if (projectId)
                params.project_id = projectId;
            const { data } = await api.get('/ai/plans', params);
            spinner.stop();
            if (data.data.length === 0) {
                info('No plans found.');
                return;
            }
            const headers = ['ID', 'Status', 'Prompt', 'Created'];
            const rows = data.data.map((p) => [
                String(p.id),
                planStatusColor(p.status),
                p.prompt.length > 40 ? p.prompt.substring(0, 37) + '...' : p.prompt,
                new Date(p.createdAt).toLocaleDateString(),
            ]);
            // Use inline table printing
            const Table = (await import('cli-table3')).default;
            const table = new Table({
                head: headers.map((h) => chalk.cyan(h)),
                style: { head: [], border: [] },
            });
            rows.forEach((row) => table.push(row));
            console.log(table.toString());
            printPagination(data.meta);
        }
        catch (err) {
            handleError(err);
        }
    });
    plan
        .command('show <id>')
        .description('Show plan details')
        .action(async (id) => {
        try {
            const spinner = ora('Fetching plan...').start();
            const api = createApiClient();
            const { data } = await api.get(`/ai/plans/${id}`);
            spinner.stop();
            printPlanSummary(data.data);
            printPlanPreview(data.data);
        }
        catch (err) {
            handleError(err);
        }
    });
    plan
        .command('usage')
        .description('Show daily AI plan usage')
        .action(async () => {
        try {
            const spinner = ora('Fetching usage...').start();
            const api = createApiClient();
            const { data: resp } = await api.get('/ai/plans/usage');
            spinner.stop();
            const usage = resp.data;
            console.log();
            console.log(chalk.bold('AI Plan Usage (Today)'));
            console.log(chalk.gray('─'.repeat(30)));
            console.log(`  Used:      ${chalk.bold(String(usage.used))} / ${usage.limit}`);
            console.log(`  Remaining: ${usage.remaining > 0 ? chalk.green(String(usage.remaining)) : chalk.red('0')}`);
            // Progress bar
            const barWidth = 20;
            const filled = Math.round((usage.used / usage.limit) * barWidth);
            const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(barWidth - filled));
            console.log(`  ${bar}`);
            console.log();
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=plan.js.map