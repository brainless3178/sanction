import { DatabaseClient, createChildLogger } from '@sss/shared';

const log = createChildLogger({ module: 'blacklist-sync' });

// Diffs on-chain BlacklistEntry PDAs against DB records and reconciles.
// Caller fetches entries via getProgramAccounts, then passes them here.
export class BlacklistSync {
    constructor(private readonly db: DatabaseClient) { }

    // Full sync: adds missing entries to DB, marks stale ones as removed.
    async sync(
        mintAddress: string,
        onChainEntries: Array<{
            address: string;
            reason: string;
            addedBy: string;
            txSignature: string;
            addedAt: Date;
        }>,
    ): Promise<{ added: number; removed: number }> {
        log.info({ mintAddress, onChainCount: onChainEntries.length }, 'Starting blacklist sync');

        const dbEntries = await this.db.getBlacklistedAddresses(mintAddress);
        const dbAddressSet = new Set(dbEntries.map((e) => e.address));
        const onChainAddressSet = new Set(onChainEntries.map((e) => e.address));

        let added = 0;
        let removed = 0;

        // Add entries that are on-chain but not in DB
        for (const entry of onChainEntries) {
            if (!dbAddressSet.has(entry.address)) {
                await this.db.addToBlacklist(
                    mintAddress,
                    entry.address,
                    entry.reason,
                    entry.addedBy,
                    entry.txSignature,
                    entry.addedAt
                );
                added++;
                log.info({ address: entry.address }, 'Synced missing blacklist entry to DB');
            }
        }

        // Mark entries that are in DB but not on-chain as removed
        for (const dbEntry of dbEntries) {
            if (!onChainAddressSet.has(dbEntry.address)) {
                await this.db.removeFromBlacklist(mintAddress, dbEntry.address, 'sync_removal');
                removed++;
                log.info({ address: dbEntry.address }, 'Marked stale DB blacklist entry as removed');
            }
        }

        log.info({ mintAddress, added, removed }, 'Blacklist sync completed');
        return { added, removed };
    }
}
