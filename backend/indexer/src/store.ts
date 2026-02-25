import { DatabaseClient, EventRecord, createChildLogger } from '@sss/shared';
import { ParsedEvent } from './parser';

const log = createChildLogger({ module: 'store' });

// Inserts event into DB and mirrors blacklist changes to the blacklist table.
export async function storeEvent(
    db: DatabaseClient,
    event: ParsedEvent,
    slot: number,
    blockTime?: number,
): Promise<EventRecord> {
    log.info(
        { eventType: event.eventType, mint: event.mintAddress, slot, tx: event.txSignature },
        'Storing event'
    );

    // Use the block timestamp from Solana's getBlock response, fallback to current time
    const eventTime = blockTime ? new Date(blockTime * 1000) : new Date();

    const storedEvent = await db.insertEvent(
        event.mintAddress,
        event.eventType,
        event.payload,
        event.txSignature,
        slot,
        eventTime,
    );

    log.info({ eventId: storedEvent.id, eventType: event.eventType }, 'Event stored successfully');

    // If it's a blacklist event, also mirror to the blacklist table
    if (event.eventType === 'AddedToBlacklist') {
        try {
            await db.addToBlacklist(
                event.mintAddress,
                event.payload.target || '',
                event.payload.reason || '',
                event.payload.by || '',
                event.txSignature,
                new Date()
            );
            log.info({ target: event.payload.target }, 'Blacklist entry mirrored to DB');
        } catch (err) {
            log.error({ err }, 'Failed to mirror blacklist addition');
        }
    }

    if (event.eventType === 'RemovedFromBlacklist') {
        try {
            await db.removeFromBlacklist(
                event.mintAddress,
                event.payload.target || '',
                event.txSignature
            );
            log.info({ target: event.payload.target }, 'Blacklist removal mirrored to DB');
        } catch (err) {
            log.error({ err }, 'Failed to mirror blacklist removal');
        }
    }

    return storedEvent;
}
