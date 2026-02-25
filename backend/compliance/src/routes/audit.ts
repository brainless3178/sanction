import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DatabaseClient, createChildLogger } from '@sss/shared';
import { AuditExporter } from '../services/audit-export';

const log = createChildLogger({ module: 'routes/audit' });

const AuditQuerySchema = z.object({
    mintAddress: z.string().min(32).max(64),
    eventType: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.string().optional(),
    offset: z.string().optional(),
    format: z.enum(['json', 'csv']).optional(),
});

export function registerAuditRoutes(fastify: FastifyInstance, db: DatabaseClient) {
    const exporter = new AuditExporter(db);

    /**
     * GET /api/audit?mintAddress=<addr>&format=json|csv
     * Export audit trail for a mint address.
     * Supports JSON (programmatic) and CSV (regulators) formats.
     */
    fastify.get('/api/audit', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = AuditQuerySchema.safeParse(request.query);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.issues });
        }

        const { mintAddress, eventType, from, to, limit, offset, format } = parseResult.data;

        try {
            const fromDate = from ? new Date(from) : undefined;
            const toDate = to ? new Date(to) : undefined;
            const limitNum = limit ? parseInt(limit, 10) : 100;
            const offsetNum = offset ? parseInt(offset, 10) : 0;

            if (format === 'csv') {
                const csv = await exporter.exportCSV(mintAddress, eventType, fromDate, toDate, limitNum, offsetNum);
                return reply
                    .header('Content-Type', 'text/csv')
                    .header('Content-Disposition', `attachment; filename="audit_${mintAddress}_${Date.now()}.csv"`)
                    .send(csv);
            }

            // Default: JSON
            const result = await exporter.exportJSON(mintAddress, eventType, fromDate, toDate, limitNum, offsetNum);
            return reply.send(result);
        } catch (err: any) {
            log.error({ err, mintAddress }, 'Failed to export audit trail');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
}
