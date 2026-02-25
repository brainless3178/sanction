import { Connection, PublicKey, Keypair, TransactionSignature } from "@solana/web3.js";
import { Program, Provider, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { CreateParams, MintParams, BurnParams, StablecoinConfig, RoleType, MintEvent, FreezeEvent, BlacklistEvent } from "../types";
import { getConfigPda, getRolePda, SSS_TOKEN_PROGRAM_ID } from "../accounts";
import { SssSdkError, SssErrorCode } from "../errors";
import { ComplianceClient } from "../compliance/client";

export class SolanaStablecoin {
    private constructor(
        private readonly connection: Connection,
        private readonly program: Program<any>,
        public readonly mintAddress: PublicKey,
        public readonly config: StablecoinConfig,
        public readonly compliance: ComplianceClient | null,
    ) { }

    static async create(
        connection: Connection,
        provider: Provider,
        program: Program<any>,
        params: CreateParams
    ): Promise<SolanaStablecoin> {
        const mintKeypair = Keypair.generate();

        let enablePermanentDelegate = false;
        let enableTransferHook = false;
        let defaultAccountFrozen = false;

        if (params.preset === 'SSS_1') {
            enablePermanentDelegate = false;
            enableTransferHook = false;
        } else if (params.preset === 'SSS_2') {
            enablePermanentDelegate = true;
            enableTransferHook = true;
        } else if (params.extensions) {
            enablePermanentDelegate = !!params.extensions.permanentDelegate;
            enableTransferHook = !!params.extensions.transferHook;
            defaultAccountFrozen = !!params.extensions.defaultAccountFrozen;
        }

        const [configPda] = getConfigPda(mintKeypair.publicKey, program.programId);

        // Cast to any: Anchor's IDL types are too deep for TS inference
        const methodBuilder: any = program.methods.initialize({
            name: params.name,
            symbol: params.symbol,
            uri: params.uri || "",
            decimals: params.decimals,
            enablePermanentDelegate,
            enableTransferHook,
            defaultAccountFrozen,
        });

        const signature = await methodBuilder.accounts({
            authority: params.authority.publicKey,
            config: configPda,
            mint: mintKeypair.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
            .signers([params.authority, mintKeypair])
            .rpc();

        console.log(`Initialized at signature ${signature}`);

        return SolanaStablecoin.load(connection, provider, program, mintKeypair.publicKey);
    }

    static async load(
        connection: Connection,
        provider: Provider,
        program: Program<any>,
        mintAddress: PublicKey,
    ): Promise<SolanaStablecoin> {
        const [configPda] = getConfigPda(mintAddress, program.programId);

        // Fetch on-chain config and cast into typed struct
        const accountInterface: any = program.account;
        const configData: any = await accountInterface.stablecoinConfig.fetch(configPda);

        const config: StablecoinConfig = {
            mint: configData.mint,
            name: configData.name,
            symbol: configData.symbol,
            uri: configData.uri,
            decimals: configData.decimals,
            enablePermanentDelegate: configData.enablePermanentDelegate,
            enableTransferHook: configData.enableTransferHook,
            defaultAccountFrozen: configData.defaultAccountFrozen,
            isPaused: configData.isPaused,
            totalMinted: BigInt(configData.totalMinted.toString()),
            totalBurned: BigInt(configData.totalBurned.toString()),
            masterAuthority: configData.masterAuthority,
            pendingAuthority: configData.pendingAuthority,
            authorityTransferInitiatedAt: configData.authorityTransferInitiatedAt ? BigInt(configData.authorityTransferInitiatedAt.toString()) : null,
            bump: configData.bump,
        };

        const compliance = config.enableTransferHook
            ? new ComplianceClient(connection, program, mintAddress)
            : null;

        return new SolanaStablecoin(connection, program, mintAddress, config, compliance);
    }

    async mint(params: MintParams): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);
        const [minterRolePda] = getRolePda(this.mintAddress, params.minter.publicKey, RoleType.Minter, this.program.programId);

        const amountBn = new BN(params.amount.toString());

        const builder: any = this.program.methods.mint(amountBn);
        return await builder.accounts({
            minter: params.minter.publicKey,
            config: configPda,
            minterRole: minterRolePda,
            mint: this.mintAddress,
            recipientAta: params.recipient,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
            .signers([params.minter])
            .rpc();
    }

    async burn(params: BurnParams): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);
        const [burnerRolePda] = getRolePda(this.mintAddress, params.burner.publicKey, RoleType.Burner, this.program.programId);

        const amountBn = new BN(params.amount.toString());

        const burnerAta = getAssociatedTokenAddressSync(
            this.mintAddress,
            params.burner.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );

        const builder: any = this.program.methods.burn(amountBn);
        return await builder.accounts({
            burner: params.burner.publicKey,
            config: configPda,
            burnerRole: burnerRolePda,
            mint: this.mintAddress,
            burnerAta: burnerAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
            .signers([params.burner])
            .rpc();
    }

    async freeze(address: PublicKey, authority: Keypair): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);
        const [pauserRolePda] = getRolePda(this.mintAddress, authority.publicKey, RoleType.Pauser, this.program.programId);

        const builder: any = this.program.methods.freeze();
        return await builder.accounts({
            pauser: authority.publicKey,
            config: configPda,
            pauserRole: pauserRolePda,
            mint: this.mintAddress,
            targetAta: address,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
            .signers([authority])
            .rpc();
    }

    async thaw(address: PublicKey, authority: Keypair): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);
        const [pauserRolePda] = getRolePda(this.mintAddress, authority.publicKey, RoleType.Pauser, this.program.programId);

        const builder: any = this.program.methods.thaw();
        return await builder.accounts({
            pauser: authority.publicKey,
            config: configPda,
            pauserRole: pauserRolePda,
            mint: this.mintAddress,
            targetAta: address,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
            .signers([authority])
            .rpc();
    }

    async pause(authority: Keypair): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);

        const builder: any = this.program.methods.setPause(true);
        return await builder.accounts({
            authority: authority.publicKey,
            config: configPda,
            mint: this.mintAddress,
        })
            .signers([authority])
            .rpc();
    }

    async unpause(authority: Keypair): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);

        const builder: any = this.program.methods.setPause(false);
        return await builder.accounts({
            authority: authority.publicKey,
            config: configPda,
            mint: this.mintAddress,
        })
            .signers([authority])
            .rpc();
    }

    async updateMinter(address: PublicKey, quota: bigint, authority: Keypair): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);
        const [rolePda] = getRolePda(this.mintAddress, address, RoleType.Minter, this.program.programId);

        const quotaBn = new BN(quota.toString());

        const builder: any = this.program.methods.assignRole(RoleType.Minter, quotaBn);
        return await builder.accounts({
            masterAuthority: authority.publicKey,
            config: configPda,
            roleAssignment: rolePda,
            targetAccount: address,
            mint: this.mintAddress,
        })
            .signers([authority])
            .rpc();
    }

    async revokeMinter(address: PublicKey, authority: Keypair): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);
        const [rolePda] = getRolePda(this.mintAddress, address, RoleType.Minter, this.program.programId);

        const builder: any = this.program.methods.revokeRole(RoleType.Minter);
        return await builder.accounts({
            masterAuthority: authority.publicKey,
            config: configPda,
            roleAssignment: rolePda,
            targetAccount: address,
            mint: this.mintAddress,
        })
            .signers([authority])
            .rpc();
    }

    onMint(handler: (event: MintEvent) => void): () => void {
        const listenerId = this.program.addEventListener('TokensMinted', (event: any) => {
            if (event.mint.equals(this.mintAddress)) {
                handler({
                    mint: event.mint,
                    recipient: event.recipient,
                    amount: BigInt(event.amount.toString()),
                    minter: event.minter,
                    newSupply: BigInt(event.newSupply.toString()),
                    timestamp: BigInt(event.timestamp.toString())
                });
            }
        });
        return () => {
            this.program.removeEventListener(listenerId);
        };
    }

    onFreeze(handler: (event: FreezeEvent) => void): () => void {
        const id1 = this.program.addEventListener('AccountFrozen', (event: any) => {
            if (event.mint.equals(this.mintAddress)) {
                handler({
                    mint: event.mint,
                    account: event.target,
                    action: 'Frozen',
                    by: event.frozenBy,
                    timestamp: BigInt(event.timestamp.toString())
                });
            }
        });
        const id2 = this.program.addEventListener('AccountThawed', (event: any) => {
            if (event.mint.equals(this.mintAddress)) {
                handler({
                    mint: event.mint,
                    account: event.target,
                    action: 'Thawed',
                    by: event.thawedBy,
                    timestamp: BigInt(event.timestamp.toString())
                });
            }
        });
        return () => {
            this.program.removeEventListener(id1);
            this.program.removeEventListener(id2);
        };
    }

    onBlacklist(handler: (event: BlacklistEvent) => void): () => void {
        const id1 = this.program.addEventListener('AddedToBlacklist', (event: any) => {
            if (event.mint.equals(this.mintAddress)) {
                handler({
                    mint: event.mint,
                    account: event.target,
                    action: 'Added',
                    reason: event.reason,
                    by: event.by,
                    timestamp: BigInt(event.timestamp.toString())
                });
            }
        });
        const id2 = this.program.addEventListener('RemovedFromBlacklist', (event: any) => {
            if (event.mint.equals(this.mintAddress)) {
                handler({
                    mint: event.mint,
                    account: event.target,
                    action: 'Removed',
                    by: event.by,
                    timestamp: BigInt(event.timestamp.toString())
                });
            }
        });
        return () => {
            this.program.removeEventListener(id1);
            this.program.removeEventListener(id2);
        };
    }

    // ── Query Methods ──────────────────────────────────────────────────────

    async getSupply(): Promise<{ totalMinted: bigint; totalBurned: bigint; circulating: bigint; decimals: number }> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);
        const accountInterface: any = this.program.account;
        const configData: any = await accountInterface.stablecoinConfig.fetch(configPda);

        const totalMinted = BigInt(configData.totalMinted.toString());
        const totalBurned = BigInt(configData.totalBurned.toString());

        return {
            totalMinted,
            totalBurned,
            circulating: totalMinted - totalBurned,
            decimals: configData.decimals,
        };
    }

    async getConfig(): Promise<StablecoinConfig> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);
        const accountInterface: any = this.program.account;
        const configData: any = await accountInterface.stablecoinConfig.fetch(configPda);

        return {
            mint: configData.mint,
            name: configData.name,
            symbol: configData.symbol,
            uri: configData.uri,
            decimals: configData.decimals,
            enablePermanentDelegate: configData.enablePermanentDelegate,
            enableTransferHook: configData.enableTransferHook,
            defaultAccountFrozen: configData.defaultAccountFrozen,
            isPaused: configData.isPaused,
            totalMinted: BigInt(configData.totalMinted.toString()),
            totalBurned: BigInt(configData.totalBurned.toString()),
            masterAuthority: configData.masterAuthority,
            pendingAuthority: configData.pendingAuthority,
            authorityTransferInitiatedAt: configData.authorityTransferInitiatedAt
                ? BigInt(configData.authorityTransferInitiatedAt.toString())
                : null,
            bump: configData.bump,
        };
    }

    async getMinters(): Promise<Array<{ address: PublicKey; quota: bigint; mintedThisPeriod: bigint; isActive: boolean }>> {
        const accountInterface: any = this.program.account;
        const allRoles: any[] = await accountInterface.roleAssignment.all([
            { memcmp: { offset: 8, bytes: this.mintAddress.toBase58() } },
        ]);

        return allRoles
            .filter((r: any) => r.account.role && r.account.role.minter !== undefined)
            .map((r: any) => ({
                address: r.account.account as PublicKey,
                quota: BigInt(r.account.quota.toString()),
                mintedThisPeriod: BigInt(r.account.mintedThisPeriod.toString()),
                isActive: r.account.isActive as boolean,
            }));
    }

    // ── Authority Transfer (24h Timelock) ──────────────────────────────────

    async initiateTransferAuthority(newAuthority: PublicKey, currentAuthority: Keypair): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);

        const builder: any = this.program.methods.initiateTransferAuthority();
        return await builder.accounts({
            authority: currentAuthority.publicKey,
            config: configPda,
            newAuthority,
        })
            .signers([currentAuthority])
            .rpc();
    }

    async acceptTransferAuthority(newAuthority: Keypair): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);

        const builder: any = this.program.methods.acceptTransferAuthority();
        return await builder.accounts({
            newAuthority: newAuthority.publicKey,
            config: configPda,
        })
            .signers([newAuthority])
            .rpc();
    }

    async cancelTransferAuthority(authority: Keypair): Promise<TransactionSignature> {
        const [configPda] = getConfigPda(this.mintAddress, this.program.programId);

        const builder: any = this.program.methods.cancelTransferAuthority();
        return await builder.accounts({
            authority: authority.publicKey,
            config: configPda,
        })
            .signers([authority])
            .rpc();
    }
}

