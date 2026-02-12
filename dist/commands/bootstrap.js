import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const ignore = _require('ignore');
import { createApiClient } from '../lib/api.js';
import { getProjectId } from '../lib/config.js';
import { success, warn, info, handleError, } from '../lib/output.js';
const DEFAULT_IGNORE = [
    'node_modules', '.git', 'vendor', 'dist', 'build', '.next',
    'storage', '.DS_Store', '*.lock', 'package-lock.json', 'composer.lock',
    '*.min.js', '*.min.css', '*.map',
    '*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.ico',
    '*.woff', '*.woff2', '*.ttf', '*.eot',
    '*.pdf', '*.zip', '*.tar.gz', '*.sqlite', '*.db', '*.pyc',
    '.env', '.env.*', '.memo8.json',
];
const ENTRY_POINT_PATTERNS = [
    'index.ts', 'index.js', 'index.tsx', 'index.jsx',
    'main.ts', 'main.js', 'main.py', 'main.go',
    'app.ts', 'app.js', 'app.py', 'app.php',
    'server.ts', 'server.js',
    'manage.py', 'wsgi.py', 'asgi.py',
    'artisan',
    'Program.cs', 'Startup.cs',
    'Makefile', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    'package.json', 'composer.json', 'Cargo.toml', 'go.mod', 'Gemfile',
    'tsconfig.json', '.eslintrc.js', '.eslintrc.json', 'vite.config.ts',
    'webpack.config.js', 'next.config.js', 'next.config.ts', 'next.config.mjs',
    'tailwind.config.js', 'tailwind.config.ts',
];
const MAX_FILE_LINES = 150;
const MAX_FILES_TO_READ = 15;
const MAX_FILE_SIZE = 512 * 1024;
function loadIgnore(dir) {
    const ig = ignore();
    ig.add(DEFAULT_IGNORE);
    const gitignorePath = path.join(dir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        ig.add(fs.readFileSync(gitignorePath, 'utf-8'));
    }
    const memo8ignorePath = path.join(dir, '.memo8ignore');
    if (fs.existsSync(memo8ignorePath)) {
        ig.add(fs.readFileSync(memo8ignorePath, 'utf-8'));
    }
    return ig;
}
function walkDirectoryForTree(dir, ig, baseDir, depth = 0, maxDepth = 4) {
    if (depth > maxDepth)
        return [];
    const results = [];
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return results;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        if (ig.ignores(relativePath))
            continue;
        if (entry.isDirectory()) {
            if (!ig.ignores(relativePath + '/')) {
                results.push(relativePath + '/');
                results.push(...walkDirectoryForTree(fullPath, ig, baseDir, depth + 1, maxDepth));
            }
        }
        else if (entry.isFile()) {
            results.push(relativePath);
        }
    }
    return results;
}
function getGitLog(dir, count) {
    try {
        return execSync(`git log --oneline -${count} --format="%h %s (%an, %ar)"`, { cwd: dir, encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    }
    catch {
        return '';
    }
}
function getMostChangedFiles(dir, limit) {
    try {
        const raw = execSync(`git log --name-only --format="" --diff-filter=ACMR | sort | uniq -c | sort -rn | head -${limit}`, { cwd: dir, encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        if (!raw)
            return [];
        return raw.split('\n')
            .map(line => {
            const match = line.trim().match(/^\d+\s+(.+)$/);
            return match ? match[1] : '';
        })
            .filter(f => f.length > 0);
    }
    catch {
        return [];
    }
}
function findEntryPoints(dir, ig) {
    const found = [];
    function search(searchPath, depth) {
        if (depth > 3)
            return;
        let entries;
        try {
            entries = fs.readdirSync(searchPath, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(searchPath, entry.name);
            const relativePath = path.relative(dir, fullPath);
            if (ig.ignores(relativePath))
                continue;
            if (entry.isFile() && ENTRY_POINT_PATTERNS.includes(entry.name)) {
                found.push(relativePath);
            }
            else if (entry.isDirectory() && !ig.ignores(relativePath + '/')) {
                search(fullPath, depth + 1);
            }
        }
    }
    search(dir, 0);
    return found;
}
function readFileTruncated(filePath, maxLines) {
    try {
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_FILE_SIZE)
            return '[file too large]';
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        if (lines.length <= maxLines)
            return content;
        return lines.slice(0, maxLines).join('\n') + `\n... (truncated, ${lines.length} total lines)`;
    }
    catch {
        return '[could not read file]';
    }
}
async function runStackScan(projectId, dir) {
    const api = createApiClient();
    const files = {};
    const composerPath = path.join(dir, 'composer.json');
    if (fs.existsSync(composerPath)) {
        files['composer.json'] = fs.readFileSync(composerPath, 'utf-8');
    }
    const packagePath = path.join(dir, 'package.json');
    if (fs.existsSync(packagePath)) {
        files['package.json'] = fs.readFileSync(packagePath, 'utf-8');
    }
    // Also check subdirectories for monorepos
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (['node_modules', 'vendor', '.git', 'dist', 'build'].includes(entry.name))
                continue;
            const subComposer = path.join(dir, entry.name, 'composer.json');
            if (fs.existsSync(subComposer)) {
                files[`${entry.name}/composer.json`] = fs.readFileSync(subComposer, 'utf-8');
            }
            const subPackage = path.join(dir, entry.name, 'package.json');
            if (fs.existsSync(subPackage)) {
                files[`${entry.name}/package.json`] = fs.readFileSync(subPackage, 'utf-8');
            }
        }
    }
    catch {
        // ignore
    }
    if (Object.keys(files).length === 0)
        return false;
    await api.post(`/projects/${projectId}/tech-stack/parse`, { files });
    return true;
}
export function registerBootstrapCommands(program) {
    program
        .command('bootstrap')
        .description('Analyze project structure and output context for AI agent to create memo8 artifacts')
        .option('--commits <n>', 'Number of git commits to analyze', '250')
        .option('--max-files <n>', 'Max files to read content from', '15')
        .option('--skip-index', 'Skip codebase indexing (faster)')
        .action(async (opts) => {
        try {
            const projectId = getProjectId();
            if (!projectId) {
                warn('No project specified. Run: memo8 init');
                return;
            }
            const baseDir = process.cwd();
            const commitCount = parseInt(opts.commits, 10) || 250;
            const maxFiles = parseInt(opts.maxFiles, 10) || MAX_FILES_TO_READ;
            // Phase 1: Stack scan
            const scanSpinner = ora('Scanning tech stack...').start();
            try {
                const scanned = await runStackScan(projectId, baseDir);
                scanSpinner.stop();
                if (scanned) {
                    success('Tech stack parsed.');
                }
                else {
                    info('No dependency files found, skipping stack scan.');
                }
            }
            catch {
                scanSpinner.stop();
                warn('Stack scan failed (continuing without it).');
            }
            // Phase 2: Codebase index (optional, can be slow)
            if (!opts.skipIndex) {
                info('Codebase indexing skipped in bootstrap. Run separately: memo8 codebase index');
            }
            // Phase 3: Collect data
            const dataSpinner = ora('Collecting project data...').start();
            const ig = loadIgnore(baseDir);
            // File tree
            const fileTree = walkDirectoryForTree(baseDir, ig, baseDir);
            // Git log
            const gitLog = getGitLog(baseDir, commitCount);
            // Most changed files
            const mostChanged = getMostChangedFiles(baseDir, 20);
            // Entry points
            const entryPoints = findEntryPoints(baseDir, ig);
            dataSpinner.stop();
            // Phase 4: Read file contents
            const readSpinner = ora('Reading key files...').start();
            // Combine entry points + most changed, deduplicate, limit
            const filesToRead = new Set();
            for (const ep of entryPoints) {
                if (filesToRead.size >= maxFiles)
                    break;
                filesToRead.add(ep);
            }
            for (const mc of mostChanged) {
                if (filesToRead.size >= maxFiles)
                    break;
                const fullPath = path.join(baseDir, mc);
                if (fs.existsSync(fullPath)) {
                    filesToRead.add(mc);
                }
            }
            const fileContents = [];
            for (const file of filesToRead) {
                const fullPath = path.join(baseDir, file);
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                    fileContents.push({
                        path: file,
                        content: readFileTruncated(fullPath, MAX_FILE_LINES),
                    });
                }
            }
            readSpinner.stop();
            // Phase 5: Build markdown output
            const sections = [];
            // Header
            sections.push(`# Project Bootstrap Data\n\nGenerated by \`memo8 bootstrap\` on ${new Date().toISOString().split('T')[0]}`);
            // File structure
            const dirCount = fileTree.filter(f => f.endsWith('/')).length;
            const fileCount = fileTree.filter(f => !f.endsWith('/')).length;
            sections.push(`## File Structure (${fileCount} files, ${dirCount} directories)\n\n` +
                '```\n' + fileTree.join('\n') + '\n```');
            // Git history
            if (gitLog) {
                const logLines = gitLog.split('\n');
                sections.push(`## Git History (last ${logLines.length} commits)\n\n` +
                    '```\n' + gitLog + '\n```');
            }
            // Most changed files
            if (mostChanged.length > 0) {
                sections.push(`## Most Changed Files (by commit frequency)\n\n` +
                    mostChanged.map((f, i) => `${i + 1}. ${f}`).join('\n'));
            }
            // File contents
            if (fileContents.length > 0) {
                const fileBlocks = fileContents.map(f => {
                    const ext = path.extname(f.path).slice(1) || 'text';
                    return `### ${f.path}\n\n\`\`\`${ext}\n${f.content}\n\`\`\``;
                });
                sections.push(`## Key File Contents (${fileContents.length} files)\n\n` +
                    fileBlocks.join('\n\n'));
            }
            // Instructions for AI agent
            sections.push(`## Instructions for AI Agent

Analyze ALL data above thoroughly. Your goal is to create a comprehensive knowledge base so that any AI agent (including yourself in the future) can understand this project WITHOUT reading any source code. Be exhaustive — the more context you capture now, the less time is wasted later.

**IMPORTANT**: All artifact titles, descriptions, content, and code examples MUST be written in English. AI agents perform best when working with English-language knowledge bases, regardless of the developer's native language.

**IMPORTANT**: After creating tags, use \`memo8 tag list\` to get their IDs. Use these IDs (not names) in the \`--tags\` flag for all subsequent commands.

---

### Step 1: Create Tags

Create tags for every major domain and concern in the project. Use \`memo8 tag create\` for each.

\`\`\`bash
memo8 tag create --name "<domain>" --color "#hex" --description "<what this covers>"
\`\`\`

**What to create tags for:**
- Each layer: backend, frontend, database, cli, devops/infrastructure
- Each major domain: auth, tasks, users, billing, notifications, etc.
- Cross-cutting concerns: testing, performance, security, api-design
- Technology-specific: the main framework names (e.g., laravel, nextjs, react, etc.)

After creating all tags, run \`memo8 tag list\` to get their IDs for use in subsequent commands.

---

### Step 2: Create Conventions

Analyze source code patterns and create conventions. Use \`memo8 convention add\` for each.

\`\`\`bash
memo8 convention add --title "<pattern>" --category <naming|architecture|testing|formatting|error_handling|api_response|database|other> --description "<rule>" --code-example "<good>" --anti-pattern "<bad>"
\`\`\`

**Analyze and document these areas:**

**Naming conventions:**
- Variable/function naming style (camelCase, snake_case, PascalCase — per language)
- File naming patterns (kebab-case components, PascalCase classes, etc.)
- Database column naming (snake_case? camelCase?)
- API field naming in requests/responses
- Component naming (prefix patterns, suffix patterns)

**Architecture conventions:**
- Directory structure pattern (where controllers go, where services go, etc.)
- Data access pattern (repository, direct ORM, service layer?)
- API response format (wrapper structure, pagination format, error format)
- Frontend state management pattern (how data flows)
- Component organization (smart/dumb, container/presentational, feature-based?)
- Route registration patterns (order, grouping, middleware)

**Code style conventions:**
- Import ordering
- Error handling patterns (try/catch, Result types, error boundaries?)
- Async patterns (async/await, promises, callbacks?)
- Type definition patterns (interfaces vs types, where defined)

---

### Step 3: Create Memories

This is the most important step. Create detailed memories for every architectural insight. Use \`memo8 memory add\` for each.

\`\`\`bash
memo8 memory add --title "<insight>" --content "<detailed explanation>" --type <note|code_snippet|documentation|idea> --tags "<tag_ids>" --code-flow "Class.method(),Service.method(),Repository.method()"
\`\`\`

**Document ALL of the following (create separate memories for each):**

**Project architecture & structure:**
- Overall architecture (monolith, microservices, monorepo, etc.) — which services exist, how they communicate
- Directory structure explanation: what goes where and why
- How the application boots/starts (entry points, initialization chain)
- Environment setup: ports, env vars, Docker config, external services needed

**API & routes:**
- Complete API endpoint map: list ALL route groups with their prefixes, middleware, and controllers
- Authentication flow: how auth works end-to-end (login → token → middleware → protected route)
- API versioning strategy
- Middleware stack: what middleware is applied where
- Rate limiting, throttling, CORS config
- Use --code-flow to trace request lifecycle: Router → Middleware → Controller → Service → Repository → Response

**Database & models:**
- List all models with their key relationships (belongsTo, hasMany, etc.)
- Important database columns that aren't obvious (JSON columns, enums, computed fields)
- Migration strategy (how migrations are organized, seeder patterns)
- Database-specific features in use (extensions, indexes, full-text search, vector search, etc.)

**Frontend architecture:**
- Routing setup (file-based routing? config-based? nested routes?)
- State management: global store structure, how API data is fetched and cached
- Styling approach: CSS framework, module system, theme system, design tokens
- Component hierarchy: layouts → pages → sections → components
- Auth on frontend: token storage, route guards, SSR auth handling
- Key libraries and what they're used for (UI library, form handling, date utils, etc.)

**Authentication & authorization:**
- Full auth flow with --code-flow
- User roles and permissions (what roles exist, what each can do)
- How auth tokens are stored, refreshed, and validated
- Protected route patterns (frontend and backend)

**Third-party integrations:**
- Payment/billing integration details (provider, webhook handling, subscription model)
- Email/notification services
- AI/ML service integrations (API keys, rate limits, models used)
- File storage, CDN, caching services

**DevOps & infrastructure:**
- How to start the development environment
- Docker setup: services, ports, volumes, networking
- CI/CD pipeline (if visible in config files)
- Queue/job processing setup
- Caching strategy

**Gotchas & pitfalls:**
- Non-obvious configuration requirements
- Port conflicts or unusual port assignments
- Order-dependent operations (e.g., routes that must be registered before others)
- Known quirks of the framework version in use
- Environment-specific behaviors (dev vs prod differences)
- Common errors and their fixes

---

### Step 4: Create Decisions

Document every architectural choice visible in the codebase. Use \`memo8 decision add\` for each.

\`\`\`bash
memo8 decision add --quick --title "<choice>" --decision "<what was decided>" --context "<why, based on code/git evidence>" --status accepted --tags "<tag_ids>"
\`\`\`

**Document these decisions:**
- Main language(s) and framework(s) choice
- Database choice and why (especially non-default features like pgvector, PostGIS, etc.)
- Frontend framework and rendering strategy (SSR, SSG, CSR, ISR)
- CSS/styling approach (Tailwind, CSS Modules, SCSS, styled-components, etc.)
- State management choice (Redux, Zustand, Context, React Query, etc.)
- Authentication strategy (JWT, sessions, OAuth, Sanctum, etc.)
- API design style (REST, GraphQL, tRPC)
- Monorepo vs polyrepo structure
- Package manager choice
- Testing strategy (unit framework, E2E framework, test organization)
- Any library that was chosen over alternatives (ORM, HTTP client, validation, etc.)

---

### Step 5: Create Snippets

Extract reusable code patterns. Use \`memo8 snippet add\` for each.

\`\`\`bash
memo8 snippet add --title "<pattern>" --language <lang> --code "<actual code pattern>" --description "<when and how to use this>" --tags "<tag_ids>"
\`\`\`



### Step 6: Index your codebase

Index your codebase to make it searchable and retrievable. 

\`\`\`bash
memo8 codebase index
\`\`\`


**Extract patterns for:**
- API endpoint definition boilerplate
- Database query/model patterns
- Frontend component boilerplate (with proper imports, types, exports)
- API call/service patterns from frontend
- Form handling patterns
- Error handling patterns
- Test file boilerplate
- Authentication/authorization check patterns
- Any recurring code structure that appears 2+ times

---

### Quality Guidelines

1. **Be specific, not generic.** Bad: "Uses PostgreSQL". Good: "PostgreSQL 14 with pgvector extension on port 5433, accessed via Eloquent ORM, migrations in api/database/migrations/"
2. **Include file paths.** Always reference specific files and directories.
3. **Use --code-flow liberally.** Whenever there's a multi-step process (request handling, auth flow, data pipeline), trace it with --code-flow.
4. **Content should be actionable.** A developer reading this memory should be able to act on it without opening the source code.
5. **Tag everything.** Every artifact should have at least one tag.
6. **Don't skip edge cases.** Gotchas and non-obvious behaviors are the most valuable memories.
7. **Aim for completeness over brevity.** Create 30-50+ memories if the project warrants it. More context = less wasted time later.`);
            // Output
            console.log(sections.join('\n\n---\n\n'));
            console.error('');
            info(`Output: ${sections.join('\n\n---\n\n').split('\n').length} lines of structured project data.`);
            info('Pipe this to your AI agent or copy to clipboard:');
            console.error(chalk.cyan('  memo8 bootstrap | pbcopy'));
            console.error(chalk.cyan('  memo8 bootstrap > bootstrap-data.md'));
        }
        catch (err) {
            handleError(err);
        }
    });
}
//# sourceMappingURL=bootstrap.js.map