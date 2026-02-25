import { FastifyInstance } from 'fastify';

export function registerHealthRoutes(fastify: FastifyInstance) {
    fastify.get('/health', async (_request, _reply) => {
        return { status: 'ok', service: 'mint-service', timestamp: new Date().toISOString() };
    });
}
