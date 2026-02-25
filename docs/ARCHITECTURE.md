# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SOLANA BLOCKCHAIN                         │
│                                                                  │
│  ┌──────────────────┐     ┌───────────────────┐                 │
│  │   sss-token       │     │  transfer-hook     │                │
│  │   Program          │────▶│  Program            │                │
│  │                    │     │                     │                │
│  │  • initialize      │     │  • execute           │                │
│  │  • mint / burn     │     │    (blacklist check) │                │
│  │  • freeze / thaw   │     │  • init_extra_metas  │                │
│  │  • pause           │     └───────────────────┘                │
│  │  • assign_role     │                                          │
│  │  • blacklist_add   │     ┌───────────────────┐                │
│  │  • blacklist_rm    │     │  oracle-module     │                │
│  │  • seize           │     │  • register_feed   │                │
│  └──────────────────┘     │  • get_price       │                │
│                             │  • calc_mint_amt   │                │
│  ┌──────────────────┐     └───────────────────┘                │
│  │   sss-private     │                                          │
│  │  (experimental)    │                                          │
│  │  • confidential    │                                          │
│  │    transfer        │                                          │
│  └──────────────────┘                                            │
└────────────────┬────────────────────────────────────────────────┘
                 │  WebSocket / RPC
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                     BACKEND SERVICES                             │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐          │
│  │   Indexer     │  │ Mint Service  │  │  Compliance   │          │
│  │ (WebSocket)   │  │  (Fastify)    │  │   (Fastify)   │          │
│  │              │  │               │  │               │          │
│  │ • listen      │  │ • POST /mint  │  │ • blacklist   │          │
│  │ • parse       │  │ • GET /mint   │  │ • audit       │          │
│  │ • store       │  │ • lifecycle   │  │ • screening   │          │
│  │ • dispatch    │  │ • quota guard │  │ • CSV export  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                    │
│         └─────────────────┼─────────────────┘                    │
│                           │                                      │
│                  ┌────────▼────────┐                             │
│                  │   PostgreSQL     │                             │
│                  │                  │                             │
│                  │ • mint_requests  │                             │
│                  │ • events         │                             │
│                  │ • webhooks       │                             │
│                  │ • blacklist      │                             │
│                  └─────────────────┘                             │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                                │
│                                                                   │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐  ┌─────┐ │
│  │ TypeScript    │  │     CLI        │  │   Frontend     │  │ TUI │ │
│  │    SDK        │  │  (Commander)   │  │   (React/Vite) │  │(ink)│ │
│  └──────────────┘  └───────────────┘  └────────────────┘  └─────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## PDA Derivation Map

| PDA | Seeds | Program |
|-----|-------|---------|
| StablecoinConfig | `["config", mint]` | sss-token |
| RoleAssignment | `["role", mint, account, role_discriminator]` | sss-token |
| BlacklistEntry | `["blacklist", mint, target]` | sss-token |
| ExtraAccountMetaList | `["extra-account-metas", mint]` | transfer-hook |
| PriceFeed | `["price-feed", mint, currency]` | oracle-module |
| ConfidentialMintConfig | `["confidential-config", mint]` | sss-private |
| ConfidentialAccountConfig | `["confidential-account", mint, owner]` | sss-private |

## Data Flow

### Mint Token Flow
```
User → SDK.mint() → Anchor CPI → sss-token::mint
  │
  ├── Check: is_paused == false
  ├── Check: minter has RoleAssignment PDA
  ├── Check: quota (minted_this_period + amount <= limit)
  ├── CPI: spl_token_2022::MintTo
  ├── Update: config.total_minted += amount
  ├── Update: role.minted_this_period += amount
  └── Emit: TokensMinted event
```

### Transfer Hook Flow
```
User → SPL Transfer → token-2022 → transfer-hook::execute
  │
  ├── Read: StablecoinConfig PDA (cross-program)
  ├── Check: is_paused == false
  ├── Check: source BlacklistEntry PDA (lamports == 0?)
  ├── Check: destination BlacklistEntry PDA (lamports == 0?)
  └── OK or Error(SourceBlacklisted/DestinationBlacklisted)
```

### Seize Flow
```
Authority → SDK.seize() → Anchor CPI → sss-token::seize
  │
  ├── Check: enable_permanent_delegate == true
  ├── Check: authority has Seizer role
  ├── Derive: PermanentDelegate PDA
  ├── CPI: spl_token_2022::TransferChecked (PDA as delegate)
  └── Emit: FundsSeized event
```

## Token-2022 Extensions Used

| Extension | SSS-1 | SSS-2 | Purpose |
|-----------|-------|-------|---------|
| MetadataPointer | ✅ | ✅ | On-chain token metadata |
| MintCloseAuthority | ✅ | ✅ | Allow closing empty mints |
| PermanentDelegate | ❌ | ✅ | Enable fund seizure |
| TransferHook | ❌ | ✅ | Blacklist enforcement on every transfer |

## Security Boundaries

1. **Role-Based Access Control** — Every instruction validates a `RoleAssignment` PDA
2. **Quota Enforcement** — Daily limits tracked on-chain with `checked_add()`
3. **Authority Timelock** — 24-hour delay on master authority changes
4. **PDA-Controlled Delegate** — No human holds the permanent delegate private key
5. **Blacklist via PDA Existence** — Transfer hook checks lamports, not off-chain data
