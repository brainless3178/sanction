import { createChildLogger } from '@sss/shared';


const log = createChildLogger({ module: 'parser' });

// Supported event types matching the Rust program's emit!() calls
const KNOWN_EVENT_TYPES = [
    'StablecoinInitialized',
    'TokensMinted',
    'TokensBurned',
    'AccountFrozen',
    'AccountThawed',
    'GlobalPauseSet',
    'RoleAssigned',
    'RoleRevoked',
    'AddedToBlacklist',
    'RemovedFromBlacklist',
    'FundsSeized',
    'AuthorityTransferInitiated',
    'AuthorityTransferCompleted',
];

export interface ParsedEvent {
    eventType: string;
    mintAddress: string;
    payload: Record<string, any>;
    txSignature: string;
}

// Extracts Anchor events from "Program data: <base64>" log lines.
export function parseTransactionLogs(logs: string[], txSignature: string): ParsedEvent[] {
    const events: ParsedEvent[] = [];

    for (const line of logs) {
        // Anchor emits events as "Program data: <base64>"
        if (!line.includes('Program data:')) continue;

        try {
            const dataMatch = line.match(/Program data: (.+)/);
            if (!dataMatch) continue;

            const base64Data = dataMatch[1];
            const buffer = Buffer.from(base64Data, 'base64');

            // Read the 8-byte event discriminator (SHA256 of "event:<EventName>")
            const discriminator = buffer.slice(0, 8);

            // Try to identify event type from the data structure
            const parsedEvent = attemptEventParse(buffer, txSignature);
            if (parsedEvent) {
                events.push(parsedEvent);
            }
        } catch (err) {
            log.debug({ err, line }, 'Failed to parse log line');
        }
    }

    return events;
}

// Decodes event discriminator + mint pubkey from raw Borsh buffer.
function attemptEventParse(buffer: Buffer, txSignature: string): ParsedEvent | null {
    try {
        const offset = 8; // skip 8-byte discriminator

        // All our events have `mint: Pubkey` as the first field (32 bytes)
        if (buffer.length < offset + 32) return null;

        const mintBytes = buffer.slice(offset, offset + 32);
        const mintAddress = encodeBase58(mintBytes);

        // Build a generic payload from the remaining data
        const payload: Record<string, any> = {
            raw: buffer.toString('base64'),
            mintAddress,
        };

        // Try to identify event type based on buffer size and structure
        const eventType = identifyEventType(buffer);

        if (eventType) {
            log.debug({ eventType, txSignature }, 'Successfully parsed event');
            return {
                eventType,
                mintAddress,
                payload,
                txSignature,
            };
        }

        // Unknown event type but still has valid structure
        return {
            eventType: 'Unknown',
            mintAddress,
            payload,
            txSignature,
        };
    } catch (err) {
        log.debug({ err }, 'Event parse attempt failed');
        return null;
    }
}

/**
 * Simple base58 encoding for public key bytes.
 */
function encodeBase58(bytes: Buffer): string {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt('0x' + bytes.toString('hex'));
    let result = '';
    while (num > 0n) {
        const remainder = num % 58n;
        num = num / 58n;
        result = ALPHABET[Number(remainder)] + result;
    }
    // Handle leading zeros
    for (const byte of bytes) {
        if (byte === 0) result = '1' + result;
        else break;
    }
    return result || '1';
}

/**
 * Identify event type by comparing the 8-byte discriminator
 * against precomputed SHA256("event:<EventName>") hashes.
 */
function identifyEventType(buffer: Buffer): string | null {
    const discriminator = buffer.slice(0, 8).toString('hex');
    return EVENT_DISCRIMINATORS[discriminator] || null;
}

/**
 * Precomputed discriminator map.
 * Key: first 8 bytes of SHA256("event:<EventName>") as hex
 * Value: event name string
 *
 * Generated via: crypto.createHash('sha256').update('event:EventName').digest().slice(0,8).toString('hex')
 */
const EVENT_DISCRIMINATORS: Record<string, string> = (() => {
    const crypto = require('crypto');
    const map: Record<string, string> = {};
    for (const eventName of KNOWN_EVENT_TYPES) {
        const hash = crypto.createHash('sha256').update(`event:${eventName}`).digest();
        const key = hash.slice(0, 8).toString('hex');
        map[key] = eventName;
    }
    return map;
})();
