import chalk from 'chalk';
import Table from 'cli-table3';
// Message helpers
export function success(message) {
    console.log(chalk.green('✓'), message);
}
export function error(message) {
    console.error(chalk.red('✗'), message);
}
export function warn(message) {
    console.log(chalk.yellow('⚠'), message);
}
export function info(message) {
    console.log(chalk.blue('ℹ'), message);
}
// Generic table
export function printTable(headers, rows) {
    const table = new Table({
        head: headers.map((h) => chalk.cyan(h)),
        style: { head: [], border: [] },
    });
    rows.forEach((row) => table.push(row));
    console.log(table.toString());
}
// Status colors
function statusColor(status) {
    switch (status) {
        case 'todo':
        case 'pending':
            return chalk.gray(status);
        case 'in_progress':
        case 'active':
            return chalk.yellow(status);
        case 'done':
        case 'completed':
            return chalk.green(status);
        case 'cancelled':
        case 'archived':
            return chalk.red(status);
        default:
            return status;
    }
}
// Priority colors
function priorityColor(priority) {
    switch (priority) {
        case 'low':
            return chalk.gray(priority);
        case 'medium':
            return chalk.blue(priority);
        case 'high':
            return chalk.yellow(priority);
        case 'urgent':
            return chalk.red.bold(priority);
        default:
            return priority;
    }
}
// Resource list formatters
export function printProjectList(projects) {
    if (projects.length === 0) {
        info('No projects found.');
        return;
    }
    const headers = ['ID', 'Name', 'Status', 'Tasks', 'Memories', 'Updated'];
    const rows = projects.map((p) => [
        String(p.id),
        p.name,
        statusColor(p.status),
        String(p.tasksCount ?? '-'),
        String(p.memoriesCount ?? '-'),
        new Date(p.updatedAt).toLocaleDateString(),
    ]);
    printTable(headers, rows);
}
export function printTaskList(tasks) {
    if (tasks.length === 0) {
        info('No tasks found.');
        return;
    }
    const headers = ['ID', 'Title', 'Status', 'Priority', 'Project', 'Updated'];
    const rows = tasks.map((t) => [
        String(t.id),
        t.title.length > 40 ? t.title.substring(0, 37) + '...' : t.title,
        statusColor(t.status),
        priorityColor(t.priority),
        t.project?.name ?? String(t.projectId),
        new Date(t.updatedAt).toLocaleDateString(),
    ]);
    printTable(headers, rows);
}
export function printMemoryList(memories) {
    if (memories.length === 0) {
        info('No memories found.');
        return;
    }
    const headers = ['ID', 'Title', 'Type', 'Project', 'Updated'];
    const rows = memories.map((m) => [
        String(m.id),
        m.title.length > 50 ? m.title.substring(0, 47) + '...' : m.title,
        m.type,
        m.project?.name ?? String(m.projectId),
        new Date(m.updatedAt).toLocaleDateString(),
    ]);
    printTable(headers, rows);
}
export function printTagList(tags) {
    if (tags.length === 0) {
        info('No tags found.');
        return;
    }
    const headers = ['ID', 'Name', 'Color', 'Tasks', 'Memories'];
    const rows = tags.map((t) => [
        String(t.id),
        t.color ? chalk.hex(t.color)(t.name) : t.name,
        t.color ?? '-',
        String(t.tasksCount ?? '-'),
        String(t.memoriesCount ?? '-'),
    ]);
    printTable(headers, rows);
}
// Detail formatters
export function printProjectDetail(project) {
    console.log();
    console.log(chalk.bold(`Project #${project.id}: ${project.name}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  Status:      ${statusColor(project.status)}`);
    console.log(`  Description: ${project.description || chalk.gray('(none)')}`);
    if (project.tasksCount !== undefined) {
        console.log(`  Tasks:       ${project.tasksCount}`);
    }
    if (project.memoriesCount !== undefined) {
        console.log(`  Memories:    ${project.memoriesCount}`);
    }
    console.log(`  Created:     ${new Date(project.createdAt).toLocaleString()}`);
    console.log(`  Updated:     ${new Date(project.updatedAt).toLocaleString()}`);
    console.log();
}
export function printTaskDetail(task) {
    console.log();
    console.log(chalk.bold(`Task #${task.id}: ${task.title}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  Status:      ${statusColor(task.status)}`);
    console.log(`  Priority:    ${priorityColor(task.priority)}`);
    console.log(`  Project:     ${task.project?.name ?? task.projectId}`);
    console.log(`  Description: ${task.description || chalk.gray('(none)')}`);
    if (task.parentTaskId) {
        console.log(`  Parent:      #${task.parentTaskId}`);
    }
    if (task.tags && task.tags.length > 0) {
        console.log(`  Tags:        ${task.tags.map((t) => t.name).join(', ')}`);
    }
    if (task.subtasks && task.subtasks.length > 0) {
        console.log(`  Subtasks:    ${task.subtasks.length}`);
        task.subtasks.forEach((s) => {
            console.log(`    - #${s.id} ${s.title} [${statusColor(s.status)}]`);
        });
    }
    console.log(`  Created:     ${new Date(task.createdAt).toLocaleString()}`);
    console.log(`  Updated:     ${new Date(task.updatedAt).toLocaleString()}`);
    console.log();
}
export function printMemoryDetail(memory) {
    console.log();
    console.log(chalk.bold(`Memory #${memory.id}: ${memory.title}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  Type:        ${memory.type}`);
    console.log(`  Project:     ${memory.project?.name ?? memory.projectId}`);
    if (memory.tags && memory.tags.length > 0) {
        console.log(`  Tags:        ${memory.tags.map((t) => t.name).join(', ')}`);
    }
    if (memory.tasks && memory.tasks.length > 0) {
        console.log(`  Linked Tasks: ${memory.tasks.map((t) => `#${t.id}`).join(', ')}`);
    }
    if (memory.metadata?.code_flow && memory.metadata.code_flow.length > 0) {
        console.log(`  Code Flow:   ${chalk.magenta(memory.metadata.code_flow.join(' -> '))}`);
    }
    console.log(`  Created:     ${new Date(memory.createdAt).toLocaleString()}`);
    console.log(`  Updated:     ${new Date(memory.updatedAt).toLocaleString()}`);
    console.log(chalk.gray('─'.repeat(50)));
    console.log(memory.content);
    console.log();
}
export function printTagDetail(tag) {
    console.log();
    console.log(chalk.bold(`Tag #${tag.id}: ${tag.color ? chalk.hex(tag.color)(tag.name) : tag.name}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  Color:       ${tag.color ?? chalk.gray('(none)')}`);
    console.log(`  Description: ${tag.description || chalk.gray('(none)')}`);
    if (tag.tasksCount !== undefined) {
        console.log(`  Tasks:       ${tag.tasksCount}`);
    }
    if (tag.memoriesCount !== undefined) {
        console.log(`  Memories:    ${tag.memoriesCount}`);
    }
    console.log(`  Created:     ${new Date(tag.createdAt).toLocaleString()}`);
    console.log();
}
// Pagination
export function printPagination(meta) {
    if (meta && meta.lastPage > 1) {
        console.log(chalk.gray(`\nPage ${meta.currentPage} of ${meta.lastPage} (${meta.total} total)`));
    }
}
// Stats
export function printStats(title, stats) {
    console.log();
    console.log(chalk.bold(title));
    console.log(chalk.gray('─'.repeat(30)));
    for (const [key, value] of Object.entries(stats)) {
        const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
        console.log(`  ${label}: ${chalk.bold(String(value))}`);
    }
    console.log();
}
// Error handler for commands
export function handleError(err) {
    if (err instanceof Error) {
        error(err.message);
        if ('errors' in err) {
            const validationErrors = err.errors;
            for (const [field, messages] of Object.entries(validationErrors)) {
                messages.forEach((msg) => {
                    console.error(chalk.red(`  ${field}: ${msg}`));
                });
            }
        }
    }
    else {
        error('An unexpected error occurred');
    }
    process.exit(1);
}
//# sourceMappingURL=output.js.map