import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ora from 'ora';
import chalk from 'chalk';
import { createApiClient } from '../lib/api.js';
import { getProjectId } from '../lib/config.js';
import {
  success,
  warn,
  info,
  handleError,
} from '../lib/output.js';
import type {
  ApiResponse,
  AIContext,
} from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getCliRootDir(): string {
  // From src/commands/ or dist/commands/ → go up 2 levels to cli/
  return path.resolve(__dirname, '..', '..');
}

function readHelperFile(filename: string): string {
  const helperPath = path.join(getCliRootDir(), 'ai-rules', filename);
  if (fs.existsSync(helperPath)) {
    return fs.readFileSync(helperPath, 'utf-8').trim();
  }
  return '';
}

export function registerContextCommands(program: Command): void {
  program
    .command('context')
    .description('Build AI context for the current project')
    .option('-t, --task <id>', 'Build context for a specific task')
    .option('--topic <query>', 'Build context for a specific topic')
    .option('--copy', 'Print info about copying to clipboard')
    .action(async (opts) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Building AI context...').start();
        const api = createApiClient();

        let endpoint: string;
        const params: Record<string, unknown> = {};

        if (opts.task) {
          endpoint = `/projects/${projectId}/ai-context/task/${opts.task}`;
        } else if (opts.topic) {
          endpoint = `/projects/${projectId}/ai-context/topic`;
          params.q = opts.topic;
        } else {
          endpoint = `/projects/${projectId}/ai-context`;
        }

        const { data } = await api.get<ApiResponse<AIContext>>(endpoint, params);
        spinner.stop();

        const context = data.data;

        if (!opts.topic) {
          const helper = readHelperFile('CLAUDE.md');
          if (helper) {
            // Remove internal markers from stdout output
            const cleanHelper = helper
              .replace('<!-- memo8-reference-start -->', '')
              .trim();
            console.log(cleanHelper);
            console.log('\n## Live Project Data\n');
          }
        }
        console.log(context.context);

        if (opts.copy) {
          console.log();
          info(`Token estimate: ~${context.tokenEstimate} tokens`);
          info('To copy to clipboard, pipe the output:');
          console.log(chalk.cyan('  memo8 context | pbcopy'));
          console.log(chalk.cyan('  memo8 context --task 5 | xclip -selection clipboard'));
        }
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('context:cursor')
    .description('Generate .cursor/rules/memo8.mdc with project context')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Building context for Cursor rules...').start();
        const api = createApiClient();

        const { data } = await api.get<ApiResponse<AIContext>>(
          `/projects/${projectId}/ai-context`
        );
        spinner.stop();

        const rulesDir = path.join(process.cwd(), '.cursor', 'rules');
        const rulePath = path.join(rulesDir, 'memo8.mdc');

        if (!fs.existsSync(rulesDir)) {
          fs.mkdirSync(rulesDir, { recursive: true });
        }

        const helper = readHelperFile('cursor-rules.md');
        const contextBlock = data.data.context;

        // Remove the reference marker from output — cursor gets the full file
        const referenceMarker = '<!-- memo8-reference-start -->';
        const cleanHelper = helper.replace(referenceMarker, '');

        const mdcContent = [
          cleanHelper.trim(),
          '',
          '## Live Project Data',
          '',
          contextBlock,
          '',
        ].join('\n');

        fs.writeFileSync(rulePath, mdcContent);
        success('Created .cursor/rules/memo8.mdc with project context.');
        info(`Token estimate: ~${data.data.tokenEstimate} tokens`);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('context:update-claude-md')
    .description('Update .claude/CLAUDE.md with project context')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Building context for CLAUDE.md...').start();
        const api = createApiClient();

        const { data } = await api.get<ApiResponse<AIContext>>(
          `/projects/${projectId}/ai-context`
        );
        spinner.stop();

        const claudeDir = path.join(process.cwd(), '.claude');
        const claudeMdPath = path.join(claudeDir, 'CLAUDE.md');

        // Ensure .claude directory exists
        if (!fs.existsSync(claudeDir)) {
          fs.mkdirSync(claudeDir, { recursive: true });
        }

        const helper = readHelperFile('CLAUDE.md');
        const contextBlock = data.data.context;
        const marker = '<!-- memo8-context-start -->';
        const endMarker = '<!-- memo8-context-end -->';
        const mandatoryMarker = '<!-- memo8-mandatory-start -->';
        const mandatoryEndMarker = '<!-- memo8-mandatory-end -->';
        const referenceMarker = '<!-- memo8-reference-start -->';

        // Split template: mandatory rules go OUTSIDE context markers,
        // reference docs go INSIDE (so AI agents don't treat rules as auto-generated)
        const refIdx = helper.indexOf(referenceMarker);
        let mandatorySection = '';
        let referenceSection = helper;

        if (refIdx !== -1) {
          mandatorySection = helper.substring(0, refIdx).trim();
          referenceSection = helper.substring(refIdx + referenceMarker.length).trim();
        }

        const liveData = contextBlock ? `\n## Live Project Data\n\n${contextBlock}` : '';
        const wrappedContext = `${marker}\n${referenceSection}${liveData}\n${endMarker}`;
        const mandatoryBlock = mandatorySection
          ? `${mandatoryMarker}\n${mandatorySection}\n${mandatoryEndMarker}`
          : '';

        if (fs.existsSync(claudeMdPath)) {
          let existing = fs.readFileSync(claudeMdPath, 'utf-8');

          // Update mandatory block
          const mStartIdx = existing.indexOf(mandatoryMarker);
          const mEndIdx = existing.indexOf(mandatoryEndMarker);

          if (mStartIdx !== -1 && mEndIdx !== -1) {
            existing =
              existing.substring(0, mStartIdx) +
              mandatoryBlock +
              existing.substring(mEndIdx + mandatoryEndMarker.length);
          }

          // Update context block
          const startIdx = existing.indexOf(marker);
          const endIdx = existing.indexOf(endMarker);

          if (startIdx !== -1 && endIdx !== -1) {
            existing =
              existing.substring(0, startIdx) +
              wrappedContext +
              existing.substring(endIdx + endMarker.length);
          } else if (mStartIdx !== -1) {
            // Has mandatory block but no context block — append after mandatory
            existing = existing.trimEnd() + '\n\n' + wrappedContext + '\n';
          } else {
            // No blocks at all — append both
            existing = existing.trimEnd() + '\n\n' + mandatoryBlock + '\n\n' + wrappedContext + '\n';
          }

          fs.writeFileSync(claudeMdPath, existing);
          success('Updated .claude/CLAUDE.md with latest project context.');
        } else {
          // Create new file with mandatory rules outside context block
          const content = mandatoryBlock
            ? `# Project Context\n\n${mandatoryBlock}\n\n${wrappedContext}\n`
            : `# Project Context\n\n${wrappedContext}\n`;
          fs.writeFileSync(claudeMdPath, content);
          success('Created .claude/CLAUDE.md with project context.');
        }

        info(`Token estimate: ~${data.data.tokenEstimate} tokens`);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('context:codex')
    .description('Generate AGENTS.md with project context (OpenAI Codex)')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Building context for AGENTS.md...').start();
        const api = createApiClient();

        const { data } = await api.get<ApiResponse<AIContext>>(
          `/projects/${projectId}/ai-context`
        );
        spinner.stop();

        const agentsMdPath = path.join(process.cwd(), 'AGENTS.md');
        const helper = readHelperFile('codex-rules.md');
        const contextBlock = data.data.context;
        const marker = '<!-- memo8-context-start -->';
        const endMarker = '<!-- memo8-context-end -->';
        const mandatoryMarker = '<!-- memo8-mandatory-start -->';
        const mandatoryEndMarker = '<!-- memo8-mandatory-end -->';
        const referenceMarker = '<!-- memo8-reference-start -->';

        const refIdx = helper.indexOf(referenceMarker);
        let mandatorySection = '';
        let referenceSection = helper;

        if (refIdx !== -1) {
          mandatorySection = helper.substring(0, refIdx).trim();
          referenceSection = helper.substring(refIdx + referenceMarker.length).trim();
        }

        const liveData = contextBlock ? `\n## Live Project Data\n\n${contextBlock}` : '';
        const wrappedContext = `${marker}\n${referenceSection}${liveData}\n${endMarker}`;
        const mandatoryBlock = mandatorySection
          ? `${mandatoryMarker}\n${mandatorySection}\n${mandatoryEndMarker}`
          : '';

        if (fs.existsSync(agentsMdPath)) {
          let existing = fs.readFileSync(agentsMdPath, 'utf-8');

          const mStartIdx = existing.indexOf(mandatoryMarker);
          const mEndIdx = existing.indexOf(mandatoryEndMarker);
          if (mStartIdx !== -1 && mEndIdx !== -1) {
            existing =
              existing.substring(0, mStartIdx) +
              mandatoryBlock +
              existing.substring(mEndIdx + mandatoryEndMarker.length);
          }

          const startIdx = existing.indexOf(marker);
          const endIdx = existing.indexOf(endMarker);
          if (startIdx !== -1 && endIdx !== -1) {
            existing =
              existing.substring(0, startIdx) +
              wrappedContext +
              existing.substring(endIdx + endMarker.length);
          } else if (mStartIdx !== -1) {
            existing = existing.trimEnd() + '\n\n' + wrappedContext + '\n';
          } else {
            existing = existing.trimEnd() + '\n\n' + mandatoryBlock + '\n\n' + wrappedContext + '\n';
          }

          fs.writeFileSync(agentsMdPath, existing);
          success('Updated AGENTS.md with latest project context.');
        } else {
          const content = mandatoryBlock
            ? `# Project Context\n\n${mandatoryBlock}\n\n${wrappedContext}\n`
            : `# Project Context\n\n${wrappedContext}\n`;
          fs.writeFileSync(agentsMdPath, content);
          success('Created AGENTS.md with project context.');
        }

        info(`Token estimate: ~${data.data.tokenEstimate} tokens`);
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('context:gemini')
    .description('Generate .gemini/GEMINI.md with project context (Google Gemini)')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Building context for GEMINI.md...').start();
        const api = createApiClient();

        const { data } = await api.get<ApiResponse<AIContext>>(
          `/projects/${projectId}/ai-context`
        );
        spinner.stop();

        const geminiDir = path.join(process.cwd(), '.gemini');
        const geminiMdPath = path.join(geminiDir, 'GEMINI.md');

        if (!fs.existsSync(geminiDir)) {
          fs.mkdirSync(geminiDir, { recursive: true });
        }

        const helper = readHelperFile('gemini-rules.md');
        const contextBlock = data.data.context;
        const marker = '<!-- memo8-context-start -->';
        const endMarker = '<!-- memo8-context-end -->';
        const mandatoryMarker = '<!-- memo8-mandatory-start -->';
        const mandatoryEndMarker = '<!-- memo8-mandatory-end -->';
        const referenceMarker = '<!-- memo8-reference-start -->';

        const refIdx = helper.indexOf(referenceMarker);
        let mandatorySection = '';
        let referenceSection = helper;

        if (refIdx !== -1) {
          mandatorySection = helper.substring(0, refIdx).trim();
          referenceSection = helper.substring(refIdx + referenceMarker.length).trim();
        }

        const liveData = contextBlock ? `\n## Live Project Data\n\n${contextBlock}` : '';
        const wrappedContext = `${marker}\n${referenceSection}${liveData}\n${endMarker}`;
        const mandatoryBlock = mandatorySection
          ? `${mandatoryMarker}\n${mandatorySection}\n${mandatoryEndMarker}`
          : '';

        if (fs.existsSync(geminiMdPath)) {
          let existing = fs.readFileSync(geminiMdPath, 'utf-8');

          const mStartIdx = existing.indexOf(mandatoryMarker);
          const mEndIdx = existing.indexOf(mandatoryEndMarker);
          if (mStartIdx !== -1 && mEndIdx !== -1) {
            existing =
              existing.substring(0, mStartIdx) +
              mandatoryBlock +
              existing.substring(mEndIdx + mandatoryEndMarker.length);
          }

          const startIdx = existing.indexOf(marker);
          const endIdx = existing.indexOf(endMarker);
          if (startIdx !== -1 && endIdx !== -1) {
            existing =
              existing.substring(0, startIdx) +
              wrappedContext +
              existing.substring(endIdx + endMarker.length);
          } else if (mStartIdx !== -1) {
            existing = existing.trimEnd() + '\n\n' + wrappedContext + '\n';
          } else {
            existing = existing.trimEnd() + '\n\n' + mandatoryBlock + '\n\n' + wrappedContext + '\n';
          }

          fs.writeFileSync(geminiMdPath, existing);
          success('Updated .gemini/GEMINI.md with latest project context.');
        } else {
          const content = mandatoryBlock
            ? `# Project Context\n\n${mandatoryBlock}\n\n${wrappedContext}\n`
            : `# Project Context\n\n${wrappedContext}\n`;
          fs.writeFileSync(geminiMdPath, content);
          success('Created .gemini/GEMINI.md with project context.');
        }

        info(`Token estimate: ~${data.data.tokenEstimate} tokens`);
      } catch (err) {
        handleError(err);
      }
    });
}
