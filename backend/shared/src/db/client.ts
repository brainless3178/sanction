import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { z } from 'zod';
import { logger } from '../logger';

// ============================================================
// Zod Validation Schemas
// ============================================================

export const MintRequestSchema = z.object({
    id: z.string().uuid(),
    mint_address: z.string(),
    recipient: z.string(),
    amount: z.string(), // NUMERIC comes as string from pg
    status: z.enum(['pending', 'verified', 'executed', 'failed']),
    tx_signature: z.string().nullable(),
    created_at: z.date(),
    updated_at: z.date(),
});
export type MintRequest = z.infer<typeof MintRequestSchema>;

export const EventSchema = z.object({
    id: z.string(),
    mint_address: z.string(),
    event_type: z.string(),
    payload: z.any(),
    tx_signature: z.string(),
    slot: z.string(),
    block_time: z.date().nullable(),
    created_at: z.date(),
});
export type EventRecord = z.infer<typeof EventSchema>;

export const WebhookSchema = z.object({
    id: z.string().uuid(),
    url: z.string().url(),
    event_types: z.array(z.string()),
    secret: z.string(),
    is_active: z.boolean(),
    created_at: z.date(),
});
export type Webhook = z.infer<typeof WebhookSchema>;

export const WebhookDeliverySchema = z.object({
    id: z.string(),
    webhook_id: z.string().uuid(),
    event_id: z.string(),
    attempt_count: z.number(),
    last_attempt_at: z.date().nullable(),
    status: z.enum(['pending', 'delivered', 'failed']),
    response_code: z.number().nullable(),
    created_at: z.date(),
});
export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;

export const BlacklistRecordSchema = z.object({
    id: z.string(),
    mint_address: z.string(),
    address: z.string(),
    reason: z.string(),
    added_by: z.string(),
    tx_signature: z.string(),
    added_at: z.date(),
    removed_at: z.date().nullable(),
    removed_tx: z.string().nullable(),
});
export type BlacklistRecord = z.infer<typeof BlacklistRecordSchema>;

// ============================================================
// Database Client
// ============================================================

export class DatabaseClient {
    private pool: Pool;

    constructor(connectionString?: string) {
        this.pool = new Pool({
            connectionString: connectionString || process.env.DATABASE_URL || 'postgresql://localhost:5432/sss_token',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        this.pool.on('error', (err) => {
            logger.error({ err }, 'Unexpected database pool error');
        });
    }

    async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
        const start = Date.now();
        const result = await this.pool.query<T>(text, params);
        const duration = Date.now() - start;
        logger.debug({ query: text, duration, rows: result.rowCount }, 'DB query executed');
        return result;
    }

    async getClient(): Promise<PoolClient> {
        return this.pool.connect();
    }

    async close(): Promise<void> {
        await this.pool.end();
    }

    // ============================================================
    // Mint Requests
    // ============================================================

    async createMintRequest(mintAddress: string, recipient: string, amount: string): Promise<MintRequest> {
        const result = await this.query(
            `INSERT INTO mint_requests (mint_address, recipient, amount, status)
             VALUES ($1, $2, $3, 'pending')
             RETURNING *`,
            [mintAddress, recipient, amount]
        );
        return MintRequestSchema.parse(result.rows[0]);
    }

    async updateMintRequestStatus(id: string, status: string, txSignature?: string): Promise<MintRequest> {
        const result = await this.query(
            `UPDATE mint_requests
             SET status = $2, tx_signature = $3, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, status, txSignature || null]
        );
        return MintRequestSchema.parse(result.rows[0]);
    }

    async getMintRequest(id: string): Promise<MintRequest | null> {
        const result = await this.query('SELECT * FROM mint_requests WHERE id = $1', [id]);
        if (result.rows.length === 0) return null;
        return MintRequestSchema.parse(result.rows[0]);
    }

    async getMintRequestsByStatus(status: string): Promise<MintRequest[]> {
        const result = await this.query('SELECT * FROM mint_requests WHERE status = $1 ORDER BY created_at DESC', [status]);
        return result.rows.map((r: any) => MintRequestSchema.parse(r));
    }

    // ============================================================
    // Events
    // ============================================================

    async insertEvent(
        mintAddress: string,
        eventType: string,
        payload: any,
        txSignature: string,
        slot: number,
        blockTime?: Date
    ): Promise<EventRecord> {
        const result = await this.query(
            `INSERT INTO events (mint_address, event_type, payload, tx_signature, slot, block_time)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [mintAddress, eventType, JSON.stringify(payload), txSignature, slot, blockTime || null]
        );
        return EventSchema.parse(result.rows[0]);
    }

    async getEvents(mintAddress: string, eventType?: string, limit: number = 50, offset: number = 0): Promise<EventRecord[]> {
        let queryText = 'SELECT * FROM events WHERE mint_address = $1';
        const params: any[] = [mintAddress];

        if (eventType) {
            queryText += ' AND event_type = $2';
            params.push(eventType);
        }

        queryText += ` ORDER BY slot DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await this.query(queryText, params);
        return result.rows.map((r: any) => EventSchema.parse(r));
    }

    async getLastProcessedSlot(): Promise<number> {
        const result = await this.query('SELECT MAX(slot) as max_slot FROM processed_slots');
        return result.rows[0]?.max_slot || 0;
    }

    async markSlotProcessed(slot: number): Promise<void> {
        await this.query(
            'INSERT INTO processed_slots (slot) VALUES ($1) ON CONFLICT (slot) DO NOTHING',
            [slot]
        );
    }

    // ============================================================
    // Webhooks
    // ============================================================

    async createWebhook(url: string, eventTypes: string[], secret: string): Promise<Webhook> {
        const result = await this.query(
            `INSERT INTO webhooks (url, event_types, secret)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [url, eventTypes, secret]
        );
        return WebhookSchema.parse(result.rows[0]);
    }

