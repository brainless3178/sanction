# Parameter Flows

Complete specification of every parameter, instruction, and data flow across the SSS system.

## Program Instructions — Parameter Map

### sss-token Program

```
┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: initialize                                                │
│──────────────────────────────────────────────────────────────────────────│
│  Params:                                                                │
│    name:                     String (max 32 chars)                      │
│    symbol:                   String (max 10 chars)                      │
│    uri:                      String (max 200 chars)                     │
│    decimals:                 u8 (0-9)                                   │
│    enable_permanent_delegate: bool                                      │
│    enable_transfer_hook:     bool                                       │
│                                                                         │
│  Accounts:                                                              │
│    authority   [signer, mut]   — Master authority (pays rent)           │
│    mint        [signer, mut]   — Fresh keypair for the Token-2022 mint  │
│    config      [PDA, mut]      — Seeds: ["config", mint]                │
│    token_program               — TOKEN_2022_PROGRAM_ID                  │
│    system_program              — SystemProgram                          │
│    rent                        — SysVarRent                             │
│                                                                         │
│  Emits: StablecoinInitialized { mint, authority, name, symbol }         │
│                                                                         │
│  Flow:                                                                  │
│    1. Allocate mint account with Token-2022 extensions                  │
│    2. Init MetadataPointer → self                                       │
│    3. Init MintCloseAuthority → config PDA                              │
│    4. If enable_permanent_delegate → init PermanentDelegate → config    │
│    5. If enable_transfer_hook → init TransferHook → hook program        │
│    6. InitializeMint2 with freeze_authority = config PDA                │
│    7. Write StablecoinConfig PDA                                        │
│    8. Create RoleAssignment PDA for master (all roles)                  │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: mint                                                      │
│──────────────────────────────────────────────────────────────────────────│
│  Params:                                                                │
│    amount:     u64  — Raw token units (e.g. 1_000_000 = 1.0 at 6 dec)  │
│                                                                         │
│  Accounts:                                                              │
│    minter               [signer]         — Must have Minter role        │
│    mint                 [mut]            — The Token-2022 mint          │
│    config               [PDA]            — Seeds: ["config", mint]      │
│    role_assignment       [PDA, mut]       — Seeds: ["role", mint,       │
│                                             minter, 0x00]               │
│    recipient_token_acct  [mut]           — ATA of recipient             │
│    token_program                         — TOKEN_2022_PROGRAM_ID        │
│                                                                         │
│  Emits: TokensMinted { mint, recipient, amount, minter }                │
│                                                                         │
│  Guards:                                                                │
│    ├─ config.is_paused == false                                         │
│    ├─ role.role_type == Minter                                          │
│    └─ role.can_mint(amount) == true (quota check)                       │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: burn                                                      │
│──────────────────────────────────────────────────────────────────────────│
│  Params:                                                                │
│    amount:     u64                                                      │
│                                                                         │
│  Accounts:                                                              │
│    burner               [signer]         — Must have Burner role        │
│    mint                 [mut]            — The Token-2022 mint          │
│    config               [PDA]            — Seeds: ["config", mint]      │
│    role_assignment       [PDA]            — Seeds: ["role", mint,       │
│                                             burner, 0x01]               │
│    burner_token_acct     [mut]           — Burner's ATA                 │
│    token_program                         — TOKEN_2022_PROGRAM_ID        │
│                                                                         │
│  Emits: TokensBurned { mint, amount, burner }                           │
│                                                                         │
│  Guards:                                                                │
│    ├─ config.is_paused == false                                         │
│    └─ role.role_type == Burner                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: freeze / thaw                                             │
│──────────────────────────────────────────────────────────────────────────│
│  Accounts:                                                              │
│    authority             [signer]         — Must have Pauser role       │
│    mint                  []               — Token-2022 mint             │
│    config                [PDA]            — Seeds: ["config", mint]     │
│    role_assignment        [PDA]            — Seeds: ["role", mint,      │
│                                              authority, 0x03]           │
│    token_account          [mut]            — Target token account       │
│    token_program                          — TOKEN_2022_PROGRAM_ID       │
│                                                                         │
│  Emits: AccountFrozen / AccountThawed { mint, account, by }             │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: set_pause                                                 │
│──────────────────────────────────────────────────────────────────────────│
│  Params:                                                                │
│    paused:     bool                                                     │
│                                                                         │
│  Accounts:                                                              │
│    authority             [signer]         — Must be master authority    │
│    config                [PDA, mut]       — Seeds: ["config", mint]     │
│                                                                         │
│  Emits: GlobalPauseSet { mint, paused, authority }                      │
│                                                                         │
│  Guard: authority == config.authority                                    │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: assign_role                                               │
│──────────────────────────────────────────────────────────────────────────│
│  Params:                                                                │
│    role_type:  enum (Minter=0, Burner=1, Blacklister=2, Pauser=3,      │
│                      Seizer=4)                                          │
│    limit:      u64 (daily quota, minter-only, 0 = unlimited)           │
│                                                                         │
│  Accounts:                                                              │
│    authority             [signer, mut]    — Must be master authority    │
│    config                [PDA]            — Seeds: ["config", mint]     │
│    assignee              []               — Target account pubkey       │
│    role_assignment        [PDA, init, mut] — Seeds: ["role", mint,      │
│                                              assignee, role_type]       │
│    mint                  []               — The Token-2022 mint         │
│    system_program                                                       │
│                                                                         │
│  Emits: RoleAssigned { mint, account, role, limit }                     │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: revoke_role                                               │
│──────────────────────────────────────────────────────────────────────────│
│  Accounts:                                                              │
│    authority             [signer, mut]    — Must be master authority    │
│    config                [PDA]            — Seeds: ["config", mint]     │
│    role_assignment        [PDA, mut, close] — Closed, rent returned     │
│    mint                  []               — The Token-2022 mint         │
│                                                                         │
│  Emits: RoleRevoked { mint, account, role }                             │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: blacklist_add  (SSS-2 only)                               │
│──────────────────────────────────────────────────────────────────────────│
│  Params:                                                                │
│    reason:     String (max 128 chars)                                   │
│                                                                         │
│  Accounts:                                                              │
│    authority             [signer, mut]    — Must have Blacklister role  │
│    config                [PDA]            — Seeds: ["config", mint]     │
│    role_assignment        [PDA]            — Blacklister role PDA       │
│    target                []               — Address to blacklist       │
│    blacklist_entry        [PDA, init, mut] — Seeds: ["blacklist",       │
│                                              mint, target]              │
│    mint                  []                                              │
│    system_program                                                       │
│                                                                         │
│  Emits: AddedToBlacklist { mint, target, reason, by }                   │
│                                                                         │
│  Guard: config.enable_transfer_hook == true                             │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: blacklist_remove  (SSS-2 only)                            │
│──────────────────────────────────────────────────────────────────────────│
│  Accounts:                                                              │
│    authority             [signer, mut]    — Must have Blacklister role  │
│    config                [PDA]            — Seeds: ["config", mint]     │
│    role_assignment        [PDA]            — Blacklister role PDA       │
│    blacklist_entry        [PDA, mut, close] — Closed, rent returned     │
│    mint                  []                                              │
│                                                                         │
│  Emits: RemovedFromBlacklist { mint, target, by }                       │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: seize  (SSS-2 only)                                       │
│──────────────────────────────────────────────────────────────────────────│
│  Params:                                                                │
│    amount:     u64                                                      │
│                                                                         │
│  Accounts:                                                              │
│    authority             [signer]         — Must have Seizer role       │
│    config                [PDA]            — Seeds: ["config", mint]     │
│    role_assignment        [PDA]            — Seizer role PDA            │
│    mint                  []               — Token-2022 mint             │
│    source_token_acct      [mut]            — Victim's ATA              │
│    dest_token_acct        [mut]            — Treasury ATA              │
│    token_program                          — TOKEN_2022_PROGRAM_ID       │
│                                                                         │
│  Emits: FundsSeized { mint, source, destination, amount, by }           │
│                                                                         │
│  Guard: config.enable_permanent_delegate == true                        │
│  Mechanism: CPI TransferChecked with config PDA as delegate signer      │
└──────────────────────────────────────────────────────────────────────────┘
```

