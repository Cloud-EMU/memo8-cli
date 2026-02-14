# ⚠️ MANDATORY WORKFLOW — YOU MUST FOLLOW THESE RULES

These rules are NOT suggestions. They are REQUIRED for every task in this project. Violating them creates knowledge gaps and duplicated work.

## Rule 1: Run memo8 BEFORE Writing Any Code

You MUST run these commands BEFORE reading source files or writing code:

```bash
memo8 context                          # Get project context (or: memo8 context --task <id>)
memo8 memory search "<keywords>"       # Check existing knowledge
memo8 convention list                  # Review coding standards
```

The project has existing conventions, decisions, and past learnings that constrain your work. Skipping this causes you to violate established patterns.

## Rule 2: Track ALL Work with memo8 Tasks

- Create tasks: `memo8 task create --title "..." --description "..."`
- Start work: `memo8 task start <id>`
- Finish work: `memo8 task done <id>`

NEVER use built-in task tools (TaskCreate, TodoWrite, internal todo lists). ALL task management MUST go through the `memo8` CLI.

## Rule 3: Save What You Learn

After completing a task, save insights:

```bash
memo8 memory add --title "..." --content "..." --type note --tags "1,2"
```

Save: gotchas, non-obvious behaviors, architectural insights, debugging fixes, config discoveries.

## Rule 4: Non-Interactive Mode Only

All memo8 create/add commands MUST use CLI flags. Never use interactive prompts.

<!-- memo8-reference-start -->

# memo8 CLI Reference

memo8 is a CLI-based "second brain" for your project. It centralizes tasks, memories, conventions, decisions, code snippets, codebase index, and tech stack — all queryable via `memo8` commands.

## AI Workflow: Task Lifecycle

Follow this workflow for every task. These are not suggestions — they are required steps.

### Phase 1: Before Starting a Task (Research)

When you receive a task (by ID or description), gather context BEFORE writing any code:

```bash
# 1. Understand the task scope
memo8 task show <id>                              # Check affected_files, depends_on, execution_order

# 2. Get full project context for the task
memo8 context --task <id>                         # Conventions, decisions, tech stack — all in one

# 3. Search existing knowledge for related work
memo8 memory search "<relevant keywords>"         # Past learnings, gotchas, insights
memo8 codebase search "<file or module name>"     # Find existing implementations
memo8 snippet search "<pattern name>"             # Reusable code blocks
memo8 decision search "<topic>"                   # Past architectural decisions — respect them

# 4. Check coding standards
memo8 convention list                             # Active conventions — follow code_example, avoid anti_pattern_example

# 5. Mark task as started
memo8 task start <id>
```

**Why**: You may find that the problem was already solved, a convention exists for this exact pattern, or a previous decision constrains your options. Skipping this step leads to duplicated work and inconsistency.

### Phase 2: During Development

While writing code, stay aware of emerging knowledge:

- **If you discover a gotcha or non-obvious behavior** → save it immediately:
  ```bash
  memo8 memory add --title "Gotcha: Next.js params are Promise" --content "In Next.js 15, page params are Promise. Use React.use(params) to unwrap." --type note --tags "1,3"
  # If the code has a call chain worth remembering, add --code-flow:
  memo8 memory add --title "Slug resolution flow" --content "Disease pages resolve via slug service" --code-flow "SlugController.show(),SlugService.resolve(),PageResolver.resolve()"
  ```

- **If you make an architectural choice** (library, pattern, approach) → record it:
  ```bash
  memo8 decision add --quick --title "Use SCSS Modules over Tailwind" --decision "SCSS Modules + CSS custom properties for theming" --context "Tailwind conflicts with Radix UI styling approach" --status accepted --tags "frontend,styling"
  ```

- **If you write a reusable pattern** (helper, hook, service pattern) → save it as snippet:
  ```bash
  memo8 snippet add --title "RTK Query injectEndpoints" --language typescript --code "const api = api.injectEndpoints({ endpoints: (b) => ({ ... }) })" --description "Standard pattern for adding new API endpoints"
  ```

- **If you establish a coding standard** (naming, structure, pattern) → create convention:
  ```bash
  memo8 convention add --title "Repository Pattern for DB" --category architecture --description "All DB access through Repository classes, never direct Eloquent in controllers" --code-example "app(UserRepository::class)->findById(1)" --anti-pattern "User::find(1) in controller"
  ```

