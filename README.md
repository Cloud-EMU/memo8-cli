# memo8 CLI

AI-powered developer productivity tool. memo8 acts as a "second brain" for your projects, managing tasks, memories, conventions, decisions, code snippets, and more.

## Installation

```bash
npm install -g @memo8/cli
```

## Getting Started

```bash
# Login or create an account
memo8 login
memo8 register

# Link current directory to a project
memo8 init

# Check status
memo8 status
```

## Commands

### Auth
```bash
memo8 login                         # Interactive login
memo8 register                      # Create account
memo8 logout                        # Logout
memo8 status                        # Show auth status
```

### Projects
```bash
memo8 init                          # Link current dir to a project
memo8 project list                  # List projects
memo8 project create                # Create project (interactive)
memo8 project show <id>             # Show project details
memo8 project update <id>           # Update project
memo8 project delete <id>           # Delete project
memo8 project stats                 # Project statistics
```

### Tasks
```bash
memo8 task list                     # List tasks
memo8 task create                   # Create task
memo8 task show <id>                # Show task details
memo8 task update <id>              # Update task
memo8 task delete <id>              # Delete task
memo8 task start <id>               # Set status: in_progress
memo8 task stop <id>                # Set status: pending
memo8 task done <id>                # Set status: completed
memo8 task sub <parentId>           # Create subtask
memo8 task stats                    # Task statistics
```

### Memories
```bash
memo8 memory list                   # List memories
memo8 memory add                    # Add memory (interactive)
memo8 memory add --title "T" --content "C" --code-flow "A.method(),B.method()"
memo8 memory show <id>              # Show memory details
memo8 memory update <id>            # Update memory
memo8 memory update <id> --code-flow "X.method(),Y.method()"
memo8 memory delete <id>            # Delete memory
memo8 memory search <query>         # Search memories
memo8 memory link <id> --task <id>  # Link memory to task
memo8 memory stats                  # Memory statistics
```

### Tags
```bash
memo8 tag list                      # List tags
memo8 tag create                    # Create tag
memo8 tag show <id>                 # Show tag details
memo8 tag update <id>               # Update tag
memo8 tag delete <id>               # Delete tag
memo8 tag with-counts               # Tags with usage counts
```

### AI Plans
```bash
memo8 plan create                   # Create AI-generated project plan
memo8 plan list                     # List plans
memo8 plan show <id>                # Show plan details
memo8 plan usage                    # Show daily AI plan usage
```

### Tech Stack
```bash
memo8 stack scan                    # Parse local dependency files
memo8 stack show                    # Show current tech stack
memo8 stack note <packageName>      # Add a dependency note
memo8 stack context                 # Get AI-ready stack summary
```

### Codebase Indexing
```bash
memo8 codebase index                # Index current directory
memo8 codebase search <query>       # Search indexed files
memo8 codebase status               # Show indexing progress
memo8 codebase symbols [name]       # Search code symbols
memo8 codebase clear                # Clear index
```

### Conventions
```bash
memo8 convention list               # List conventions (--category)
memo8 convention add                # Add convention (interactive)
memo8 convention show <id>          # Show convention details
memo8 convention detect             # Auto-detect via AI
memo8 convention check <file>       # Validate file against conventions
```

### Decisions
```bash
memo8 decision list                 # List decisions (--status)
memo8 decision add                  # Add decision (interactive or --quick)
memo8 decision show <id>            # Show decision details
memo8 decision search <query>       # Search decisions
memo8 decision supersede <id>       # Mark as superseded
```

### Snippets
```bash
memo8 snippet list                  # List snippets
memo8 snippet add                   # Add snippet (interactive)
memo8 snippet show <id>             # Show snippet details
memo8 snippet search <query>        # Search snippets
memo8 snippet copy <id>             # Output code to stdout
```

### Test Patterns
```bash
memo8 test-pattern list             # List test patterns
memo8 test-pattern add              # Add test pattern (interactive)
memo8 test-pattern show <id>        # Show test pattern details
memo8 test-pattern detect           # Auto-detect via AI
memo8 test-pattern generate <taskId> # Generate test for task
```

### Checkpoints
```bash
memo8 checkpoint create             # Create checkpoint (--name, --task)
memo8 checkpoint list               # List checkpoints
memo8 checkpoint show <id>          # Show checkpoint details
memo8 checkpoint diff <id>          # Show git diff commands
memo8 checkpoint rollback <id>      # Get rollback instructions
```

### Bootstrap
```bash
memo8 bootstrap                     # Analyze project, output context for AI agent
memo8 bootstrap --commits 100       # Limit git history depth
memo8 bootstrap --max-files 20      # Read more file contents
memo8 bootstrap --skip-index        # Skip codebase indexing
memo8 bootstrap > bootstrap.md      # Save to file
memo8 bootstrap | pbcopy            # Copy to clipboard
```

#### Onboarding an Existing Project

When you have an existing codebase and want to set up memo8's knowledge base, use `bootstrap` to let your AI agent analyze the project and create all artifacts automatically.

**Prerequisites:** `memo8 login` and `memo8 init` must be done first.

**Option A — Let your AI agent do everything (recommended):**

Tell your AI agent (Cursor, Claude Code, Codex, etc.):

> Run `memo8 bootstrap`, read the full output, and follow the "Instructions for AI Agent" section to create all memo8 artifacts.