### transfer-hook Program

```
┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: initialize_extra_account_meta_list                        │
│──────────────────────────────────────────────────────────────────────────│
│  Accounts:                                                              │
│    payer                 [signer, mut]    — Pays rent                   │
│    extra_meta_list        [PDA, mut]       — Seeds: ["extra-account-    │
│                                              metas", mint]              │
│    mint                  []               — Token-2022 mint             │
│    system_program                                                       │
│                                                                         │
│  Registers 3 extra accounts required for execute():                     │
│    1. StablecoinConfig PDA (from sss-token)                             │
│    2. Source BlacklistEntry PDA                                         │
│    3. Destination BlacklistEntry PDA                                    │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: execute  (called by Token-2022 on every transfer)         │
│──────────────────────────────────────────────────────────────────────────│
│  Accounts (provided by Token-2022 runtime):                             │
│    source_token_acct      []              — Source ATA                  │
│    mint                  []               — Token-2022 mint             │
│    dest_token_acct        []              — Destination ATA             │
│    authority             []               — Transfer authority          │
│    extra_meta_list        []              — ExtraAccountMetaList PDA    │
│    config                []               — StablecoinConfig PDA       │
│    source_blacklist       []              — Source BlacklistEntry PDA   │
│    dest_blacklist         []              — Dest BlacklistEntry PDA     │
│                                                                         │
│  Checks:                                                                │
│    1. config.is_paused == false → Err(GlobalPause)                      │
│    2. source_blacklist.lamports == 0 → OK                               │
│       source_blacklist.lamports > 0 → Err(SourceBlacklisted)            │
│    3. dest_blacklist.lamports == 0 → OK                                 │
│       dest_blacklist.lamports > 0 → Err(DestinationBlacklisted)         │
└──────────────────────────────────────────────────────────────────────────┘
```

