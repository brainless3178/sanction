import { DatabaseClient, createChildLogger } from '@sss/shared';

const log = createChildLogger({ module: 'quota-guard' });

export interface QuotaCheckResult {
    allowed: boolean;
    reason?: string;
    remaining?: string;
}

/**
 * QuotaGuard — validates mint requests against per-minter quota limits
 * BEFORE submitting RPC payloads. This prevents wasted gas on
 * transactions that would fail on-chain due to quota enforcement.
 */
export class QuotaGuard {
    // In-memory quota tracking per mint address (resets periodically)
    private quotaUsage: Map<string, { total: bigint; periodStart: number }> = new Map();

    // Default quota limit per 24h period (configurable via env)
    private readonly defaultQuotaLimit: bigint;
    private readonly quotaPeriodMs: number;

    constructor(private readonly db: DatabaseClient) {
        this.defaultQuotaLimit = BigInt(process.env.QUOTA_LIMIT || '1000000000000'); // 1M tokens (6 decimals)
        this.quotaPeriodMs = 24 * 60 * 60 * 1000; // 24 hours
    }

    async checkQuota(mintAddress: string, amount: string): Promise<QuotaCheckResult> {
        const amountBig = BigInt(amount);

        if (amountBig <= 0n) {
            return { allowed: false, reason: 'Amount must be greater than zero' };
        }

        const now = Date.now();
        let usage = this.quotaUsage.get(mintAddress);

        // Reset if period has elapsed
        if (!usage || (now - usage.periodStart) > this.quotaPeriodMs) {
            usage = { total: 0n, periodStart: now };
            this.quotaUsage.set(mintAddress, usage);
        }

        const projectedTotal = usage.total + amountBig;

        if (projectedTotal > this.defaultQuotaLimit) {
            const remaining = this.defaultQuotaLimit - usage.total;
            log.warn(
                { mintAddress, requested: amount, remaining: remaining.toString() },
                'Quota exceeded — declining mint request before RPC submission'
            );
            return {
                allowed: false,
                reason: `Quota limit exceeded. Remaining: ${remaining.toString()}`,
                remaining: remaining.toString(),
            };
        }

        // Reserve the amount
        usage.total = projectedTotal;
        log.debug(
            { mintAddress, amount, totalUsed: usage.total.toString() },
            'Quota check passed'
        );

        return { allowed: true, remaining: (this.defaultQuotaLimit - projectedTotal).toString() };
    }

    /**
     * Release quota if a mint request fails (so it doesn't permanently
     * consume the budget on reverted transactions).
     */
    releaseQuota(mintAddress: string, amount: string): void {
        const usage = this.quotaUsage.get(mintAddress);
        if (usage) {
            const amountBig = BigInt(amount);
            usage.total = usage.total > amountBig ? usage.total - amountBig : 0n;
        }
    }
}
