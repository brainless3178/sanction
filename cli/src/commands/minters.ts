import { Command } from 'commander';
import { loadContext } from '../helpers';
import { startSpinner, success, error } from '../output';
import { PublicKey } from '@solana/web3.js';

export function registerMintersCommands(program: Command) {
    program
        .command('minter-add')
        .description('Grant minter role to an address')
        .requiredOption('-t, --target <string>', 'Minter address')
        .requiredOption('-q, --quota <number>', 'Quota for the minter')
        .action(async (options) => {
            const { authority, sss, isJson } = await loadContext(program);
            const spinner = startSpinner('Granting minter role...');
            try {
                const target = new PublicKey(options.target);
                const quota = BigInt(options.quota);
                const tx = await sss.updateMinter(target, quota, authority);
                spinner.succeed('Minter role granted');
                success(`Transaction Signature: ${tx}`, isJson, { signature: tx });
            } catch (err: any) {
                spinner.fail('Adding minter failed');
                error(err.message, isJson);
            }
        });

    program
        .command('minter-revoke')
        .description('Revoke minter role from an address')
        .requiredOption('-t, --target <string>', 'Minter address')
        .action(async (options) => {
            const { authority, sss, isJson } = await loadContext(program);
            const spinner = startSpinner('Revoking minter role...');
            try {
                const target = new PublicKey(options.target);
                const tx = await sss.revokeMinter(target, authority);
                spinner.succeed('Minter role revoked');
                success(`Transaction Signature: ${tx}`, isJson, { signature: tx });
            } catch (err: any) {
                spinner.fail('Revoking minter failed');
                error(err.message, isJson);
            }
        });
}