### oracle-module Program

```
┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: register_feed                                             │
│──────────────────────────────────────────────────────────────────────────│
│  Params:                                                                │
│    currency:              String (max 16 chars, e.g. "EUR", "BRL")      │
│    staleness_threshold:   i64 (seconds, must be > 0)                    │
│                                                                         │
│  Accounts:                                                              │
│    authority             [signer, mut]    — Feed registrar              │
│    switchboard_feed       []              — Switchboard V2 aggregator   │
│    mint                  []               — Stablecoin mint             │
│    price_feed             [PDA, init]      — Seeds: ["price-feed",      │
│                                              mint, currency]            │
│    system_program                                                       │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: get_price                                                 │
│──────────────────────────────────────────────────────────────────────────│
│  Accounts:                                                              │
│    switchboard_feed       []              — Switchboard V2 aggregator   │
│    price_feed             [PDA, mut]       — Updates cached price       │
│                                                                         │
│  Returns: u64 (6-decimal precision, 1.00 = 1_000_000)                  │
│                                                                         │
│  Flow:                                                                  │
│    1. Read i128 mantissa at offset 208 of aggregator data               │
│    2. Convert 18-decimal Switchboard → 6-decimal SSS precision          │
│    3. Validate staleness (age < threshold)                              │
│    4. Update price_feed.last_price + last_updated                       │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  INSTRUCTION: calculate_mint_amount / calculate_redeem_amount           │
│─────────────────────────────────────────────────────────────────────────│
│  Params:                                                                │
│    fiat_amount / token_amount:  u64                                     │
│                                                                         │
│  Formulas:                                                              │
│    mint:   tokens = fiat_amount × 1_000_000 / price                     │
│    redeem: fiat   = token_amount × price / 1_000_000                    │
│                                                                         │
│  All arithmetic uses checked_mul / checked_div (u128 intermediate)      │
└──────────────────────────────────────────────────────────────────────────┘
```

