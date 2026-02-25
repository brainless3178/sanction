import { Command } from 'commander';
import { loadContext } from '../helpers';
import { startSpinner, success, error } from '../output';
import { PublicKey } from '@solana/web3.js';

export function registerBlacklistCommands(program: Command) {
    const checkCompliance = (sss: any) => {
        if (!sss.compliance) throw new Error('Compliance module is not enabled for this stablecoin');
    };

    program
        .command('blacklist-add')
        .description('Add an address to the blacklist')
        .requiredOption('-t, --target <string>', 'Target address')
        .requiredOption('-r, --reason <string>', 'Reason for blacklisting')
        .action(async (options) => {
            const { authority, sss, isJson } = await loadContext(program);
            checkCompliance(sss);
            const spinner = startSpinner('Adding to blacklist...');
            try {
                const target = new PublicKey(options.target);
                const tx = await sss.compliance!.blacklistAdd(target, options.reason, authority);
                spinner.succeed('Added to blacklist');
                success(`Transaction Signature: ${tx}`, isJson, { signature: tx });
            } catch (err: any) {
                spinner.fail('Blacklist addition failed');
                error(err.message, isJson);
            }
        });

    program
        .command('blacklist-remove')
        .description('Remove an address from the blacklist')
        .requiredOption('-t, --target <string>', 'Target address')
        .action(async (options) => {
            const { authority, sss, isJson } = await loadContext(program);
            checkCompliance(sss);
            const spinner = startSpinner('Removing from blacklist...');
            try {
                const target = new PublicKey(options.target);
                const tx = await sss.compliance!.blacklistRemove(target, authority);
                spinner.succeed('Removed from blacklist');
                success(`Transaction Signature: ${tx}`, isJson, { signature: tx });
            } catch (err: any) {
                spinner.fail('Blacklist removal failed');
                error(err.message, isJson);
            }
        });

    program
        .command('seize')
        .description('Seize funds from a target to a destination')
        .requiredOption('-s, --source <string>', 'Source address')
        .requiredOption('-d, --destination <string>', 'Destination address')
        .option('-a, --amount <number>', 'Amount to seize (optional)')
        .action(async (options) => {
            const { authority, sss, isJson } = await loadContext(program);
            checkCompliance(sss);
            const spinner = startSpinner('Seizing funds...');
            try {
                const source = new PublicKey(options.source);
                const dist = new PublicKey(options.destination);
                const amount = options.amount ? BigInt(options.amount) : undefined;
                const tx = await sss.compliance!.seize(source, dist, authority, amount);
                spinner.succeed('Funds seized successfully');
                success(`Transaction Signature: ${tx}`, isJson, { signature: tx });
            } catch (err: any) {
                spinner.fail('Seize failed');
                error(err.message, isJson);
            }
        });
}
