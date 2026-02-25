import { Connection, Logs, PublicKey } from '@solana/web3.js';
import { createChildLogger } from '@sss/shared';
import { parseTransactionLogs } from './parser';
import { storeEvent } from './store';
import { dispatchWebhooks } from './webhook/dispatcher';
import { DatabaseClient } from '@sss/shared';

const log = createChildLogger({ module: 'listener' });

const RECONNECT_INTERVAL_MS = 5000;

export class EventListener {
    private subscriptionId: number | null = null;
    private isRunning = false;

    constructor(
        private readonly connection: Connection,
        private readonly programId: PublicKey,
        private readonly db: DatabaseClient,
    ) { }

    async start(): Promise<void> {
        this.isRunning = true;
        await this.subscribe();
    }

    async stop(): Promise<void> {
        this.isRunning = false;
        if (this.subscriptionId !== null) {
            try {
                await this.connection.removeOnLogsListener(this.subscriptionId);
                log.info('Unsubscribed from program logs');
            } catch (err) {
                log.warn({ err }, 'Error removing logs listener');
            }
            this.subscriptionId = null;
        }
    }

    private async subscribe(): Promise<void> {
        if (!this.isRunning) return;

        try {
            log.info({ programId: this.programId.toBase58() }, 'Subscribing to program logs via WebSocket');

            this.subscriptionId = this.connection.onLogs(
                this.programId,
                async (logInfo: Logs, ctx) => {
                    try {
                        await this.handleLogs(logInfo, ctx.slot);
                    } catch (err) {
                        log.error({ err, signature: logInfo.signature }, 'Error processing log entry');
                    }
                },
                'confirmed'
            );

            log.info({ subscriptionId: this.subscriptionId }, 'Successfully subscribed to program logs');
        } catch (err) {
            log.error({ err }, `WebSocket subscription failed, retrying in ${RECONNECT_INTERVAL_MS}ms`);
            setTimeout(() => this.subscribe(), RECONNECT_INTERVAL_MS);
        }
    }

    private async handleLogs(logInfo: Logs, slot: number): Promise<void> {
        if (logInfo.err) {
            log.debug({ signature: logInfo.signature, err: logInfo.err }, 'Transaction failed, skipping');
            return;
        }

        // Check if slot was already processed
        const lastSlot = await this.db.getLastProcessedSlot();
        if (slot <= lastSlot) {
            log.debug({ slot }, 'Slot already processed, skipping');
            return;
        }

        const events = parseTransactionLogs(logInfo.logs, logInfo.signature);

        for (const event of events) {
            log.info({ eventType: event.eventType, signature: logInfo.signature, slot }, 'Event detected');

            // Store event in DB
            const storedEvent = await storeEvent(this.db, event, slot);

            // Dispatch webhooks
            await dispatchWebhooks(this.db, storedEvent);
        }

        // Mark slot as processed
        await this.db.markSlotProcessed(slot);
    }
}
