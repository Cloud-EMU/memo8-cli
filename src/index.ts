import { Command } from 'commander';
import {createRequire} from 'module';
import {registerAuthCommands} from './commands/auth.js';
import {registerTeamCommands} from './commands/team.js';
import {registerInitCommand} from './commands/init.js';
import {registerProjectCommands} from './commands/project.js';
import {registerTaskCommands} from './commands/task.js';
import {registerMemoryCommands} from './commands/memory.js';
import {registerTagCommands} from './commands/tag.js';
import {registerPlanCommands} from './commands/plan.js';
import {registerStackCommands} from './commands/stack.js';
import {registerCodebaseCommands} from './commands/codebase.js';
import {registerConventionCommands} from './commands/convention.js';
import {registerDecisionCommands} from './commands/decision.js';
import {registerSnippetCommands} from './commands/snippet.js';
import {registerTestPatternCommands} from './commands/testPattern.js';
import {registerCheckpointCommands} from './commands/checkpoint.js';
import {registerContextCommands} from './commands/context.js';
import {registerBootstrapCommands} from './commands/bootstrap.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

export function createProgram(): Command {
  const program = new Command();

  program
    .name('memo8')
    .description('memo8 CLI - AI-powered developer productivity tool')
      .version(packageJson.version, '-v, --version', 'Output the current version');

  registerAuthCommands(program);
  registerTeamCommands(program);
  registerInitCommand(program);
  registerProjectCommands(program);
  registerTaskCommands(program);
  registerMemoryCommands(program);
  registerTagCommands(program);
  registerPlanCommands(program);
  registerStackCommands(program);
  registerCodebaseCommands(program);
  registerConventionCommands(program);
  registerDecisionCommands(program);
  registerSnippetCommands(program);
  registerTestPatternCommands(program);
  registerCheckpointCommands(program);
  registerContextCommands(program);
  registerBootstrapCommands(program);

  return program;
}
