import { Connection, PublicKey } from '@solana/web3.js';
import { DatabaseClient, createChildLogger } from '@sss/shared';
import { EventListener } from './listener';

const log = createChildLogger({ module: 'indexer' });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8899';
const RPC_WS_URL = process.env.RPC_WS_URL || 'ws://127.0.0.1:8900';
const PROGRAM_ID = process.env.PROGRAM_ID || '2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/sss_token';

async function main() {
    log.info('Starting SSS Token Indexer...');

    const db = new DatabaseClient(DATABASE_URL);
    const connection = new Connection(RPC_URL, {
        wsEndpoint: RPC_WS_URL,
        commitment: 'confirmed',
    });
    const programId = new PublicKey(PROGRAM_ID);

    const listener = new EventListener(connection, programId, db);

    // Graceful shutdown
    const shutdown = async () => {
        log.info('Shutting down indexer...');
        await listener.stop();
        await db.close();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    await listener.start();
    log.info('Indexer is running. Listening for on-chain events...');
}

main().catch((err) => {
    log.fatal({ err }, 'Indexer failed to start');
    process.exit(1);
});
