import { Connection } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { CliConfig, getKeypair } from './config';

export function getConnection(config: CliConfig): Connection {
    return new Connection(config.rpcUrl, { commitment: 'confirmed' });
}

export function getProvider(config: CliConfig): AnchorProvider {
    const connection = getConnection(config);
    const keypair = getKeypair(config);
    const wallet = new Wallet(keypair);
    return new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
}