## PDA Derivation Map (Complete)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PDA SEED MAP                                     │
│─────────────────────────────────────────────────────────────────────────│
│                                                                         │
│  sss-token Program:                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  StablecoinConfig   ["config", mint.key()]                      │    │
│  │  RoleAssignment     ["role", mint.key(), account.key(),         │    │
│  │                      role_type_byte]                            │    │
│  │  BlacklistEntry     ["blacklist", mint.key(), target.key()]     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  transfer-hook Program:                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ExtraAccountMetaList  ["extra-account-metas", mint.key()]      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  oracle-module Program:                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  PriceFeed          ["price-feed", mint.key(), currency_bytes]  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  sss-private Program:                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ConfidentialMintConfig    ["confidential-config", mint.key()]  │    │
│  │  ConfidentialAccountConfig ["confidential-account", mint.key(), │    │
│  │                             owner.key()]                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Account Data Layouts

### StablecoinConfig (sss-token)

```
Offset  Size   Field
──────  ────   ─────────────────────────
0       8      Anchor discriminator
8       32     authority (Pubkey)
40      32     mint (Pubkey)
72      32     pending_authority (Pubkey)
104     4+32   name (String, max 32)
140     4+10   symbol (String, max 10)
154     4+200  uri (String, max 200)
358     1      decimals (u8)
359     1      is_paused (bool)
360     8      total_minted (u64)
368     8      total_burned (u64)
376     1      enable_permanent_delegate (bool)
377     1      enable_transfer_hook (bool)
378     8      authority_transfer_initiated_at (i64)
386     1      bump (u8)
```

### RoleAssignment (sss-token)

```
Offset  Size   Field
──────  ────   ─────────────────────────
0       8      Anchor discriminator
8       32     mint (Pubkey)
40      32     account (Pubkey)
72      1      role_type (enum: 0=Minter, 1=Burner, 2=Blacklister,
                                3=Pauser, 4=Seizer)
73      8      limit (u64) — daily quota (minter only)
81      8      minted_this_period (u64)
89      8      period_start (i64) — unix timestamp
```

### BlacklistEntry (sss-token)

```
Offset  Size   Field
──────  ────   ─────────────────────────
0       8      Anchor discriminator
8       32     mint (Pubkey)
40      32     target (Pubkey)
72      4+128  reason (String, max 128)
204     32     added_by (Pubkey)
236     8      added_at (i64)
244     1      bump (u8)
```

## Backend Services — API Parameter Map

### Mint Service (Port 3001)

```
POST /api/mint
├── Body Parameters:
│   ├── mintAddress:   string (32-64 chars, base58)
│   ├── recipient:     string (32-64 chars, base58)
│   └── amount:        string (numeric, raw token units)
├── Headers:
│   └── X-API-Key:     string (required if API_KEY env is set)
├── Response 202:
│   ├── id:            string (UUID)
│   ├── status:        "pending"
│   └── message:       string
└── Lifecycle: pending → verified → executed | failed

GET /api/mint/:id
├── Params:
│   └── id:            string (UUID)
└── Response 200:
    ├── id, mintAddress, recipient, amount, status
    ├── txSignature:   string | null
    └── createdAt, updatedAt: ISO 8601
```

### Compliance Service (Port 3002)