The agent will run the command, analyze your project structure, git history, and key files, then create tags, conventions, memories, decisions, and snippets automatically.

**Option B — Save to file first:**

```bash
memo8 bootstrap > bootstrap-data.md
```

Then tell your AI agent:

> Read `bootstrap-data.md` and follow the "Instructions for AI Agent" section to create all memo8 artifacts.

**What gets created:**
- **Tags** for each major domain (backend, frontend, database, auth, etc.)
- **Conventions** from detected code patterns (naming, architecture, API format)
- **Memories** for architecture, routes, models, auth flow, gotchas, integrations
- **Decisions** for technology and pattern choices visible in the codebase
- **Snippets** for reusable code patterns

Typically produces 30-80+ artifacts depending on project complexity.

### AI Context
```bash
memo8 context                       # Get full project context
memo8 context --task <id>           # Context for a specific task
memo8 context --topic "query"       # Context for a topic
memo8 context --copy                # Show clipboard instructions
memo8 context:cursor                # Generate Cursor rules file
memo8 context:update-claude-md      # Update Claude Code context file
```

## AI Tool Integration

memo8 generates project context files for AI coding assistants (Cursor, Claude Code, Codex, etc.). This gives your AI tool direct access to your project's conventions, decisions, tech stack, dependency graph, and codebase knowledge.

Template files with full workflow instructions are in `cli/ai-rules/`:
- `cursor-rules.md` — For Cursor IDE
- `CLAUDE.md` — For Claude Code

### Cursor

**Dynamic generation** (recommended — pulls live data from memo8 API):

```bash
memo8 context:cursor
```

Creates `.cursor/rules/memo8.mdc` with MDC frontmatter (`alwaysApply: true`). Cursor automatically injects this into every chat. Re-run after updating conventions or decisions to keep it fresh.

**Manual setup** (for projects without API access):

1. Copy `cli/ai-rules/cursor-rules.md` content
2. In Cursor: Settings > General > Rules for AI > paste
3. Or save as `.cursor/rules/memo8.mdc` in your project root (add MDC frontmatter)

### Claude Code

**Dynamic generation** (recommended):

```bash
memo8 context:update-claude-md
```

Creates or updates `.claude/CLAUDE.md`. Uses `<!-- memo8-context-start -->` / `<!-- memo8-context-end -->` markers to safely update only the memo8 section — your own CLAUDE.md content is preserved. Claude Code auto-loads this file at the start of every conversation.

**Manual setup**:

1. Copy `cli/ai-rules/CLAUDE.md` to your project root as `CLAUDE.md` or `.claude/CLAUDE.md`
2. The template includes the full development workflow — the AI will know to run `memo8 convention list`, `memo8 decision search`, etc. before making changes

### Other AI Tools (Codex, Windsurf, etc.)

For any AI tool that accepts a system prompt or context injection:

```bash
# Print full project context to stdout
memo8 context

# Get task-specific context (includes affected files, dependencies)
memo8 context --task <id>

# Get topic-specific context
memo8 context --topic "authentication"

# Copy to clipboard (macOS)
memo8 context | pbcopy

# Save to a custom file
memo8 context > .ai-context.md
```

### What the AI Gets

The generated context includes:
- **Project overview**: Name, description, status
- **Tech stack**: Frameworks, dependencies, versions, package notes
- **Active conventions**: Coding rules with approved/anti-pattern code examples
- **Recent decisions**: Architectural choices with rejected alternatives and reasoning
- **Task context** (when `--task` is used): Description, affected files, dependency chain, linked memories
- **Codebase summary**: Indexed file types, symbol counts, language breakdown

## Development

```bash
# Run in development mode (uses tsx)
npm run dev -- <command>

# Build
npm run build

# Run built version
node dist/bin/memo8.js <command>
```

## Configuration

- **Global config**: `~/.memo8/config.json` (API URL, auth token)
- **Local config**: `.memo8.json` in project root (project ID)


## All Tasks

Completed non-interactive flags across all 15 command files:                                                                                                                             
┌───────────────────────┬──────────────────────────────────────────────────────────────────────────────┐
│        Command        │                                  New Flags                                   │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ login                 │ --email, --password                                                          │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ register              │ --name, --email, --password                                                  │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ init                  │ --project <id>                                                               │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ project create        │ --name, --description, --status                                              │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ project update        │ --name, --description, --status                                              │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ project delete        │ -f, --force                                                                  │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ task update           │ --title, --description, --status, --priority                                 │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ task delete           │ -f, --force                                                                  │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ task sub              │ --title, --description, --priority, --status                                 │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ memory add            │ --code-flow                                                                  │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ memory update         │ --title, --content, --type, --code-flow                                      │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ memory delete         │ -f, --force                                                                  │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ tag update            │ --name, --color, --description                                               │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ tag delete            │ -f, --force                                                                  │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ stack note            │ --note                                                                       │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ decision add          │ --title, --decision, --context, --status, --tags                             │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ decision supersede    │ --new-decision-id                                                            │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ checkpoint rollback   │ -y, --yes                                                                    │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ codebase clear        │ -f, --force                                                                  │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ test-pattern add      │ --pattern-name, --test-type, --description, --template-code, --applicable-to │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ test-pattern generate │ --stdout                                                                     │
├───────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ plan create           │ --prompt, --auto-approve                                                     │
└───────────────────────┴──────────────────────────────────────────────────────────────────────────────┘
