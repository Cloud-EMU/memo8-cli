import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { createRequire } from 'node:module';
import type { Ignore } from 'ignore';

const _require = createRequire(import.meta.url);
const ignore = _require('ignore') as () => Ignore;
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
  PaginatedResponse,
  CodebaseFile,
  CodeSymbol,
  IndexStatus,
} from '../types/index.js';

const MAX_BATCH_BYTES = 4 * 1024 * 1024; // 4MB per batch payload
const MAX_FILE_SIZE = 512 * 1024; // 512KB

const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  'vendor',
  'dist',
  'build',
  '.next',
  'storage',
  '.DS_Store',
  '*.lock',
  'package-lock.json',
  'composer.lock',
  '*.min.js',
  '*.min.css',
  '*.map',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.svg',
  '*.ico',
  '*.woff',
  '*.woff2',
  '*.ttf',
  '*.eot',
  '*.pdf',
  '*.zip',
  '*.tar.gz',
  '*.sqlite',
  '*.db',
  '*.pyc',
  '.env',
  '.env.*',
  '.memo8.json',
];

interface FileEntry {
  file_path: string;
  file_hash: string;
  content: string;
}

function loadGitignore(dir: string): Ignore {
  const ig = ignore();
  ig.add(DEFAULT_IGNORE);

  const gitignorePath = path.join(dir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    ig.add(content);
  }

  const memo8ignorePath = path.join(dir, '.memo8ignore');
  if (fs.existsSync(memo8ignorePath)) {
    const content = fs.readFileSync(memo8ignorePath, 'utf-8');
    ig.add(content);
  }

  return ig;
}

