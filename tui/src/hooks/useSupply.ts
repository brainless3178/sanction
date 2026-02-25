import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';

export interface SupplyData {
    circulating: string;
    totalMinted: string;
    totalBurned: string;
}

const PROGRAM_ID = process.env.PROGRAM_ID || '';

// Polls on-chain token supply + config PDA for totalMinted/totalBurned.
export function useSupply(connection: Connection, mintAddress: string, intervalMs: number = 3000): SupplyData {
    const [supply, setSupply] = useState<SupplyData>({
        circulating: '0',
        totalMinted: '0',
        totalBurned: '0',
    });

    const fetchSupply = useCallback(async () => {
        if (!mintAddress) return;

        try {
            const mint = new PublicKey(mintAddress);
            const supplyInfo = await connection.getTokenSupply(mint);
            const circulating = supplyInfo.value.uiAmountString || '0';

            let totalMinted = circulating;
            let totalBurned = '0';

            // Read totalMinted and totalBurned from the config PDA
            if (PROGRAM_ID) {
                const programId = new PublicKey(PROGRAM_ID);
                const [configPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('config'), mint.toBuffer()],
                    programId
                );

                const accountInfo = await connection.getAccountInfo(configPda);
                if (accountInfo && accountInfo.data.length > 100) {
                    const data = accountInfo.data;
                    // Parse StablecoinConfig: skip past discriminator + authority + mint + name + symbol + uri + flags
                    // to reach totalMinted and totalBurned u64 fields
                    const decimals = Number(supplyInfo.value.decimals);
                    const divisor = 10n ** BigInt(decimals);

                    // Scan for the u64 fields after the config flags
                    const offset = 8 + 32 + 32 + 32 + 4 + 32 + 4 + 10 + 4 + 200 + 1 + 1;
                    if (data.length > offset + 16) {
                        const minted = data.readBigUInt64LE(offset);
                        const burned = data.readBigUInt64LE(offset + 8);
                        totalMinted = (minted / divisor).toString();
                        totalBurned = (burned / divisor).toString();
                    }
                }
            }

            setSupply({ circulating, totalMinted, totalBurned });
        } catch {
            // Will retry on next interval
        }
    }, [connection, mintAddress]);

    useEffect(() => {
        fetchSupply();
        const id = setInterval(fetchSupply, intervalMs);
        return () => clearInterval(id);
    }, [fetchSupply, intervalMs]);

    return supply;
}
