import { Command } from 'commander';
import { loadConfig, saveConfig, getKeypair } from '../config';
import { startSpinner, success, error } from '../output';
import { getProvider, getConnection } from '../rpc';
import { SolanaStablecoin, Preset } from '@stbr/sss-token';
import { getProgram } from '../helpers';

export function registerInitCommand(program: Command) {
    program
        .command('init')
        .description('Initialize a new SSS-1 or SSS-2 stablecoin')
        .requiredOption('-n, --name <string>', 'Name of the stablecoin')
        .requiredOption('-s, --symbol <string>', 'Symbol of the stablecoin')
        .requiredOption('-d, --decimals <number>', 'Decimals')
        .option('-u, --uri <string>', 'Metadata URI')
        .option('-p, --preset <preset>', 'SSS_1 or SSS_2')
        .action(async (options) => {
            const isJson = program.opts().json;
            const config = loadConfig();
            const provider = getProvider(config);
            const connection = getConnection(config);
            const authority = getKeypair(config);
            const sssProgram = getProgram(provider);

            const spinner = startSpinner('Initializing stablecoin...');

            try {
                const sss = await SolanaStablecoin.create(connection, provider, sssProgram, {
                    name: options.name,
                    symbol: options.symbol,
                    decimals: Number(options.decimals),
                    uri: options.uri || "",
                    preset: options.preset as Preset,
                    authority: authority
                });

                spinner.succeed('Stablecoin initialized');

                config.mintAddress = sss.mintAddress.toBase58();
                config.preset = options.preset;
                saveConfig(config);

                success(`Successfully initialized new mint: ${sss.mintAddress.toBase58()}`, isJson, { mintAddress: config.mintAddress, preset: config.preset });
            } catch (err: any) {
                spinner.fail('Failed to initialize');
                error(err.message, isJson);
            }
        });
}