- **Before risky changes** → create a checkpoint:
  ```bash
  memo8 checkpoint create --name "Before auth refactor" --task <id>
  ```

### Phase 3: After Completing a Task

When the task is done, record what you learned:

```bash
# 1. Save learnings as memories (ALWAYS do this if you learned something)
memo8 memory add --title "<concise title>" --content "<what you learned, why it matters, how to apply it>" --type note --tags "1,2"

# 2. Link relevant memories to the task
memo8 memory link <memoryId> --task <taskId>

# 3. Mark task as done
memo8 task done <id>
```

**What to save as memory** — ask yourself:
- Did I hit a bug or unexpected behavior? → Save the cause and fix
- Did I find a non-obvious configuration or setup step? → Save it
- Did I learn something about the codebase architecture? → Save it
- Would a future developer (or AI) benefit from knowing this? → Save it
- Did I waste time on something that could have been avoided? → Definitely save it

**Memory quality guidelines**:
- Title: Short, searchable, specific (e.g., "Fix: Docker queue worker not processing jobs" not "Docker issue")
- Content: Include the problem, root cause, and solution. Be specific enough that someone can act on it without further research.
- Type: Use `code_snippet` for code patterns, `note` for learnings, `idea` for future improvements, `documentation` for setup/config
- Tags: Use relevant existing tags (run `memo8 tag list` first). If no fitting tag exists, create one.

### Phase 4: Proactive Knowledge Creation

Beyond the task at hand, create knowledge artifacts when you notice:

| You notice... | Create... | Example |
|---|---|---|
| A pattern used 3+ times | Convention | "All API responses use camelCase keys" |
| A technology choice with trade-offs | Decision | "Redis for queue over database driver" |
| A reusable code block | Snippet | "Laravel FormRequest with custom messages" |
| A non-obvious setup step | Memory (documentation) | "pgvector requires CREATE EXTENSION in migration" |
| An error that took time to debug | Memory (note) | "413 error: Nginx default body size is 1MB" |
| A potential future improvement | Memory (idea) | "Consider WebSocket for real-time board updates" |

### Tag Strategy

Before creating content, check existing tags:
```bash
memo8 tag with-counts
```

Use specific, reusable tags. Good tags describe **what** (backend, frontend, database) or **domain** (auth, tasks, ai-planning). Bad tags are too vague (important, misc) or too specific (fix-bug-123).

If you need a new tag:
```bash
memo8 tag create --name "queue" --color "#f59e0b" --description "Queue workers, jobs, async processing"
```

---

## Tasks

Work items with status, priority, dependencies, file mappings, and execution order.

### Enum Values
- **status**: `pending` | `in_progress` | `completed` | `cancelled`
- **priority**: `low` | `medium` | `high` | `urgent`

### Commands

```bash
# List tasks
memo8 task list [-p <projectId>] [-s <status>] [--priority <priority>] [-q <search>] [--root-only] [--per-page <n>] [--page <n>]

# Create task (non-interactive)
memo8 task create --title "Task title" [--description "desc"] [--priority medium] [--status pending] [--tags "1,2,3"] [-p <projectId>]
# Required: --title
# Defaults: --status pending, --priority medium

# Show task
memo8 task show <id> [-i "project,tags,memories,subtasks,parent"]

# Update task (interactive only)
memo8 task update <id>

# Delete task
memo8 task delete <id>

# Status shortcuts
memo8 task start <id>              # → in_progress
memo8 task stop <id>               # → pending
memo8 task done <id>               # → completed

# Create subtask (interactive)
memo8 task sub <parentId>

# Dependency graph & next available
memo8 task graph                   # Show dependency graph (ASCII)
memo8 task next                    # Show next available tasks

# Statistics
memo8 task stats
```

### Create Example
```bash
memo8 task create --title "Add user profile page" --description "Create /profile route with edit form" --priority high --status pending --tags "1,5"
```

---

## Memories

Insights, gotchas, and learnings with semantic search.

### Enum Values
- **type**: `note` | `code_snippet` | `link` | `idea` | `documentation`

### Commands

