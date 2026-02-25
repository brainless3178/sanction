# Enterprise-Grade Delivery Blueprint — Solana Stablecoin Standard

---

## Architecture Overview

This blueprint defines the architecture and implementation details for a production-ready stablecoin infrastructure. The project prioritizes robust error handling, edge-case coverage, and clean, auditable code suitable for institutional adoption.

---

## SYSTEM SPECIFICATIONS

```
=== MISSION ===

You are building the Solana Stablecoin Standard — an open-source, production-grade, 
modular SDK that institutions, DAOs, and regulated stablecoin issuers can deploy with 
one command. This is not a demo. Every function executes real on-chain logic. Every 
error is handled. Every edge case is considered. The code must be clean enough that 
a senior Solana engineer reads it and says "this is how it should be done."

Reference architecture: Solana Vault Standard (github.com/solanabr/solana-vault-standard)
Follow its code organization, naming conventions, and documentation structure exactly.

Target users:
- A fintech company launching a USD stablecoin and needing OFAC compliance on day one
- A DAO treasury using a simple internal token with no compliance overhead  
- A Brazilian exchange launching a BRL-pegged stablecoin with Switchboard price feeds
- A regulator auditing transactions and needing a clean exportable audit trail

Every architectural decision must serve one of these users.

=== REPOSITORY STRUCTURE ===

solana-stablecoin-standard/
│
├── programs/
│   ├── sss-token/                  # Core stablecoin program (Anchor)
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── state/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── config.rs       # StablecoinConfig PDA
│   │   │   │   ├── roles.rs        # Role PDAs with quota tracking
│   │   │   │   └── blacklist.rs    # Blacklist PDAs (SSS-2)
│   │   │   ├── instructions/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── initialize.rs
│   │   │   │   ├── mint.rs
│   │   │   │   ├── burn.rs
│   │   │   │   ├── freeze.rs
│   │   │   │   ├── pause.rs
│   │   │   │   ├── roles.rs
│   │   │   │   ├── blacklist.rs    # SSS-2 only
│   │   │   │   └── seize.rs        # SSS-2 only
│   │   │   ├── errors.rs           # All custom error codes
│   │   │   └── events.rs           # All emitted events
│   │   ├── Cargo.toml
│   │   └── Xargo.toml
│   │
│   ├── transfer-hook/              # SPL Transfer Hook enforcement program
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── processor.rs        # Hook execution logic
│   │   │   └── state.rs            # Shares blacklist PDA structure with sss-token
│   │   └── Cargo.toml
│   │
│   ├── oracle-module/              # Switchboard price feed module (Bonus)
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── feeds.rs            # USD, EUR, BRL, CPI feed integration
│   │   │   └── pricing.rs          # Mint/redeem price calculation
│   │   └── Cargo.toml
│   │
│   └── sss-private/                # SSS-3 confidential transfers PoC (Bonus)
│       ├── src/
│       │   ├── lib.rs
│       │   └── confidential.rs
│       └── Cargo.toml
│
├── sdk/
│   └── typescript/                 # @stbr/sss-token — the primary developer interface
│       ├── src/
│       │   ├── index.ts            # Public API exports
│       │   ├── client.ts           # SolanaStablecoin main class
│       │   ├── presets.ts          # SSS1_PRESET, SSS2_PRESET constants
│       │   ├── instructions/       # One file per instruction, matches program
│       │   ├── compliance/         # SSS-2 compliance namespace
│       │   ├── accounts/           # PDA derivation helpers
│       │   ├── events/             # Event parsing and subscription
│       │   ├── types/              # All TypeScript types, zero any
│       │   └── errors/             # Typed SDK errors with context
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
│
├── cli/                            # sss-token CLI
│   ├── src/
│   │   ├── index.ts                # Entry point
│   │   ├── commands/               # One file per command group
│   │   │   ├── init.ts
│   │   │   ├── operations.ts       # mint, burn, freeze, thaw, pause
│   │   │   ├── blacklist.ts        # SSS-2 compliance commands
│   │   │   ├── minters.ts
│   │   │   └── audit.ts
│   │   ├── config.ts               # ~/.sss-token/config.json management
│   │   ├── output.ts               # Structured output, --json flag, spinners
│   │   └── rpc.ts                  # Connection management with retry
│   └── package.json
│
├── backend/
│   ├── shared/                     # Shared types, DB client, logger across services
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── schema.sql      # Complete PostgreSQL schema
│   │   │   │   └── client.ts       # Typed database client (pg + zod)
│   │   │   ├── logger.ts           # Pino structured logger config
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── mint-service/               # Fiat-to-stablecoin lifecycle REST API
│   │   ├── src/
│   │   │   ├── server.ts           # Fastify server
│   │   │   ├── routes/
│   │   │   │   ├── mint.ts
│   │   │   │   └── health.ts
│   │   │   ├── services/
│   │   │   │   ├── mint-lifecycle.ts    # request → verify → execute → log
│   │   │   │   └── quota-guard.ts      # Per-minter quota enforcement mirror
│   │   │   └── middleware/
│   │   │       ├── auth.ts
│   │   │       └── rate-limit.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── indexer/                    # On-chain event listener + webhook dispatcher  
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── listener.ts         # Solana websocket subscription manager
│   │   │   ├── parser.ts           # Raw transaction → typed event
│   │   │   ├── store.ts            # Persist events to PostgreSQL
│   │   │   └── webhook/
│   │   │       ├── dispatcher.ts   # Send webhooks with retry
│   │   │       └── registry.ts     # Webhook URL + event type registration
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── compliance/                 # SSS-2 compliance service
│       ├── src/
│       │   ├── server.ts
│       │   ├── routes/
│       │   │   ├── blacklist.ts
│       │   │   └── audit.ts
│       │   ├── services/
│       │   │   ├── blacklist-sync.ts   # DB ↔ on-chain blacklist sync
│       │   │   └── audit-export.ts     # CSV/JSON export for regulators
│       │   └── screening/
│       │       └── integration.ts      # Sanctions screening API hook point
│       ├── Dockerfile
│       └── package.json
│
├── tui/                            # Interactive Terminal UI (Bonus)
│   ├── src/
│   │   ├── index.tsx               # Ink entry point
│   │   ├── screens/
│   │   │   ├── Dashboard.tsx       # Live supply, events, minter status
│   │   │   ├── Operations.tsx      # Mint, freeze, thaw forms
│   │   │   └── Compliance.tsx      # Blacklist, seize panel (SSS-2)
│   │   └── hooks/
│   │       ├── useSupply.ts        # Live supply via websocket
│   │       └── useEvents.ts        # Real-time event feed
│   └── package.json
│
├── frontend/                       # Example web frontend (Bonus)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Create/index.tsx    # Deploy SSS-1 or SSS-2 stablecoin
│   │   │   ├── Manage/index.tsx    # Manage mint lifecycle
│   │   │   └── Compliance/index.tsx# Compliance controls
│   │   └── lib/
│   │       └── sdk.ts              # SDK initialization for browser
│   ├── vite.config.ts
│   └── package.json
│
├── tests/
│   ├── unit/
│   │   ├── program/                # Rust unit tests per instruction
│   │   └── sdk/                    # TypeScript SDK unit tests
│   ├── integration/
│   │   ├── sss1-flow.ts            # Full SSS-1 lifecycle test
│   │   └── sss2-flow.ts            # Full SSS-2 lifecycle + blacklist + seize
│   └── fuzz/
│       └── sss-token/              # Trident fuzz targets
│
├── scripts/
│   ├── deploy-devnet.sh            # Full Devnet deployment script
│   ├── demo-sss1.sh                # Run SSS-1 demo with real transactions
│   └── demo-sss2.sh                # Run SSS-2 demo including blacklist + seize
│
├── deployments/
│   └── devnet.json                 # Program IDs + all demo transaction signatures
│
├── docs/
│   ├── README.md
│   ├── ARCHITECTURE.md
│   ├── SDK.md
│   ├── OPERATIONS.md
│   ├── SSS-1.md
│   ├── SSS-2.md
│   ├── COMPLIANCE.md
│   └── API.md
│
├── docker-compose.yml
├── Anchor.toml
├── Cargo.toml                      # Workspace Cargo.toml
└── package.json                    # Root workspace (pnpm workspaces)

=== PROGRAM: sss-token ===

--- state/config.rs ---

#[account]
pub struct StablecoinConfig {
    // Identity
    pub mint: Pubkey,
    pub name: String,                    // max 32 chars
    pub symbol: String,                  // max 10 chars
    pub uri: String,                     // max 200 chars
    pub decimals: u8,
    
    // Feature flags — set once at initialize, immutable after
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    
    // State
    pub is_paused: bool,
    pub total_minted: u64,               // cumulative, never decreases
    pub total_burned: u64,
    
    // Authority
    pub master_authority: Pubkey,
    pub pending_authority: Option<Pubkey>,    // for timelock transfer
    pub authority_transfer_initiated_at: Option<i64>,  // unix timestamp
    
    // Bump for PDA validation
    pub bump: u8,
}

impl StablecoinConfig {
    pub const AUTHORITY_TRANSFER_DELAY: i64 = 86400; // 24 hour timelock
    pub const MAX_NAME_LEN: usize = 32;
    pub const MAX_SYMBOL_LEN: usize = 10;
    pub const MAX_URI_LEN: usize = 200;
    
    pub fn space() -> usize {
        8 + 32 + 4 + Self::MAX_NAME_LEN + 4 + Self::MAX_SYMBOL_LEN 
        + 4 + Self::MAX_URI_LEN + 1 + 1 + 1 + 1 + 1 + 8 + 8 
        + 32 + 1 + 32 + 1 + 8 + 1
    }
}

PDA seeds: [b"config", mint.key().as_ref()]

--- state/roles.rs ---

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum RoleType {
    Minter,
    Burner,
    Blacklister,   // SSS-2 only — runtime error if compliance not enabled
    Pauser,
    Seizer,        // SSS-2 only
}

#[account]
pub struct RoleAssignment {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub role: RoleType,
    pub quota: u64,             // only meaningful for Minter; 0 = unlimited
    pub minted_this_period: u64,
    pub period_start: i64,      // unix timestamp — quota resets every 24h
    pub is_active: bool,
    pub bump: u8,
}

impl RoleAssignment {
    pub const QUOTA_PERIOD: i64 = 86400; // 24 hours
    
    pub fn can_mint(&self, amount: u64) -> bool {
        if !self.is_active { return false; }
        if self.quota == 0 { return true; }
        self.minted_this_period.checked_add(amount)
            .map(|total| total <= self.quota)
            .unwrap_or(false)
    }
}

PDA seeds: [b"role", mint.key().as_ref(), account.key().as_ref(), role_discriminator]

--- state/blacklist.rs ---

#[account]
pub struct BlacklistEntry {
    pub mint: Pubkey,
    pub target: Pubkey,
    pub reason: String,          // max 128 chars — stored on-chain for audit
    pub added_by: Pubkey,        // who blacklisted this address
    pub added_at: i64,           // unix timestamp
    pub bump: u8,
}

impl BlacklistEntry {
    pub const MAX_REASON_LEN: usize = 128;
}

PDA seeds: [b"blacklist", mint.key().as_ref(), target.key().as_ref()]
When PDA exists = blacklisted. When PDA closed = removed. Simple existence check.

--- errors.rs ---

#[error_code]
pub enum SssError {
    // Authority errors
    #[msg("Unauthorized: caller does not hold the required role")]
    Unauthorized,
    #[msg("Master authority required for this operation")]
    MasterAuthorityRequired,
    #[msg("Authority transfer not initiated or timelock not elapsed")]
    AuthorityTransferNotReady,
    
    // Feature flag errors  
    #[msg("Compliance module not enabled. Reinitialize with enable_transfer_hook=true")]
    ComplianceNotEnabled,
    #[msg("Permanent delegate not enabled on this mint")]
    PermanentDelegateNotEnabled,
    
    // State errors
    #[msg("Global pause is active. No operations permitted")]
    GlobalPause,
    #[msg("Minter quota exceeded for this period")]
    QuotaExceeded,
    #[msg("Arithmetic overflow in amount calculation")]
    Overflow,
    
    // Validation errors
    #[msg("Name exceeds 32 character limit")]
    NameTooLong,
    #[msg("Symbol exceeds 10 character limit")]
    SymbolTooLong,
    #[msg("Decimals must be between 0 and 9")]
    InvalidDecimals,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    
    // Blacklist errors
    #[msg("Address is already blacklisted")]
    AlreadyBlacklisted,
    #[msg("Address is not on the blacklist")]
    NotBlacklisted,
    
    // Transfer hook errors
    #[msg("Transfer blocked: source address is blacklisted")]
    SourceBlacklisted,
    #[msg("Transfer blocked: destination address is blacklisted")]
    DestinationBlacklisted,
}

--- events.rs ---

Every state change emits an event. These feed the indexer.

#[event]
pub struct StablecoinInitialized {
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub master_authority: Pubkey,
    pub preset: String,          // "SSS-1", "SSS-2", or "CUSTOM"
    pub timestamp: i64,
}

#[event]
pub struct TokensMinted {
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub minter: Pubkey,
    pub new_supply: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokensBurned {
    pub mint: Pubkey,
    pub amount: u64,
    pub burner: Pubkey,
    pub new_supply: u64,
    pub timestamp: i64,
}

#[event]
pub struct AccountFrozen {
    pub mint: Pubkey,
    pub target: Pubkey,
    pub frozen_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AccountThawed {
    pub mint: Pubkey,
    pub target: Pubkey,
    pub thawed_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct GlobalPauseSet {
    pub mint: Pubkey,
    pub paused: bool,
    pub by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RoleAssigned {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub role: String,
    pub quota: u64,
    pub by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RoleRevoked {
    pub mint: Pubkey,
    pub account: Pubkey,
    pub role: String,
    pub by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AddedToBlacklist {
    pub mint: Pubkey,
    pub target: Pubkey,
    pub reason: String,
    pub by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RemovedFromBlacklist {
    pub mint: Pubkey,
    pub target: Pubkey,
    pub by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct FundsSeized {
    pub mint: Pubkey,
    pub source: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub seizer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AuthorityTransferInitiated {
    pub mint: Pubkey,
    pub current: Pubkey,
    pub pending: Pubkey,
    pub unlocks_at: i64,         // timestamp when accept can be called
    pub timestamp: i64,
}

#[event]
pub struct AuthorityTransferCompleted {
    pub mint: Pubkey,
    pub previous: Pubkey,
    pub new: Pubkey,
    pub timestamp: i64,
}

--- instructions/initialize.rs ---

Full instruction logic — implement completely, no TODOs:

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    // 1. Validate params
    require!(params.name.len() <= StablecoinConfig::MAX_NAME_LEN, SssError::NameTooLong);
    require!(params.symbol.len() <= StablecoinConfig::MAX_SYMBOL_LEN, SssError::SymbolTooLong);
    require!(params.decimals <= 9, SssError::InvalidDecimals);

    // 2. Build Token-2022 mint extensions list based on feature flags
    //    Extensions must be added in correct order per Token-2022 spec:
    //    MetadataPointer first, then PermanentDelegate, then TransferHook, then MintCloseAuthority
    //    Use spl_token_2022 CPI to add each extension

    // 3. Initialize mint via CPI to Token-2022 program with all selected extensions

    // 4. Initialize metadata via CPI to token metadata program
    //    Fields: name, symbol, uri from params

    // 5. Write StablecoinConfig PDA
    let config = &mut ctx.accounts.config;
    config.mint = ctx.accounts.mint.key();
    config.name = params.name;
    config.symbol = params.symbol;
    config.uri = params.uri;
    config.decimals = params.decimals;
    config.enable_permanent_delegate = params.enable_permanent_delegate;
    config.enable_transfer_hook = params.enable_transfer_hook;
    config.default_account_frozen = params.default_account_frozen;
    config.is_paused = false;
    config.total_minted = 0;
    config.total_burned = 0;
    config.master_authority = ctx.accounts.authority.key();
    config.pending_authority = None;
    config.authority_transfer_initiated_at = None;
    config.bump = ctx.bumps.config;

    // 6. Assign master authority its own Minter role with unlimited quota
    //    (creates RoleAssignment PDA for master authority)

    // 7. Emit event
    let preset = match (params.enable_permanent_delegate, params.enable_transfer_hook) {
        (false, false) => "SSS-1",
        (true, true) => "SSS-2",
        _ => "CUSTOM",
    };
    emit!(StablecoinInitialized { ... });

    Ok(())
}

--- instructions/mint.rs ---

pub fn handler(ctx: Context<Mint>, amount: u64) -> Result<()> {
    // 1. Validate amount > 0
    require!(amount > 0, SssError::ZeroAmount);
    
    // 2. Check global pause
    let config = &ctx.accounts.config;
    require!(!config.is_paused, SssError::GlobalPause);
    
    // 3. Check minter role and quota
    let role = &mut ctx.accounts.minter_role;
    require!(role.is_active, SssError::Unauthorized);
    require!(role.role == RoleType::Minter, SssError::Unauthorized);
    
    // Reset quota if period elapsed
    let now = Clock::get()?.unix_timestamp;
    if now - role.period_start > RoleAssignment::QUOTA_PERIOD {
        role.minted_this_period = 0;
        role.period_start = now;
    }
    
    // Enforce quota on-chain — not just in SDK
    require!(role.can_mint(amount), SssError::QuotaExceeded);
    
    // 4. CPI to Token-2022 mint_to
    // Handle default_account_frozen: if enabled, recipient ATA must be thawed first
    // or use mint_to with freeze_authority logic
    
    // 5. Update state
    role.minted_this_period = role.minted_this_period
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;
    
    let config = &mut ctx.accounts.config;
    config.total_minted = config.total_minted
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;
    
    // 6. Emit
    emit!(TokensMinted {
        mint: config.mint,
        recipient: ctx.accounts.recipient_ata.owner,
        amount,
        minter: ctx.accounts.minter.key(),
        new_supply: config.total_minted - config.total_burned,
        timestamp: now,
    });
    
    Ok(())
}

--- instructions/seize.rs (SSS-2 only) ---

pub fn handler(ctx: Context<Seize>, amount: Option<u64>) -> Result<()> {
    // 1. Check compliance enabled
    require!(
        ctx.accounts.config.enable_permanent_delegate,
        SssError::PermanentDelegateNotEnabled
    );
    
    // 2. Check seizer role
    let role = &ctx.accounts.seizer_role;
    require!(role.is_active && role.role == RoleType::Seizer, SssError::Unauthorized);
    
    // 3. Get source balance (seize all if amount is None)
    let seize_amount = match amount {
        Some(a) => a,
        None => ctx.accounts.source_ata.amount,
    };
    require!(seize_amount > 0, SssError::ZeroAmount);
    
    // 4. CPI to Token-2022 transfer using permanent delegate authority
    //    permanent_delegate is the program PDA — use PDA signing
    
    // 5. Emit
    emit!(FundsSeized {
        mint: ctx.accounts.config.mint,
        source: ctx.accounts.source_ata.owner,
        destination: ctx.accounts.destination_ata.owner,
        amount: seize_amount,
        seizer: ctx.accounts.seizer.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

=== PROGRAM: transfer-hook ===

This program is registered as the transfer hook for SSS-2 mints.
The Token-2022 program calls it on EVERY transfer — no bypass possible.

Implement the SPL Transfer Hook interface exactly:

pub fn execute(ctx: Context<Execute>, amount: u64) -> Result<()> {
    // The extra_account_metas account contains references to:
    // - blacklist PDA for source
    // - blacklist PDA for destination  
    // - config PDA for pause check
    
    // 1. Check global pause — if config.is_paused, block all transfers
    let config_data = ctx.accounts.config.try_borrow_data()?;
    let config = StablecoinConfig::try_deserialize(&mut config_data.as_ref())?;
    require!(!config.is_paused, SssError::GlobalPause);
    
    // 2. Check source blacklist PDA existence
    //    If the source_blacklist account exists (discriminator matches BlacklistEntry),
    //    the transfer is blocked. If it's uninitialized (lamports == 0), allow.
    if ctx.accounts.source_blacklist.lamports() > 0 {
        return Err(SssError::SourceBlacklisted.into());
    }
    
    // 3. Check destination blacklist PDA existence
    if ctx.accounts.destination_blacklist.lamports() > 0 {
        return Err(SssError::DestinationBlacklisted.into());
    }
    
    Ok(())
}

The hook program shares PDA seed derivation logic with sss-token.
Both programs import blacklist seeds from a shared crate to guarantee consistency.

=== TYPESCRIPT SDK ===

--- types/index.ts ---

export type Preset = 'SSS_1' | 'SSS_2';

export interface CreateParams {
  preset?: Preset;
  name: string;
  symbol: string;
  decimals: number;
  uri?: string;
  authority: Keypair;
  // Custom config — used when preset is not set
  extensions?: {
    permanentDelegate?: boolean;
    transferHook?: boolean;
    defaultAccountFrozen?: boolean;
  };
}

export interface MintParams {
  recipient: PublicKey;
  amount: bigint;        // use bigint not number — u64 exceeds JS number precision
  minter: Keypair;
}

export interface BlacklistEntry {
  address: PublicKey;
  reason: string;
  addedBy: PublicKey;
  addedAt: Date;
}

export interface AuditLogFilter {
  action?: 'mint' | 'burn' | 'freeze' | 'blacklist' | 'seize';
  address?: PublicKey;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface SupplyInfo {
  totalMinted: bigint;
  totalBurned: bigint;
  circulating: bigint;
  decimals: number;
}

--- client.ts ---

export class SolanaStablecoin {
  private constructor(
    private readonly connection: Connection,
    private readonly program: Program<SssToken>,
    private readonly mintAddress: PublicKey,
    private readonly config: StablecoinConfigAccount,
    public readonly compliance: ComplianceClient | null,  // null for SSS-1
  ) {}

  static async create(
    connection: Connection,
    params: CreateParams,
  ): Promise<SolanaStablecoin> {
    // 1. Resolve config from preset or custom extensions
    const resolved = resolveConfig(params);
    
    // 2. Generate mint keypair
    const mintKeypair = Keypair.generate();
    
    // 3. Build and send initialize transaction
    //    Uses @coral-xyz/anchor to CPI the sss-token program
    
    // 4. Instantiate compliance client only if SSS-2
    const compliance = resolved.enableTransferHook
      ? new ComplianceClient(connection, program, mintKeypair.publicKey)
      : null;
    
    return new SolanaStablecoin(connection, program, mintKeypair.publicKey, config, compliance);
  }

  static async load(
    connection: Connection,
    mintAddress: PublicKey,
  ): Promise<SolanaStablecoin> {
    // Load existing deployed stablecoin from mint address
    // Fetches config PDA and determines which features are enabled
  }

  async mint(params: MintParams): Promise<TransactionSignature> { ... }
  async burn(params: BurnParams): Promise<TransactionSignature> { ... }
  async freeze(address: PublicKey, authority: Keypair): Promise<TransactionSignature> { ... }
  async thaw(address: PublicKey, authority: Keypair): Promise<TransactionSignature> { ... }
  async pause(authority: Keypair): Promise<TransactionSignature> { ... }
  async unpause(authority: Keypair): Promise<TransactionSignature> { ... }
  async updateMinter(address: PublicKey, quota: bigint, authority: Keypair): Promise<TransactionSignature> { ... }
  async revokeMinter(address: PublicKey, authority: Keypair): Promise<TransactionSignature> { ... }
  
  async getSupply(): Promise<SupplyInfo> { ... }
  async getConfig(): Promise<StablecoinConfigAccount> { ... }
  async getMinters(): Promise<MinterInfo[]> { ... }
  async getHolders(minBalance?: bigint): Promise<HolderInfo[]> { ... }
  
  // Event subscription
  onMint(handler: (event: MintEvent) => void): () => void { ... }  // returns unsubscribe fn
  onFreeze(handler: (event: FreezeEvent) => void): () => void { ... }
  onBlacklist(handler: (event: BlacklistEvent) => void): () => void { ... }
}

--- compliance/client.ts ---

export class ComplianceClient {
  constructor(
    private readonly connection: Connection,
    private readonly program: Program<SssToken>,
    private readonly mint: PublicKey,
  ) {}

  async blacklistAdd(
    address: PublicKey,
    reason: string,
    authority: Keypair,
  ): Promise<TransactionSignature> {
    // Derive blacklist PDA, call add_to_blacklist instruction
    // reason is stored on-chain in the BlacklistEntry account
  }

  async blacklistRemove(
    address: PublicKey,
    authority: Keypair,
  ): Promise<TransactionSignature> { ... }

  async isBlacklisted(address: PublicKey): Promise<boolean> {
    // Derive PDA, check if account exists and has data
    const pda = deriveBlacklistPda(this.mint, address);
    const info = await this.connection.getAccountInfo(pda);
    return info !== null && info.lamports > 0;
  }

  async getBlacklist(): Promise<BlacklistEntry[]> {
    // getProgramAccounts filtered by blacklist discriminator + mint
  }

  async seize(
    source: PublicKey,
    destination: PublicKey,
    authority: Keypair,
    amount?: bigint,   // undefined = seize full balance
  ): Promise<TransactionSignature> { ... }
}

=== CLI ===

sss-token init --preset sss-1
  → Runs SolanaStablecoin.create with SSS1_PRESET
  → Saves mint address + program ID to ~/.sss-token/config.json
  → Shows: "✓ SSS-1 stablecoin deployed: <mint-address>"
  → With --json: outputs { "mint": "...", "txSignature": "...", "explorerUrl": "..." }

sss-token mint <recipient> <amount>
  → Loads config from ~/.sss-token/config.json
  → Calls stable.mint({ recipient, amount: BigInt(amount), minter: loadKeypair() })
  → Shows spinner during broadcast
  → On success: "✓ Minted 1,000.00 MYUSD to <address> | tx: <sig>"

sss-token blacklist add <address> --reason "OFAC match"
  → Checks config has SSS-2 features, errors clearly if not
  → Calls stable.compliance.blacklistAdd(...)
  → Shows: "✓ <address> added to blacklist | reason: OFAC match"

sss-token audit-log --action blacklist --from 2024-01-01
  → Fetches from compliance backend API or directly from indexer DB
  → Outputs clean table OR JSON with --json flag

All commands:
  - Load ~/.sss-token/config.json for RPC URL, keypair path, program ID, mint address
  - Support --config <path> to override config file location
  - Support --cluster devnet|mainnet|localnet
  - Support --json for machine-readable output
  - Show human-readable output with colors by default
  - Return non-zero exit code on failure (for shell scripting)

=== BACKEND SERVICES ===

--- shared/db/schema.sql ---

CREATE TABLE mint_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mint_address TEXT NOT NULL,
    recipient TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'executed', 'failed')),
    tx_signature TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    mint_address TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,    -- full event data
    tx_signature TEXT NOT NULL,
    slot BIGINT NOT NULL,
    block_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX events_mint_address_idx ON events(mint_address);
CREATE INDEX events_event_type_idx ON events(event_type);
CREATE INDEX events_block_time_idx ON events(block_time);

CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    event_types TEXT[] NOT NULL,
    secret TEXT NOT NULL,      -- HMAC secret for signature verification
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
    id BIGSERIAL PRIMARY KEY,
    webhook_id UUID REFERENCES webhooks(id),
    event_id BIGINT REFERENCES events(id),
    attempt_count INT DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('pending', 'delivered', 'failed')),
    response_code INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blacklist (
    id BIGSERIAL PRIMARY KEY,
    mint_address TEXT NOT NULL,
    address TEXT NOT NULL,
    reason TEXT NOT NULL,
    added_by TEXT NOT NULL,
    tx_signature TEXT NOT NULL,    -- on-chain proof
    added_at TIMESTAMPTZ NOT NULL,
    removed_at TIMESTAMPTZ,
    removed_tx TEXT,
    UNIQUE(mint_address, address, removed_at) -- allow re-adding after removal
);

--- indexer/listener.ts ---

Logic:
1. Connect via WebSocket to Solana RPC (with reconnect logic — retry every 5s on disconnect)
2. Subscribe to program logs for sss-token program ID
3. Parse logs to extract emit!() event data using @coral-xyz/anchor EventParser
4. For each parsed event: 
   a. Insert into events table
   b. Trigger webhook dispatcher for matching subscriptions
5. Track processed slots in DB to handle restarts without duplicate processing

--- backend/compliance/services/audit-export.ts ---

Produces audit trail in two formats:

JSON format (for programmatic consumption):
{
  "export_generated_at": "2024-01-15T10:00:00Z",
  "mint_address": "...",
  "period": { "from": "...", "to": "..." },
  "events": [
    {
      "id": 1,
      "type": "blacklist_add",
      "timestamp": "2024-01-10T09:00:00Z",
      "tx_signature": "...",
      "data": {
        "target_address": "...",
        "reason": "OFAC match",
        "added_by": "..."
      }
    }
  ]
}

CSV format (for regulators):
timestamp,event_type,target_address,executed_by,tx_signature,reason
2024-01-10T09:00:00Z,blacklist_add,<addr>,<admin>,<sig>,OFAC match

=== TESTS ===

--- integration/sss2-flow.ts ---

Full SSS-2 lifecycle, every step verified:

test("SSS-2 full compliance lifecycle", async () => {
  // 1. Deploy SSS-2 stablecoin
  const stable = await SolanaStablecoin.create(connection, {
    preset: Presets.SSS_2,
    name: "Test USD",
    symbol: "TUSD",
    decimals: 6,
    authority: authorityKeypair,
  });
  
  // 2. Add a minter with quota
  await stable.updateMinter(minterKeypair.publicKey, BigInt(1_000_000_000), authorityKeypair);
  
  // 3. Mint tokens
  await stable.mint({ recipient: user1.publicKey, amount: BigInt(500_000_000), minter: minterKeypair });
  
  // 4. Transfer succeeds (both parties clean)
  // Direct SPL transfer from user1 to user2 — should work
  
  // 5. Blacklist user1
  await stable.compliance.blacklistAdd(user1.publicKey, "Test sanction", authorityKeypair);
  
  // 6. Verify transfer from user1 now FAILS — transfer hook blocks it
  await expect(
    transferToken(connection, user1, user2.publicKey, 100_000_000)
  ).rejects.toThrow("SourceBlacklisted");
  
  // 7. Seize funds from user1 to treasury
  const seizedAmount = await stable.compliance.seize(
    user1.publicKey,
    treasuryKeypair.publicKey,
    authorityKeypair
  );
  expect(seizedAmount).toBeGreaterThan(BigInt(0));
  
  // 8. Verify user1 balance is now 0
  const balance = await getTokenBalance(connection, user1.publicKey, stable.mintAddress);
  expect(balance).toBe(BigInt(0));
  
  // 9. Remove from blacklist, verify transfers resume
  await stable.compliance.blacklistRemove(user1.publicKey, authorityKeypair);
  // Now user1 can receive tokens again
  
  // 10. Verify audit log captured all events
  const log = await stable.compliance.getAuditLog({});
  expect(log.find(e => e.type === 'blacklist_add')).toBeDefined();
  expect(log.find(e => e.type === 'seize')).toBeDefined();
  expect(log.find(e => e.type === 'blacklist_remove')).toBeDefined();
});

=== BONUS: ORACLE MODULE ===

programs/oracle-module/ — separate Anchor program, does NOT touch the token itself.
Used by integrators for non-USD stablecoin pricing.

pub struct PriceFeed {
    pub mint: Pubkey,               // which stablecoin this feeds
    pub switchboard_feed: Pubkey,   // Switchboard aggregator account
    pub currency: String,           // "EUR", "BRL", "CPI"
    pub last_price: u64,            // 6 decimal precision (1.00 EUR = 1_000_000)
    pub last_updated: i64,
    pub staleness_threshold: i64,   // reject prices older than this (seconds)
    pub authority: Pubkey,
    pub bump: u8,
}

Instructions:
- register_feed(switchboard_feed, currency, staleness_threshold) — sets up price feed
- get_price() — reads Switchboard aggregator, validates freshness, returns price
  Returns error if: feed is stale, price is negative, or Switchboard account invalid
- calculate_mint_amount(fiat_amount: u64) -> u64 — given X EUR, how many tokens to mint
- calculate_redeem_amount(token_amount: u64) -> u64 — given X tokens, how many EUR

=== BONUS: TUI ===

Built with ink (React for terminals).
Uses the TypeScript SDK — all real data, live via websocket.

Layout:
┌─────────────────────────────────────────────────────────┐
│  SSS-TOKEN DASHBOARD    MYUSD    Devnet    [P] PAUSE     │
├──────────────────┬──────────────────┬────────────────────┤
│  SUPPLY          │  MINTERS         │  RECENT EVENTS     │
│  Circulating:    │  ┌─────┬───────┐ │  10:01 MINT        │
│  1,234,567.89    │  │addr │ quota │ │  +1000 → 0xABC     │
│                  │  │0xA  │ 50%   │ │  10:00 FREEZE      │
│  Minted: 1.3M    │  │0xB  │ 100%  │ │  0xDEF frozen      │
│  Burned:  65.1K  │  └─────┴───────┘ │  09:58 MINT        │
├──────────────────┴──────────────────┴────────────────────┤
│  [M] MINT  [F] FREEZE  [B] BLACKLIST  [S] SEIZE  [Q] QUIT│
└─────────────────────────────────────────────────────────┘

Press M → opens mint form (recipient address, amount input)
Press B → opens blacklist add/remove form with address + reason
All actions call real SDK methods and show result inline.
Supply panel updates in real-time via websocket subscription.

=== BONUS: FRONTEND ===

React 18 + Vite + Tailwind CSS + @solana/wallet-adapter-react.
Uses @stbr/sss-token SDK imported directly.

/create route:
  - Two cards: SSS-1 (Minimal) and SSS-2 (Compliant) with feature comparison
  - Form: name, symbol, decimals, URI
  - Connect wallet → Deploy button calls SolanaStablecoin.create()
  - Success: shows mint address, explorer link, copy SDK snippet

/manage/:mint route:
  - Supply stats (circulating, minted, burned)
  - Mint form + Burn form
  - Freeze/Thaw address lookup
  - Active minters table with quota bars
  - Real-time event feed (last 20 events, live via websocket)

/compliance/:mint route: (shows only for SSS-2 mints)
  - Blacklist table with add/remove buttons
  - Seize form (source → destination)
  - Audit log table with date/type/address filters
  - Export button (downloads CSV)

=== DEVNET DEPLOYMENT ===

scripts/deploy-devnet.sh — must run clean on a fresh machine:

#!/bin/bash
set -e  # exit on any error

echo "Building programs..."
anchor build

echo "Deploying sss-token..."
SSS_TOKEN_ID=$(solana program deploy target/deploy/sss_token.so --output json | jq -r '.programId')

echo "Deploying transfer-hook..."
HOOK_ID=$(solana program deploy target/deploy/transfer_hook.so --output json | jq -r '.programId')

echo "Updating Anchor.toml with program IDs..."
# sed replace program IDs in Anchor.toml

echo "Running SSS-2 demo..."
npx ts-node scripts/demo-sss2.ts

scripts/demo-sss2.ts — runs full lifecycle:
1. Initialize SSS-2 with TUSD / Test USD
2. Add minter with 1M quota
3. Mint 500K tokens to wallet A
4. Blacklist wallet A (reason: "Demo OFAC match")
5. Attempt transfer from A (captures error)
6. Seize all funds from A to treasury
7. Remove A from blacklist
8. Print all tx signatures

All transaction signatures saved to:
deployments/devnet.json — this file is submitted with the PR as proof.

=== CODE STANDARDS — NON-NEGOTIABLE ===

Rust:
- zero unwrap() calls — use ? everywhere
- All arithmetic uses checked_add / checked_sub / checked_mul
- All PDA bumps validated in account constraints, stored in state
- Custom errors for every failure case — no generic errors
- emit!() on every state change
- Full Anchor account validation constraints on every instruction

TypeScript:
- tsconfig strict: true, noImplicitAny: true
- bigint for all u64 values — never number
- Zod for all external data validation (API responses, config files)
- Every async function returns typed Result or throws typed error
- No console.log in library code — use proper logger injection

Security:
- Master authority cannot be changed instantly — 24-hour timelock enforced on-chain
- Per-minter quotas enforced in Rust instruction handler, not just in SDK
- SSS-2 instructions check enable_permanent_delegate at runtime from config PDA
- Transfer hook uses PDA existence check — no off-chain data can be spoofed
- Seize instruction validates the permanent delegate matches the program PDA

Documentation:
- Every docs/*.md must be complete — no placeholder sections
- ARCHITECTURE.md must include ASCII diagrams of: PDA structure, transfer hook flow, mint lifecycle
- OPERATIONS.md must be written for an operator who has never seen this codebase
  — step by step, with exact commands to run

=== FINAL DELIVERY CHECKLIST ===

Before submitting the PR, verify:
[ ] anchor build succeeds with zero warnings
[ ] anchor test passes all tests
[ ] docker compose up --wait brings all services healthy
[ ] sss-token init --preset sss-2 works on a fresh install
[ ] sss-token blacklist add 0x... --reason "test" works end-to-end
[ ] deployments/devnet.json exists with real program IDs and tx signatures
[ ] All 7 docs/*.md files are complete with no TODO markers
[ ] TUI launches with sss-token tui command
[ ] Frontend deploys with npm run build with zero errors

This is the full specification. Build every piece. No mocks. No stubs. 
No "coming soon". Every function executes real logic.
```

---

## Implementation Timeline and Dependencies

This section outlines the optimal build order to minimize architectural debt:

**Phase 1 — Core Smart Contracts**

Begin with the Rust programs. The TypeScript SDK, CLI, and backend require stable on-chain logic. Develop the `sss-token` and `transfer-hook` components first. Ensure `anchor test` coverage passes on a local validator before proceeding to off-chain infrastructure, to avoid repeated SDK refactoring.

**Phase 2 — SDK, CLI, and Backend Services**

Following program stability, implement the TypeScript SDK against the local validator. Develop integration tests concurrently to catch protocol regressions. The CLI builds directly upon the SDK. Backend services operate independently by indexing events and serving REST APIs, and can be developed in parallel.

**Phase 3 — Extended Features and Deployment**

Deploy to Devnet only after verifying all localnet tests. Additional features (TUI, frontend, oracle module, private transfers) should be integrated after the core standards (SSS-1 and SSS-2) are verified. Core feature completion should be prioritized over extensions.

Ensure the final pull request contains comprehensive documentation, including environment startup logs (`docker compose up` output), Devnet contract addresses, and a demonstration sequence of the CLI or TUI.