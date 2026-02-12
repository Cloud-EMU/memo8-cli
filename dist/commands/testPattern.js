import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { createApiClient } from '../lib/api.js';
import { getProjectId } from '../lib/config.js';
import { success, warn, info, handleError, printTable, printPagination, } from '../lib/output.js';
const TEST_TYPES = [
    'unit',
    'integration',
    'feature',
    'e2e',
    'api',
    'browser',
    'performance',
    'other',
];
export function registerTestPatternCommands(program) {
    const testPattern = program
        .command('test-pattern')
        .description('Manage test patterns');
    testPattern
        .command('list')
        .description('List test patterns')
        .option('--per-page <n>', 'Items per page', '15')
        .option('--page <n>', 'Page number', '1')
        .action(async (opts) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Fetching test patterns...').start();
            const api = createApiClient();
            const params = {
                per_page: opts.perPage,
                page: opts.page,
            };
            const { data } = await api.get(`/projects/${projectId}/test-patterns`, params);
            spinner.stop();
            if (data.data.length === 0) {
                info('No test patterns found.');
                return;
            }
            const headers = ['ID', 'Name', 'Type', 'Applicable To'];
            const rows = data.data.map((tp) => [
                String(tp.id),
                tp.patternName.length > 30 ? tp.patternName.substring(0, 27) + '...' : tp.patternName,
                tp.testType,
                tp.applicableTo ? tp.applicableTo.join(', ') : '-',
            ]);
            printTable(headers, rows);
            printPagination(data.meta);
        }
        catch (err) {
            handleError(err);
        }
    });
    testPattern
        .command('add')
        .description('Add a new test pattern')
        .option('--pattern-name <name>', 'Pattern name')
        .option('--test-type <type>', 'Test type (unit/integration/feature/e2e/api/browser/performance/other)')
        .option('--description <desc>', 'Description')
        .option('--template-code <code>', 'Template code')
        .option('--applicable-to <types>', 'Comma-separated applicable types')
        .action(async (opts) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            let patternName;
            let testType;
            let description;
            let templateCode;
            let applicableTo;
            if (opts.patternName && opts.templateCode) {
                // Non-interactive mode
                patternName = opts.patternName;
                testType = opts.testType || 'unit';
                description = opts.description || undefined;
                templateCode = opts.templateCode;
                if (opts.applicableTo?.trim()) {
                    applicableTo = opts.applicableTo.split(',').map((t) => t.trim()).filter(Boolean);
                }
            }
            else {
                // Interactive mode
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'pattern_name',
                        message: 'Pattern name:',
                        validate: (v) => (v.length > 0 ? true : 'Name is required'),
                    },
                    {
                        type: 'list',
                        name: 'test_type',
                        message: 'Test type:',
                        choices: TEST_TYPES,
                    },
                    {
                        type: 'input',
                        name: 'description',
                        message: 'Description (optional):',
                    },
                    {
                        type: 'editor',
                        name: 'template_code',
                        message: 'Template code (editor will open):',
                        validate: (v) => (v.trim().length > 0 ? true : 'Template code is required'),
                    },
                    {
                        type: 'input',
                        name: 'applicable_to',
                        message: 'Applicable to (comma-separated, e.g. controllers,services):',
                    },
                ]);
                patternName = answers.pattern_name;
                testType = answers.test_type;
                description = answers.description || undefined;
                templateCode = answers.template_code.trim();
                if (answers.applicable_to?.trim()) {
                    applicableTo = answers.applicable_to.split(',').map((t) => t.trim()).filter(Boolean);
                }
            }
            const spinner = ora('Creating test pattern...').start();
            const api = createApiClient();
            const payload = {
                pattern_name: patternName,
                test_type: testType,
                template_code: templateCode,
            };
            if (description)
                payload.description = description;
            if (applicableTo && applicableTo.length > 0)
                payload.applicable_to = applicableTo;
            const { data } = await api.post(`/projects/${projectId}/test-patterns`, payload);
            spinner.stop();
            success(`Test pattern "${data.data.patternName}" created (#${data.data.id})`);
        }
        catch (err) {
            handleError(err);
        }
    });
    testPattern
        .command('show <id>')
        .description('Show test pattern details')
        .action(async (id) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Fetching test pattern...').start();
            const api = createApiClient();
            const { data } = await api.get(`/projects/${projectId}/test-patterns/${id}`);
            spinner.stop();
            const tp = data.data;
            console.log();
            console.log(chalk.bold(`Test Pattern #${tp.id}: ${tp.patternName}`));
            console.log(chalk.gray('-'.repeat(50)));
            console.log(`  Type:          ${tp.testType}`);
            if (tp.description) {
                console.log(`  Description:   ${tp.description}`);
            }
            if (tp.applicableTo && tp.applicableTo.length > 0) {
                console.log(`  Applicable To: ${tp.applicableTo.join(', ')}`);
            }
            console.log(`  Created:       ${new Date(tp.createdAt).toLocaleString()}`);
            console.log(`  Updated:       ${new Date(tp.updatedAt).toLocaleString()}`);
            console.log();
            console.log(chalk.bold('Template Code'));
            console.log(chalk.gray('-'.repeat(50)));
            console.log(tp.templateCode);
            console.log();
        }
        catch (err) {
            handleError(err);
        }
    });
    testPattern
        .command('detect')
        .description('Auto-detect test patterns from codebase')
        .action(async () => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Starting test pattern detection...').start();
            const api = createApiClient();
            await api.post(`/projects/${projectId}/test-patterns/detect`);
            spinner.stop();
            success('Test pattern detection started.');
            info('This runs in the background. Check results with: memo8 test-pattern list');
        }
        catch (err) {
            handleError(err);
        }
    });
    testPattern
        .command('generate <taskId>')
        .description('Generate test code for a task')
        .option('--stdout', 'Output generated code to stdout without confirmation')
        .action(async (taskId, opts) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const spinner = ora('Generating test for task...').start();
            const api = createApiClient();
            const { data } = await api.post(`/projects/${projectId}/test-patterns/generate-for-task/${taskId}`);
            spinner.stop();
            const result = data.data;
            console.log();
            console.log(chalk.bold(`Generated Test for Task #${taskId}`));
            console.log(chalk.gray('-'.repeat(50)));
            console.log(`  Pattern: ${result.patternName}`);
            console.log(`  Type:    ${result.testType}`);
            console.log();
            console.log(chalk.bold('Generated Code'));
            console.log(chalk.gray('-'.repeat(50)));
            console.log(result.testCode);
            console.log();
            if (opts.stdout) {
                process.stdout.write(result.testCode);
            }
            else {
                const { save } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'save',
                        message: 'Copy generated test to stdout?',
                        default: false,
                    },
                ]);
                if (save) {
                    process.stdout.write(result.testCode);
                }
            }
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=testPattern.js.map