```bash
# List memories
memo8 memory list [-p <projectId>] [-t <type>] [-q <search>] [--per-page <n>] [--page <n>]

# Add memory (non-interactive)
memo8 memory add --title "Title" --content "Content text" [--type note] [--tags "1,2"] [--code-flow "A.method(),B.method()"] [-p <projectId>]
# Required: --title, --content
# Defaults: --type note
# --code-flow: comma-separated call chain (stored in metadata.code_flow)

# Show / Update / Delete
memo8 memory show <id> [-i "project,tags,tasks"]
memo8 memory update <id> [--title "..."] [--content "..."] [--type note] [--code-flow "A(),B()"]
memo8 memory delete <id>

# Search
memo8 memory search <query>

# Link/Unlink to task
memo8 memory link <memoryId> --task <taskId>
memo8 memory unlink <memoryId> --task <taskId>

# Statistics
memo8 memory stats
```

### Create Example
```bash
memo8 memory add --title "N+1 Query Fix" --content "Always use eager loading with ->with() in Laravel" --type code_snippet --tags "3"
```

---

## Conventions

Coding standards with approved patterns and anti-patterns.

### Enum Values
- **category**: `naming` | `architecture` | `testing` | `formatting` | `error_handling` | `api_response` | `database` | `other`
- **source**: `manual` | `auto_detected` | `code_review`

### Commands

```bash
# List conventions
memo8 convention list [-c <category>] [--per-page <n>] [--page <n>]

# Add convention (non-interactive)
memo8 convention add --title "Title" --category naming --description "Desc" [--code-example "code"] [--anti-pattern "bad code"]
# Required: --title, --category, --description

# Show / Update / Delete
memo8 convention show <id>
memo8 convention update <id>       # interactive
memo8 convention delete <id>

# AI auto-detect from codebase
memo8 convention detect
```

### Create Example
```bash
memo8 convention add --title "camelCase for TS vars" --category naming --description "Use camelCase for all TypeScript variables and functions" --code-example "const userName = 'test'" --anti-pattern "const user_name = 'test'"
```

---

## Decisions

Architectural decision log with alternatives and consequences.

### Enum Values
- **status**: `proposed` | `accepted` | `deprecated` | `superseded`

### Commands

```bash
# List decisions
memo8 decision list [-s <status>] [--per-page <n>] [--page <n>]

# Add decision (non-interactive with --quick)
memo8 decision add --quick --title "Title" --decision "Decision text" [--context "Why"] [--status accepted] [--tags "tag1,tag2"]
# Required with --quick: --title, --decision
# Defaults: --status proposed

# Show / Search
memo8 decision show <id>
memo8 decision search <query>

# Supersede
memo8 decision supersede <id>      # interactive - creates a new decision that replaces this one
```

### Create Example
```bash
memo8 decision add --quick --title "Use PostgreSQL" --decision "PostgreSQL with pgvector for AI search" --context "Need vector similarity search for semantic memory" --status accepted --tags "database,infrastructure"
```

---

## Snippets

Approved reusable code blocks.

### Commands

```bash
# List snippets
memo8 snippet list [--per-page <n>] [--page <n>]

# Add snippet (non-interactive)
memo8 snippet add --title "Title" --language typescript --code "code here" [--description "desc"] [--tags "tag1,tag2"]
# Required: --title, --language, --code

# Show / Search / Copy
memo8 snippet show <id>
memo8 snippet search <query>
memo8 snippet copy <id>            # Output raw code to stdout

# Update / Delete
memo8 snippet update <id>         # interactive
memo8 snippet delete <id>
```

### Create Example
```bash
memo8 snippet add --title "RTK Query Endpoint" --language typescript --code "api.injectEndpoints({ endpoints: (b) => ({ get: b.query({ query: () => '/path' }) }) })" --description "RTK Query injectEndpoints pattern"
```

---

## Tags

Labels for organizing tasks and memories.

### Commands

```bash
# List tags
memo8 tag list [-q <search>] [--per-page <n>] [--page <n>]

# Create tag (non-interactive)
memo8 tag create --name "tag-name" [--color "#ff5733"] [--description "desc"]
# Required: --name

# Show / Update / Delete
memo8 tag show <id>
memo8 tag update <id>             # interactive
memo8 tag delete <id>

# Tags with usage counts
memo8 tag with-counts
```

### Create Example
```bash
memo8 tag create --name "backend" --color "#3b82f6" --description "Backend related items"
```

---

## Codebase

Indexed file and symbol search across the project.

### Commands

