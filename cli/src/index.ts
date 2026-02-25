#!/usr/bin/env node
import { Command } from 'commander';
import { registerInitCommand } from './commands/init';
import { registerOperationsCommands } from './commands/operations';
import { registerBlacklistCommands } from './commands/blacklist';
import { registerMintersCommands } from './commands/minters';

const program = new Command();
program
    .name('sss')
    .description('Solana Stablecoin Standard CLI')
    .version('1.0.0')
    .option('-j, --json', 'Output in JSON format');

registerInitCommand(program);
registerOperationsCommands(program);
registerBlacklistCommands(program);
registerMintersCommands(program);

program.parse(process.argv);
