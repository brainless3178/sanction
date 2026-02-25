import { loadConfig, getKeypair } from './config';
import { getProvider, getConnection } from './rpc';
import { SolanaStablecoin, SSS_TOKEN_PROGRAM_ID } from '@stbr/sss-token';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';

export function getProgram(provider: AnchorProvider): Program<any> {
    try {
        const idlPath = path.resolve(__dirname, '../../programs/sss-token/target/idl/sss_token.json');
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        return new Program(idl, provider);
    } catch (_e) {
        // Fallback: construct a minimal IDL with the program address embedded
        const minimalIdl: any = {
            address: SSS_TOKEN_PROGRAM_ID.toBase58(),
            metadata: { name: "sss_token", version: "0.1.0", spec: "0.1.0" },
            instructions: [],
        };
        return new Program(minimalIdl, provider);
    }
}

export async function loadContext(program: Command) {
    const config = loadConfig();
    if (!config.mintAddress) throw new Error("Mint address not configured. Run 'sss init' first.");
    const connection = getConnection(config);
    const provider = getProvider(config);
    const authority = getKeypair(config);
    const sssProgram = getProgram(provider);
    const mintPubkey = new PublicKey(config.mintAddress);

    const sss = await SolanaStablecoin.load(connection, provider, sssProgram, mintPubkey);

    return {
        config,
        connection,
        provider,
        authority,
        sss,
        isJson: program.opts().json || false
    };
}