```bash
memo8 codebase index               # Index current directory (respects .gitignore + .memo8ignore)
memo8 codebase search <query>      # Search files by path or content
memo8 codebase status              # Show indexing progress
memo8 codebase symbols [name]      # Search code symbols (classes, functions, methods)
memo8 codebase clear               # Clear the entire index (requires confirmation)
```

---

## Test Patterns

Test templates per type.

### Enum Values
- **test_type**: `unit` | `feature` | `integration` | `e2e`

### Commands

```bash
memo8 test-pattern list [--per-page <n>] [--page <n>]
memo8 test-pattern show <id>
memo8 test-pattern detect          # AI auto-detect from codebase
memo8 test-pattern generate <taskId>  # Generate test skeleton for a task
```

---

## Tech Stack

Parsed dependency snapshot with notes.

### Commands

```bash
memo8 stack scan                   # Parse local package.json/composer.json
memo8 stack show                   # Show current tech stack
memo8 stack note <packageName>     # Add note to a dependency
memo8 stack context                # Get AI-ready stack summary
```

---

## Checkpoints

Git-based rollback points tied to tasks.

### Commands

```bash
# Create checkpoint (non-interactive)
memo8 checkpoint create --name "Before refactor" [--task <taskId>] [--description "desc"]
# Required: --name

# List / Show / Diff / Rollback
memo8 checkpoint list [--per-page <n>] [--page <n>]
memo8 checkpoint show <id>
memo8 checkpoint diff <id>         # Git diff since checkpoint
memo8 checkpoint rollback <id>     # Get rollback instructions
```

### Create Example
```bash
memo8 checkpoint create --name "Pre-auth-refactor" --task 42 --description "Before rewriting auth flow"
```

---

## AI Context

Assembled project context for AI tools.

### Commands

```bash
memo8 context                      # Full project context
memo8 context --task <id>          # Context scoped to a task and its dependencies
memo8 context --topic "query"      # Context filtered by topic (returns relevant conventions, decisions, memories only)
memo8 context --copy               # Print clipboard info
memo8 context:update-claude-md     # Inject live project data into this file
```

---

## AI Plans

AI-generated project plans (3/day limit).

### Commands

```bash
memo8 plan create [-p <projectId>] # Interactive - opens editor for prompt
memo8 plan list [-p <projectId>] [--per-page <n>] [--page <n>]
memo8 plan show <id>
memo8 plan usage                   # Show daily usage (used/remaining)
```

---

## Projects

```bash
memo8 project list [-s <status>] [-q <search>] [--per-page <n>] [--page <n>]
memo8 project show <id> [-i "tasks,memories"] [--with-stats]
memo8 project create               # interactive
memo8 project update <id>          # interactive
memo8 project delete <id>
memo8 project stats
```

## Bootstrap (New Project Onboarding)

When onboarding an existing project to memo8, run:
```bash
memo8 bootstrap
```

This outputs structured project data (file tree, git history, key file contents, most-changed files) with detailed instructions. Read the entire output carefully, then follow the "Instructions for AI Agent" section at the end to create comprehensive memo8 artifacts (tags, conventions, memories, decisions, snippets). The instructions specify exactly what to document: architecture, routes, models, auth flow, frontend structure, integrations, gotchas, and more. Use `--code-flow` on memories to trace call chains. Aim for 30-50+ artifacts for a typical project.

## Setup

```bash
memo8 login                        # Authenticate
memo8 status                       # Check auth status
memo8 init                         # Link current directory to a project (.memo8.json)
```

---

## Quick Reference: Non-Interactive Create Commands

```bash
# Task
memo8 task create --title "..." [--description "..."] [--priority medium] [--status pending] [--tags "1,2"]

# Memory
memo8 memory add --title "..." --content "..." [--type note] [--tags "1,2"] [--code-flow "A(),B(),C()"]

# Tag
memo8 tag create --name "..." [--color "#hex"] [--description "..."]

# Convention
memo8 convention add --title "..." --category naming --description "..."  [--code-example "..."] [--anti-pattern "..."]

# Decision
memo8 decision add --quick --title "..." --decision "..." [--context "..."] [--status proposed] [--tags "t1,t2"]

# Snippet
memo8 snippet add --title "..." --language typescript --code "..." [--description "..."] [--tags "t1,t2"]

# Checkpoint
memo8 checkpoint create --name "..." [--task <id>] [--description "..."]
```
