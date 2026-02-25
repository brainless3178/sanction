import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DatabaseClient, createChildLogger } from '@sss/shared';
import { QuotaGuard } from '../services/quota-guard';
import { MintLifecycle } from '../services/mint-lifecycle';

const log = createChildLogger({ module: 'routes/mint' });

// Zod validation for incoming mint requests
const MintRequestBodySchema = z.object({
    mintAddress: z.string().min(32).max(64),
    recipient: z.string().min(32).max(64),
    amount: z.string().regex(/^\d+$/, 'Amount must be a numeric string'),
});

const MintStatusParamsSchema = z.object({
    id: z.string().uuid(),
});

export function registerMintRoutes(fastify: FastifyInstance, db: DatabaseClient) {
    const quotaGuard = new QuotaGuard(db);
    const mintLifecycle = new MintLifecycle(db);

    /**
     * POST /api/mint
     * Create a new mint request.
     * Flow: pending → verified → executed | failed
     */
    fastify.post('/api/mint', async (request, reply) => {
        const parseResult = MintRequestBodySchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: parseResult.error.issues,
            });
        }

        const { mintAddress, recipient, amount } = parseResult.data;

        try {
            // Step 1: Check quota guard before accepting
            const quotaCheck = await quotaGuard.checkQuota(mintAddress, amount);
            if (!quotaCheck.allowed) {
                return reply.status(429).send({
                    error: 'Quota exceeded',
                    message: quotaCheck.reason,
                    remainingQuota: quotaCheck.remaining,
                });
            }

            // Step 2: Create pending request in DB
            const mintRequest = await db.createMintRequest(mintAddress, recipient, amount);
            log.info({ requestId: mintRequest.id, recipient, amount }, 'Mint request created');

            // Step 3: Execute the full mint lifecycle asynchronously (fire-and-forget)
            // The lifecycle updates the DB status at each stage; client polls GET /api/mint/:id
            mintLifecycle.execute(mintRequest.id, mintAddress, recipient, amount).catch((err) => {
                log.error({ err, requestId: mintRequest.id }, 'Mint lifecycle execution failed');
            });

            return reply.status(202).send({
                id: mintRequest.id,
                status: 'pending',
                message: 'Mint request accepted and processing',
            });
        } catch (err: any) {
            log.error({ err, mintAddress, recipient, amount }, 'Failed to create mint request');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/mint/:id
     * Get the status of a mint request.
     */
    fastify.get('/api/mint/:id', async (request, reply) => {
        const params = MintStatusParamsSchema.safeParse(request.params);

        if (!params.success) {
            return reply.status(400).send({
                error: 'Invalid request ID',
                details: params.error.issues,
            });
        }

        const mintRequest = await db.getMintRequest(params.data.id);

        if (!mintRequest) {
            return reply.status(404).send({ error: 'Mint request not found' });
        }

        return reply.send({
            id: mintRequest.id,
            mintAddress: mintRequest.mint_address,
            recipient: mintRequest.recipient,
            amount: mintRequest.amount,
            status: mintRequest.status,
            txSignature: mintRequest.tx_signature,
            createdAt: mintRequest.created_at,
            updatedAt: mintRequest.updated_at,
        });
    });

    /**
     * GET /api/mint
     * List recent mint requests (with optional status filter).
     */
    fastify.get('/api/mint', async (request, reply) => {
        const query = request.query as { status?: string };
        const status = query.status;

        let requests;
        if (status) {
            requests = await db.getMintRequestsByStatus(status);
        } else {
            // Return latest 50 across all statuses
            requests = await db.getMintRequestsByStatus('executed');
        }

        return reply.send({
            data: requests.map((r) => ({
                id: r.id,
                mintAddress: r.mint_address,
                recipient: r.recipient,
                amount: r.amount,
                status: r.status,
                txSignature: r.tx_signature,
                createdAt: r.created_at,
            })),
            count: requests.length,
        });
    });
}
