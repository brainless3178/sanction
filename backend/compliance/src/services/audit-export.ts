import { DatabaseClient, EventRecord, createChildLogger } from '@sss/shared';

const log = createChildLogger({ module: 'audit-export' });

export interface AuditExportJSON {
    export_generated_at: string;
    mint_address: string;
    period: { from: string | null; to: string | null };
    total_events: number;
    events: AuditEventJSON[];
}

export interface AuditEventJSON {
    id: string;
    type: string;
    timestamp: string;
    tx_signature: string;
    data: Record<string, any>;
}

// Exports audit trail in JSON (programmatic) or CSV (regulators) format.
export class AuditExporter {
    constructor(private readonly db: DatabaseClient) { }


    async exportJSON(
        mintAddress: string,
        eventType?: string,
        from?: Date,
        to?: Date,
        limit: number = 100,
        offset: number = 0,
    ): Promise<AuditExportJSON> {
        log.info({ mintAddress, eventType, from, to, limit, offset }, 'Exporting audit trail (JSON)');

        const events = await this.fetchEvents(mintAddress, eventType, from, to, limit, offset);

        return {
            export_generated_at: new Date().toISOString(),
            mint_address: mintAddress,
            period: {
                from: from ? from.toISOString() : null,
                to: to ? to.toISOString() : null,
            },
            total_events: events.length,
            events: events.map((e) => ({
                id: e.id,
                type: e.event_type,
                timestamp: e.block_time ? e.block_time.toISOString() : e.created_at.toISOString(),
                tx_signature: e.tx_signature,
                data: typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload,
            })),
        };
    }

    // CSV columns: timestamp, event_type, target_address, executed_by, tx_signature, reason
    async exportCSV(
        mintAddress: string,
        eventType?: string,
        from?: Date,
        to?: Date,
        limit: number = 1000,
        offset: number = 0,
    ): Promise<string> {
        log.info({ mintAddress, eventType, from, to, limit, offset }, 'Exporting audit trail (CSV)');

        const events = await this.fetchEvents(mintAddress, eventType, from, to, limit, offset);

        const header = 'timestamp,event_type,target_address,executed_by,tx_signature,reason';
        const rows = events.map((e) => {
            const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
            const timestamp = e.block_time ? e.block_time.toISOString() : e.created_at.toISOString();
            const targetAddress = payload.target || payload.target_address || payload.recipient || '';
            const executedBy = payload.by || payload.added_by || payload.minter || payload.seizer || '';
            const reason = payload.reason || '';
            const txSig = e.tx_signature;

            // Escape CSV fields that may contain commas or quotes
            return [
                timestamp,
                e.event_type,
                this.escapeCsv(targetAddress),
                this.escapeCsv(executedBy),
                txSig,
                this.escapeCsv(reason),
            ].join(',');
        });

        return [header, ...rows].join('\n');
    }


    private async fetchEvents(
        mintAddress: string,
        eventType?: string,
        from?: Date,
        to?: Date,
        limit: number = 100,
        offset: number = 0,
    ): Promise<EventRecord[]> {
        // Use the base getEvents method; for date filtering, we'll do a custom query
        if (from || to) {
            return this.fetchEventsWithDateRange(mintAddress, eventType, from, to, limit, offset);
        }
        return this.db.getEvents(mintAddress, eventType, limit, offset);
    }


    private async fetchEventsWithDateRange(
        mintAddress: string,
        eventType?: string,
        from?: Date,
        to?: Date,
        limit: number = 100,
        offset: number = 0,
    ): Promise<EventRecord[]> {
        let query = 'SELECT * FROM events WHERE mint_address = $1';
        const params: any[] = [mintAddress];
        let paramIdx = 2;

        if (eventType) {
            query += ` AND event_type = $${paramIdx}`;
            params.push(eventType);
            paramIdx++;
        }

        if (from) {
            query += ` AND (block_time >= $${paramIdx} OR created_at >= $${paramIdx})`;
            params.push(from);
            paramIdx++;
        }

        if (to) {
            query += ` AND (block_time <= $${paramIdx} OR created_at <= $${paramIdx})`;
            params.push(to);
            paramIdx++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
        params.push(limit, offset);

        const result = await this.db.query(query, params);
        return result.rows;
    }


    private escapeCsv(value: string): string {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
