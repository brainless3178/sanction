import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { DatabaseClient, createChildLogger } from '@sss/shared';
import { registerBlacklistRoutes } from './routes/blacklist';
import { registerAuditRoutes } from './routes/audit';

const log = createChildLogger({ module: 'compliance-service' });

const PORT = parseInt(process.env.PORT || '3002', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/sss_token';

async function buildServer() {
    const fastify = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info',
        },
    });

    await fastify.register(cors, {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    });

    await fastify.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    });

    const db = new DatabaseClient(DATABASE_URL);

    // Health check
    fastify.get('/health', async () => {
        return { status: 'ok', service: 'compliance-service', timestamp: new Date().toISOString() };
    });

    // Register route modules
    registerBlacklistRoutes(fastify, db);
    registerAuditRoutes(fastify, db);

    // Graceful shutdown
    const shutdown = async () => {
        log.info('Shutting down compliance-service...');
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
        log.info({ port: PORT, host: HOST }, 'Compliance service listening');
    } catch (err) {
        log.fatal({ err }, 'Failed to start compliance service');
        process.exit(1);
    }
}

main();
