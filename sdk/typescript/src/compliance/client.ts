import { Connection, PublicKey, Keypair, TransactionSignature } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getBlacklistPda, getConfigPda, getRolePda, SSS_TOKEN_PROGRAM_ID } from "../accounts";
import { BlacklistEntry, RoleType } from "../types";

export class ComplianceClient {
    constructor(
        private readonly connection: Connection,
        private readonly program: Program<any>,
        public readonly mint: PublicKey,
    ) { }

    async blacklistAdd(
        address: PublicKey,
        reason: string,
        authority: Keypair,
    ): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mint, this.program.programId);
        const [blacklistPda] = getBlacklistPda(this.mint, address, this.program.programId);
        const [blacklisterRolePda] = getRolePda(this.mint, authority.publicKey, RoleType.Blacklister, this.program.programId);

        const builder: any = this.program.methods.addToBlacklist(reason);
        return await builder.accounts({
            blacklister: authority.publicKey,
            config: configPda,
            blacklisterRole: blacklisterRolePda,
            blacklistEntry: blacklistPda,
            targetAccount: address,
            mint: this.mint,
            systemProgram: PublicKey.default, // Let Anchor resolve SystemProgram, or pass it implicitly
        })
            .signers([authority])
            .rpc();
    }

    async blacklistRemove(
        address: PublicKey,
        authority: Keypair,
    ): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mint, this.program.programId);
        const [blacklistPda] = getBlacklistPda(this.mint, address, this.program.programId);
        const [blacklisterRolePda] = getRolePda(this.mint, authority.publicKey, RoleType.Blacklister, this.program.programId);

        const builder: any = this.program.methods.removeFromBlacklist();
        return await builder.accounts({
            blacklister: authority.publicKey,
            config: configPda,
            blacklisterRole: blacklisterRolePda,
            blacklistEntry: blacklistPda,
            targetAccount: address,
            mint: this.mint,
        })
            .signers([authority])
            .rpc();
    }

    async isBlacklisted(address: PublicKey): Promise<boolean> {
        const [pda] = getBlacklistPda(this.mint, address, this.program.programId);
        const info = await this.connection.getAccountInfo(pda);
        return info !== null && info.lamports > 0;
    }

    async getBlacklist(): Promise<BlacklistEntry[]> {
        const accountInterface: any = this.program.account;
        const accounts = await accountInterface.blacklistEntry.all([
            {
                memcmp: {
                    offset: 8, // Discriminator offset
                    bytes: this.mint.toBase58(),
                }
            }
        ]);

        return accounts.map((acc: any) => ({
            mint: acc.account.mint,
            target: acc.account.target,
            reason: acc.account.reason,
            addedBy: acc.account.addedBy,
            addedAt: BigInt(acc.account.addedAt.toString()),
            bump: acc.account.bump,
        }));
    }

    async seize(
        source: PublicKey,
        destination: PublicKey,
        authority: Keypair,
        amount?: bigint | null,
    ): Promise<TransactionSignature> {
        const amountBn = amount ? new BN(amount.toString()) : null;

        const [configPda] = getConfigPda(this.mint, this.program.programId);
        const [seizerRolePda] = getRolePda(this.mint, authority.publicKey, RoleType.Seizer, this.program.programId);

        const sourceAta = getAssociatedTokenAddressSync(
            this.mint,
            source,
            true,
            TOKEN_2022_PROGRAM_ID
        );

        const destAta = getAssociatedTokenAddressSync(
            this.mint,
            destination,
            true,
            TOKEN_2022_PROGRAM_ID
        );

        const builder: any = this.program.methods.seize(amountBn);
        return await builder.accounts({
            seizer: authority.publicKey,
            config: configPda,
            seizerRole: seizerRolePda,
            mint: this.mint,
            sourceAta,
            destinationAta: destAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
            .signers([authority])
            .rpc();
    }
}
