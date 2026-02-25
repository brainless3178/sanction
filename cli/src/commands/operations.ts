import { Command } from 'commander';
import { loadContext } from '../helpers';
import { startSpinner, success, error } from '../output';
import { PublicKey } from '@solana/web3.js';

export function registerOperationsCommands(program: Command) {
    program
        .command('mint')
        .description('Mint stablecoins to a destination address')
        .requiredOption('-r, --recipient <string>', 'Recipient address')
        .requiredOption('-a, --amount <number>', 'Amount to mint (in base units)')
        .action(async (options) => {
            const { authority, sss, isJson } = await loadContext(program);
            const spinner = startSpinner('Minting tokens...');
            try {
                const recipient = new PublicKey(options.recipient);
                const amount = BigInt(options.amount);
                const tx = await sss.mint({ recipient, amount, minter: authority });
                spinner.succeed('Minting successful');
                success(`Transaction Signature: ${tx}`, isJson, { signature: tx });
            } catch (err: any) {
                spinner.fail('Minting failed');
                error(err.message, isJson);
            }
        });

    program
        .command('freeze')
        .description('Freeze a token account')
        .requiredOption('-t, --target <string>', 'Target account address')
        .action(async (options) => {
            const { authority, sss, isJson } = await loadContext(program);
            const spinner = startSpinner('Freezing account...');
            try {
                const target = new PublicKey(options.target);
                const tx = await sss.freeze(target, authority);
                spinner.succeed('Account frozen successfully');
                success(`Transaction Signature: ${tx}`, isJson, { signature: tx });
            } catch (err: any) {
                spinner.fail('Freeze failed');
                error(err.message, isJson);
            }
        });

    program
        .command('thaw')
        .description('Thaw a token account')
        .requiredOption('-t, --target <string>', 'Target account address')
        .action(async (options) => {
            const { authority, sss, isJson } = await loadContext(program);
            const spinner = startSpinner('Thawing account...');
            try {
                const target = new PublicKey(options.target);
                const tx = await sss.thaw(target, authority);
                spinner.succeed('Account thawed successfully');
                success(`Transaction Signature: ${tx}`, isJson, { signature: tx });
            } catch (err: any) {
                spinner.fail('Thaw failed');
                error(err.message, isJson);
            }
        });
}
