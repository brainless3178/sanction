import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DatabaseClient, createChildLogger } from '@sss/shared';
import { SanctionsScreening } from '../screening/integration';

const log = createChildLogger({ module: 'routes/blacklist' });

const BlacklistAddSchema = z.object({
    mintAddress: z.string().min(32).max(64),
    address: z.string().min(32).max(64),
    reason: z.string().min(1).max(128),
    addedBy: z.string().min(32).max(64),
    txSignature: z.string().min(64).max(128),
});

const BlacklistRemoveSchema = z.object({
    mintAddress: z.string().min(32).max(64),
    address: z.string().min(32).max(64),
    removedTx: z.string().min(64).max(128),
});

const BlacklistQuerySchema = z.object({
    mintAddress: z.string().min(32).max(64),
});

const BlacklistCheckSchema = z.object({
    mintAddress: z.string().min(32).max(64),
    address: z.string().min(32).max(64),
});

export function registerBlacklistRoutes(fastify: FastifyInstance, db: DatabaseClient) {
    const screening = new SanctionsScreening();

    /**
     * POST /api/blacklist/add
     * Sync an on-chain blacklist addition to the local DB.
     * Mirrors on-chain state for faster lookups and audit trail.
     */
    fastify.post('/api/blacklist/add', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = BlacklistAddSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.issues });
        }

        const { mintAddress, address, reason, addedBy, txSignature } = parseResult.data;

        try {
            const record = await db.addToBlacklist(
                mintAddress,
                address,
                reason,
                addedBy,
                txSignature,
                new Date()
            );

            log.info({ mintAddress, address, reason }, 'Address added to blacklist (DB sync)');

            return reply.status(201).send({
                status: 'added',
                record: {
                    id: record.id,
                    address: record.address,
                    reason: record.reason,
                    addedBy: record.added_by,
                    txSignature: record.tx_signature,
                    addedAt: record.added_at,
                },
            });
        } catch (err: any) {
            log.error({ err, address }, 'Failed to add to blacklist');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * POST /api/blacklist/remove
     * Sync an on-chain blacklist removal to the local DB.
     */
    fastify.post('/api/blacklist/remove', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = BlacklistRemoveSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.issues });
        }

        const { mintAddress, address, removedTx } = parseResult.data;

        try {
            await db.removeFromBlacklist(mintAddress, address, removedTx);
            log.info({ mintAddress, address }, 'Address removed from blacklist (DB sync)');

            return reply.send({ status: 'removed', address, removedTx });
        } catch (err: any) {
            log.error({ err, address }, 'Failed to remove from blacklist');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/blacklist?mintAddress=<addr>
     * List all currently blacklisted addresses for a mint.
     */
    fastify.get('/api/blacklist', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = BlacklistQuerySchema.safeParse(request.query);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.issues });
        }

        const { mintAddress } = parseResult.data;

        try {
            const records = await db.getBlacklistedAddresses(mintAddress);
            return reply.send({
                mintAddress,
                count: records.length,
                data: records.map((r) => ({
                    address: r.address,
                    reason: r.reason,
                    addedBy: r.added_by,
                    txSignature: r.tx_signature,
                    addedAt: r.added_at,
                })),
            });
        } catch (err: any) {
            log.error({ err }, 'Failed to fetch blacklist');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/blacklist/check?mintAddress=<addr>&address=<addr>
     * Check if a specific address is blacklisted.
     */
    fastify.get('/api/blacklist/check', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = BlacklistCheckSchema.safeParse(request.query);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.issues });
        }

        const { mintAddress, address } = parseResult.data;

        try {
            const isBlacklisted = await db.isAddressBlacklisted(mintAddress, address);
            return reply.send({ mintAddress, address, isBlacklisted });
        } catch (err: any) {
            log.error({ err }, 'Failed to check blacklist status');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * POST /api/blacklist/screen
     * Screen an address against external sanctions lists (OFAC, etc.)
     * Uses the SanctionsScreening integration point.
     */
    fastify.post('/api/blacklist/screen', async (request: FastifyRequest, reply: FastifyReply) => {
        const schema = z.object({ address: z.string().min(32).max(64) });
        const parseResult = schema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.issues });
        }

        const { address } = parseResult.data;

        try {
            const result = await screening.checkAddress(address);
            return reply.send(result);
        } catch (err: any) {
            log.error({ err, address }, 'Sanctions screening failed');
            return reply.status(500).send({ error: 'Screening service unavailable' });
        }
    });
}
