import { useState, useEffect } from 'react';
import { Connection, PublicKey, Logs } from '@solana/web3.js';

export interface EventEntry {
    time: string;
    type: string;
    detail: string;
}

// WebSocket subscription to program logs. Parses event names from log lines.
export function useEvents(connection: Connection, programId: string, maxEvents: number = 20): EventEntry[] {
    const [events, setEvents] = useState<EventEntry[]>([]);

    useEffect(() => {
        let subId: number | null = null;

        try {
            const pubkey = new PublicKey(programId);
            subId = connection.onLogs(
                pubkey,
                (logInfo: Logs) => {
                    if (logInfo.err) return;

                    const eventType = parseEventType(logInfo.logs);
                    if (!eventType) return;

                    const now = new Date();
                    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

                    setEvents((prev) => {
                        const newEntry: EventEntry = {
                            time,
                            type: eventType,
                            detail: logInfo.signature.slice(0, 8) + '...',
                        };
                        return [newEntry, ...prev].slice(0, maxEvents);
                    });
                },
                'confirmed'
            );
        } catch {
            // Connection may not support WebSocket
        }

        return () => {
            if (subId !== null) {
                connection.removeOnLogsListener(subId).catch(() => { });
            }
        };
    }, [connection, programId, maxEvents]);

    return events;
}

function parseEventType(logs: string[]): string | null {
    for (const line of logs) {
        if (line.includes('TokensMinted')) return 'MINT';
        if (line.includes('TokensBurned')) return 'BURN';
        if (line.includes('AccountFrozen')) return 'FREEZE';
        if (line.includes('AccountThawed')) return 'THAW';
        if (line.includes('AddedToBlacklist')) return 'BLACKLIST';
        if (line.includes('RemovedFromBlacklist')) return 'UNBLACKLIST';
        if (line.includes('FundsSeized')) return 'SEIZE';
        if (line.includes('GlobalPauseSet')) return 'PAUSE';
        if (line.includes('RoleAssigned')) return 'ROLE+';
        if (line.includes('RoleRevoked')) return 'ROLE-';
    }
    return null;
}