function walkDirectory(dir: string, ig: Ignore, baseDir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (ig.ignores(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Also check directory with trailing slash
      if (!ig.ignores(relativePath + '/')) {
        files.push(...walkDirectory(fullPath, ig, baseDir));
      }
    } else if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      if (stat.size <= MAX_FILE_SIZE) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

export function registerCodebaseCommands(program: Command): void {
  const codebase = program
    .command('codebase')
    .description('Manage codebase indexing');

  codebase
    .command('index')
    .description('Index current directory files')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const baseDir = process.cwd();
        const ig = loadGitignore(baseDir);

        const spinner = ora('Scanning files...').start();
        const filePaths = walkDirectory(baseDir, ig, baseDir);
        spinner.stop();

        info(`Found ${filePaths.length} files to index.`);

        if (filePaths.length === 0) {
          warn('No files found to index.');
          return;
        }

        const api = createApiClient();

        // Read all files and prepare entries
        const progressSpinner = ora('Reading files...').start();
        const allEntries: FileEntry[] = [];

        for (const filePath of filePaths) {
          try {
            const buf = fs.readFileSync(filePath);
            // Skip binary files (contains null bytes in first 8KB)
            if (buf.subarray(0, 8192).includes(0)) {
              continue;
            }
            const content = buf.toString('utf-8');
            // Skip empty files
            if (!content.trim()) {
              continue;
            }
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            const relativePath = path.relative(baseDir, filePath);

            allEntries.push({
              file_path: relativePath,
              file_hash: hash,
              content,
            });
          } catch {
            // Skip files that can't be read (permission issues, etc.)
          }
        }

        if (allEntries.length === 0) {
          progressSpinner.stop();
          warn('No indexable files found (all binary or empty).');
          return;
        }

        // Build size-based batches
        const batches: FileEntry[][] = [];
        let currentBatch: FileEntry[] = [];
        let currentSize = 0;

        for (const entry of allEntries) {
          const entrySize = Buffer.byteLength(entry.content, 'utf-8') + entry.file_path.length + entry.file_hash.length + 100;

          if (currentBatch.length > 0 && currentSize + entrySize > MAX_BATCH_BYTES) {
            batches.push(currentBatch);
            currentBatch = [];
            currentSize = 0;
          }

          currentBatch.push(entry);
          currentSize += entrySize;
        }
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }

        let indexed = 0;
        progressSpinner.text = `Indexing files... (0/${allEntries.length}) [batch 0/${batches.length}]`;

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          try {
            await api.post(`/projects/${projectId}/codebase/index`, { files: batch });
          } catch (err: unknown) {
            // On 413, split batch in half and retry
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 413 && batch.length > 1) {
              const mid = Math.ceil(batch.length / 2);
              const half1 = batch.slice(0, mid);
              const half2 = batch.slice(mid);
              await api.post(`/projects/${projectId}/codebase/index`, { files: half1 });
              await api.post(`/projects/${projectId}/codebase/index`, { files: half2 });
            } else {
              throw err;
            }
          }

          indexed += batch.length;
          progressSpinner.text = `Indexing files... (${indexed}/${allEntries.length}) [batch ${i + 1}/${batches.length}]`;
        }

        progressSpinner.stop();
        success(`Indexed ${allEntries.length} files in ${batches.length} batches.`);
      } catch (err) {
        handleError(err);
      }
    });

  codebase
    .command('search <query>')
    .description('Search indexed codebase')
    .action(async (query: string) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Searching codebase...').start();
        const api = createApiClient();

        const { data } = await api.get<{ data: CodebaseFile[] }>(
          `/projects/${projectId}/codebase/search`,
          { q: query }
        );
        spinner.stop();

        if (data.data.length === 0) {
          info('No results found.');
          return;
        }

        const headers = ['ID', 'File Path', 'Language', 'Type', 'Summary'];
        const rows = data.data.map((f: CodebaseFile) => [
          String(f.id),
          f.filePath.length > 40 ? '...' + f.filePath.slice(-37) : f.filePath,
          f.language || '-',
          f.fileType,
          f.contentSummary
            ? f.contentSummary.length > 30
              ? f.contentSummary.substring(0, 27) + '...'
              : f.contentSummary
            : '-',
        ]);
        printTable(headers, rows);
      } catch (err) {
        handleError(err);
      }
    });

  codebase
    .command('status')
    .description('Show codebase index status')
    .action(async () => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching status...').start();
        const api = createApiClient();

        const { data } = await api.get<ApiResponse<IndexStatus>>(
          `/projects/${projectId}/codebase/status`
        );
        spinner.stop();

        const status = data.data;
        console.log();
        console.log(chalk.bold('Codebase Index Status'));
        console.log(chalk.gray('-'.repeat(40)));
        console.log(`  Status:   ${status.status}`);
        console.log(`  Progress: ${status.progress}/${status.total} files`);
        console.log(`  Message:  ${status.message}`);

        if (status.total > 0) {
          const pct = Math.round((status.progress / status.total) * 100);
          const barWidth = 20;
          const filled = Math.round((pct / 100) * barWidth);
          const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(barWidth - filled));
          console.log(`  ${bar} ${pct}%`);
        }
        console.log();
      } catch (err) {
        handleError(err);
      }
    });

  codebase
    .command('symbols')
    .argument('[name]', 'Filter symbols by name')
    .description('List code symbols from indexed files')
    .action(async (name?: string) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        const spinner = ora('Fetching symbols...').start();
        const api = createApiClient();

        const params: Record<string, unknown> = {};
        if (name) params.name = name;

        const { data } = await api.get<{ data: CodeSymbol[] }>(
          `/projects/${projectId}/codebase/symbols`,
          params
        );
        spinner.stop();

        if (data.data.length === 0) {
          info('No symbols found.');
          return;
        }

        const headers = ['ID', 'Name', 'Type', 'Namespace', 'Signature', 'Lines'];
        const rows = data.data.map((s: CodeSymbol) => [
          String(s.id),
          s.symbolName,
          s.symbolType,
          s.namespace || '-',
          s.signature
            ? s.signature.length > 30
              ? s.signature.substring(0, 27) + '...'
              : s.signature
            : '-',
          s.startLine && s.endLine ? `${s.startLine}-${s.endLine}` : '-',
        ]);
        printTable(headers, rows);
      } catch (err) {
        handleError(err);
      }
    });

  codebase
    .command('clear')
    .description('Clear codebase index')
    .option('-f, --force', 'Skip confirmation')
    .action(async (opts: { force?: boolean }) => {
      try {
        const projectId = getProjectId();
        if (!projectId) {
          warn('No project specified. Run: memo8 init');
          return;
        }

        if (!opts.force) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Are you sure you want to clear the codebase index? This cannot be undone.',
              default: false,
            },
          ]);

          if (!confirm) return;
        }

        const spinner = ora('Clearing codebase index...').start();
        const api = createApiClient();

        await api.del(`/projects/${projectId}/codebase`);
        spinner.stop();

        success('Codebase index cleared.');
      } catch (err) {
        handleError(err);
      }
    });
}