```
POST /api/blacklist/add
├── Body:
│   ├── mintAddress:   string
│   ├── address:       string (target)
│   ├── reason:        string
│   ├── addedBy:       string
│   └── txSignature:   string
└── Response 201: { status, record }

POST /api/blacklist/remove
├── Body:
│   ├── mintAddress:   string
│   ├── address:       string
│   └── removedTx:     string
└── Response 200: { status }

GET /api/blacklist?mintAddress=<addr>
└── Response 200: { mintAddress, count, data: [...] }

GET /api/blacklist/check?mintAddress=<addr>&address=<addr>
└── Response 200: { mintAddress, address, isBlacklisted }

POST /api/blacklist/screen
├── Body: { address: string }
└── Response 200: { address, isSanctioned, matchType, listName,
                    matchScore, checkedAt, details }

GET /api/audit?mintAddress=<addr>&format=json|csv
├── Query: mintAddress (required), format, eventType, from, to,
│          limit, offset
└── Response: JSON audit report or CSV text
```

## Event Flow — End to End

```
┌──────────────┐     ┌───────────────┐     ┌───────────────┐
│  On-Chain     │────▸│   Indexer      │────▸│  PostgreSQL   │
│  Anchor emit  │     │  (WebSocket)   │     │  events table │
│  TokensMinted │     │  parse logs    │     │               │
│  AccountFrozen│     │  match discr.  │     │               │
│  AddedTo...   │     │  store event   │     │               │
└──────────────┘     └───────┬───────┘     └───────┬───────┘
                             │                      │
                    ┌────────▼────────┐     ┌───────▼───────┐
                    │   Webhook       │     │  Compliance   │
                    │   Dispatcher    │     │  API          │
                    │                 │     │               │
                    │  HMAC-signed    │     │  GET /audit   │
                    │  POST to subs   │     │  CSV export   │
                    └─────────────────┘     └───────────────┘
```

## Environment Variables — Complete Reference

| Variable | Service | Required | Default | Description |
|----------|---------|----------|---------|-------------|
| `RPC_URL` | indexer | ✅ | `https://api.devnet.solana.com` | Solana JSON-RPC endpoint |
| `RPC_WS_URL` | indexer | ✅ | `wss://api.devnet.solana.com` | Solana WebSocket endpoint |
| `PROGRAM_ID` | indexer | ✅ | — | Deployed sss-token program ID |
| `DATABASE_URL` | all | ✅ | — | PostgreSQL connection string |
| `PORT` | mint, compliance | ❌ | `3001` / `3002` | HTTP listen port |
| `HOST` | mint, compliance | ❌ | `0.0.0.0` | HTTP bind address |
| `LOG_LEVEL` | all | ❌ | `info` | Pino log level |
| `API_KEY` | mint | ❌ | — | API key (bypassed if unset) |
| `QUOTA_LIMIT` | mint | ❌ | `1000000000000` | Default minter quota |
| `RATE_LIMIT_MAX` | mint | ❌ | `100` | Requests per window |
| `RATE_LIMIT_WINDOW` | mint | ❌ | `1 minute` | Rate limit window |
| `SANCTIONS_API_URL` | compliance | ❌ | — | External screening API |
| `SANCTIONS_API_KEY` | compliance | ❌ | — | Screening API key |
| `CORS_ORIGIN` | mint, compliance | ❌ | `*` | CORS allowed origins |
| `VITE_RPC_URL` | frontend | ❌ | `https://api.devnet.solana.com` | Frontend RPC |
| `VITE_PROGRAM_ID` | frontend | ❌ | — | Frontend program ID |
| `VITE_COMPLIANCE_API` | frontend | ❌ | `http://localhost:3002` | Compliance API URL |
| `MINT_ADDRESS` | tui | ❌ | — | TUI mint address |

## Docker Compose — Service Dependency Graph

```
                ┌──────────────┐
                │  PostgreSQL   │
                │  :5432        │
                └──────┬───────┘
                       │ healthcheck
          ┌────────────┼────────────┐
          │            │            │
    ┌─────▼─────┐ ┌────▼─────┐ ┌───▼──────┐
    │  Indexer  │ │  Mint   │ │Compliance │
    │           │ │  Service │  │ Service   │
    │  WS sub   │ │  :3001   │ │  :3002   │
    └───────────┘ └──────────┘ └──────────┘
```
