import { FastifyRequest, FastifyReply } from 'fastify';
import { createChildLogger } from '@sss/shared';

const log = createChildLogger({ module: 'auth-middleware' });

const API_KEY_HEADER = 'x-api-key';

// Validates X-API-Key header against API_KEY env var.
// Bypassed if API_KEY is unset (dev mode). Extend for JWT/mTLS as needed.
export async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> {
    const apiKey = request.headers[API_KEY_HEADER] as string | undefined;
    const expectedKey = process.env.API_KEY;

    // Skip auth in development if no key is configured
    if (!expectedKey) {
        log.warn('No API_KEY configured — auth middleware bypassed (dev only)');
        return;
    }

    if (!apiKey) {
        log.warn({ ip: request.ip }, 'Missing API key in request');
        return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Missing X-API-Key header',
        });
    }

    if (apiKey !== expectedKey) {
        log.warn({ ip: request.ip }, 'Invalid API key');
        return reply.status(403).send({
            error: 'Forbidden',
            message: 'Invalid API key',
        });
    }
}