    async getActiveWebhooksForEvent(eventType: string): Promise<Webhook[]> {
        const result = await this.query(
            `SELECT * FROM webhooks WHERE is_active = true AND $1 = ANY(event_types)`,
            [eventType]
        );
        return result.rows.map((r: any) => WebhookSchema.parse(r));
    }

    async createWebhookDelivery(webhookId: string, eventId: string): Promise<WebhookDelivery> {
        const result = await this.query(
            `INSERT INTO webhook_deliveries (webhook_id, event_id, status)
             VALUES ($1, $2, 'pending')
             RETURNING *`,
            [webhookId, eventId]
        );
        return WebhookDeliverySchema.parse(result.rows[0]);
    }

    async updateWebhookDelivery(id: string, status: string, responseCode?: number): Promise<void> {
        await this.query(
            `UPDATE webhook_deliveries
             SET status = $2, response_code = $3, attempt_count = attempt_count + 1, last_attempt_at = NOW()
             WHERE id = $1`,
            [id, status, responseCode || null]
        );
    }

    async getPendingDeliveries(limit: number = 100): Promise<WebhookDelivery[]> {
        const result = await this.query(
            `SELECT * FROM webhook_deliveries WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1`,
            [limit]
        );
        return result.rows.map((r: any) => WebhookDeliverySchema.parse(r));
    }

    // ============================================================
    // Blacklist
    // ============================================================

    async addToBlacklist(
        mintAddress: string,
        address: string,
        reason: string,
        addedBy: string,
        txSignature: string,
        addedAt: Date
    ): Promise<BlacklistRecord> {
        const result = await this.query(
            `INSERT INTO blacklist (mint_address, address, reason, added_by, tx_signature, added_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [mintAddress, address, reason, addedBy, txSignature, addedAt]
        );
        return BlacklistRecordSchema.parse(result.rows[0]);
    }

    async removeFromBlacklist(mintAddress: string, address: string, removedTx: string): Promise<void> {
        await this.query(
            `UPDATE blacklist
             SET removed_at = NOW(), removed_tx = $3
             WHERE mint_address = $1 AND address = $2 AND removed_at IS NULL`,
            [mintAddress, address, removedTx]
        );
    }

    async getBlacklistedAddresses(mintAddress: string): Promise<BlacklistRecord[]> {
        const result = await this.query(
            `SELECT * FROM blacklist WHERE mint_address = $1 AND removed_at IS NULL ORDER BY added_at DESC`,
            [mintAddress]
        );
        return result.rows.map((r: any) => BlacklistRecordSchema.parse(r));
    }

    async isAddressBlacklisted(mintAddress: string, address: string): Promise<boolean> {
        const result = await this.query(
            `SELECT COUNT(*) as cnt FROM blacklist WHERE mint_address = $1 AND address = $2 AND removed_at IS NULL`,
            [mintAddress, address]
        );
        return parseInt(result.rows[0].cnt) > 0;
    }
}
