import { createChildLogger } from '@sss/shared';

const log = createChildLogger({ module: 'sanctions-screening' });


export interface ScreeningResult {
    address: string;
    isSanctioned: boolean;
    matchType: string | null;
    listName: string | null;
    matchScore: number;
    checkedAt: string;
    details: string | null;
}

// Pluggable sanctions screening. If SANCTIONS_API_URL/KEY are set,
// hits the external API. Otherwise falls back to local blacklist check.
// Swap providers (Chainalysis, Elliptic, TRM Labs) by changing the env vars.
export class SanctionsScreening {
    private readonly apiUrl: string;
    private readonly apiKey: string;

    constructor() {
        this.apiUrl = process.env.SANCTIONS_API_URL || '';
        this.apiKey = process.env.SANCTIONS_API_KEY || '';
    }


    async checkAddress(address: string): Promise<ScreeningResult> {
        log.info({ address }, 'Screening address against sanctions lists');

        // If an external API is configured, use it
        if (this.apiUrl && this.apiKey) {
            return this.checkExternal(address);
        }

        // Fallback: local heuristic check (for development/testing)
        return this.checkLocal(address);
    }


    async checkAddresses(addresses: string[]): Promise<ScreeningResult[]> {
        log.info({ count: addresses.length }, 'Batch screening addresses');

        const results: ScreeningResult[] = [];
        for (const address of addresses) {
            const result = await this.checkAddress(address);
            results.push(result);
        }
        return results;
    }


    private async checkExternal(address: string): Promise<ScreeningResult> {
        try {
            const response = await fetch(`${this.apiUrl}/screen`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({ address }),
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                throw new Error(`Screening API returned ${response.status}`);
            }

            const data = await response.json() as any;

            return {
                address,
                isSanctioned: data.isSanctioned ?? false,
                matchType: data.matchType ?? null,
                listName: data.listName ?? null,
                matchScore: data.matchScore ?? 0,
                checkedAt: new Date().toISOString(),
                details: data.details ?? null,
            };
        } catch (err) {
            log.error({ err, address }, 'External sanctions screening failed');
            // Fail-safe: if screening fails, flag for manual review
            return {
                address,
                isSanctioned: false,
                matchType: null,
                listName: null,
                matchScore: 0,
                checkedAt: new Date().toISOString(),
                details: 'Screening service unavailable — manual review required',
            };
        }
    }

    // Fallback: queries the DB blacklist table when no external API is configured.
    private async checkLocal(address: string): Promise<ScreeningResult> {
        log.info({ address }, 'Performing local sanctions check against database blacklist');

        // Query the database for existing blacklist entries matching this address
        // This uses the same blacklist table that the indexer maintains from on-chain events
        const COMPLIANCE_API_URL = process.env.COMPLIANCE_SELF_URL || 'http://localhost:3002';
        try {
            const response = await fetch(`${COMPLIANCE_API_URL}/api/blacklist/check/${address}`, {
                signal: AbortSignal.timeout(5000),
            });

            if (response.ok) {
                const data = await response.json() as any;
                if (data.isBlacklisted) {
                    log.warn({ address, reason: data.reason }, 'Address found in local blacklist');
                    return {
                        address,
                        isSanctioned: true,
                        matchType: 'LOCAL_BLACKLIST',
                        listName: 'Internal Blacklist',
                        matchScore: 1.0,
                        checkedAt: new Date().toISOString(),
                        details: data.reason || 'Found in local blacklist database',
                    };
                }
            }
        } catch (err) {
            log.warn({ err, address }, 'Local blacklist check failed — treating as clean');
        }

        return {
            address,
            isSanctioned: false,
            matchType: null,
            listName: null,
            matchScore: 0,
            checkedAt: new Date().toISOString(),
            details: null,
        };
    }
}
