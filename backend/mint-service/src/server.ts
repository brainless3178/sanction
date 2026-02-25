import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { DatabaseClient, createChildLogger } from '@sss/shared';
import { registerMintRoutes } from './routes/mint';
import { registerHealthRoutes } from './routes/health';

const log = createChildLogger({ module: 'mint-service' });

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/sss_token';

async function buildServer() {
    const fastify = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info',
        },
    });

    // Register plugins
    await fastify.register(cors, {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    });

    await fastify.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    });

    // Initialize database client
    const db = new DatabaseClient(DATABASE_URL);

    // Decorate fastify with db client for route access
    fastify.decorate('db', db);

    // Register routes
    registerHealthRoutes(fastify);
    registerMintRoutes(fastify, db);

    // Graceful shutdown
    const shutdown = async () => {
        log.info('Shutting down mint-service...');
        await db.close();
        await fastify.close();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    return fastify;
}

async function main() {
    const server = await buildServer();

    try {
        await server.listen({ port: PORT, host: HOST });
        log.info({ port: PORT, host: HOST }, 'Mint service listening');
    } catch (err) {
        log.fatal({ err }, 'Failed to start mint service');
        process.exit(1);
    }
}

main();
