import { createChildLogger } from '@sss/shared';

const log = createChildLogger({ module: 'rate-limit' });

// @fastify/rate-limit config. Override via RATE_LIMIT_MAX / RATE_LIMIT_WINDOW env vars.
// For distributed rate limiting, swap in a Redis-backed store.
export const rateLimitConfig = {
    global: true,
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    errorResponseBuilder: (_request: any, context: any) => {
        log.warn({ retryAfter: context.after }, 'Rate limit exceeded');
        return {
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Retry after ${context.after}`,
            retryAfter: context.after,
        };
    },
};
