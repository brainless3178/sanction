# Solana Stablecoin Standard — Project Status

## Program Deployments

| Program | Devnet Address | Status |
|---------|---------------|--------|
| sss-token (Core) | `2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no` | ✅ Deployed |
| transfer-hook | `8q1UWafjPK3JuYwiqFcQcfVYzns8zAxsEzT33kokceJ` | ✅ Deployed |
| oracle-module | `Hx8AXzQd8eh5Z7VFTE6uRrk5Zm3WMTYLrMAFu61hbWj5` | ✅ Deployed |
| sss-private | `2tDW4FHJhSe1Pm3qsReDDDd228dzcGKpkuEkc7yJFxLv` | ✅ Deployed |

**Deploy Authority:** `BWJEK2svMyD4riumKVubNrhihn9qfFa1agYzZH5yETW2`
**Deployed:** 2026-02-25

## Preset Variants

| Preset | Extensions | Use Case | Status |
|--------|-----------|----------|--------|
| SSS-1 | MetadataPointer, MintCloseAuthority | Minimal stablecoin | ✅ Ready |
| SSS-2 | SSS-1 + PermanentDelegate + TransferHook | Full compliance | ✅ Ready |

## Instructions

| Instruction | SSS-1 | SSS-2 | Description |
|-------------|-------|-------|-------------|
| initialize | ✓ | ✓ | Create stablecoin with selected extensions |
| mint | ✓ | ✓ | Mint tokens (minter role + quota enforced) |
| burn | ✓ | ✓ | Burn tokens (burner role required) |
| freeze | ✓ | ✓ | Freeze a token account |
| thaw | ✓ | ✓ | Thaw a frozen account |
| set_pause | ✓ | ✓ | Global pause/unpause |
| assign_role | ✓ | ✓ | Assign minter/burner/pauser/blacklister/seizer |
| revoke_role | ✓ | ✓ | Revoke a role |
| add_to_blacklist | ✗ | ✓ | Blacklist an address (on-chain reason) |
| remove_from_blacklist | ✗ | ✓ | Remove from blacklist |
| seize | ✗ | ✓ | Seize funds via permanent delegate |
| initiate_transfer_authority | ✓ | ✓ | Start 24h timelock authority transfer |
| accept_transfer_authority | ✓ | ✓ | Accept after timelock elapsed |
| cancel_transfer_authority | ✓ | ✓ | Cancel pending transfer |

## Test Coverage

| Test File | Tests | Description |
|-----------|-------|-------------|
| tests/integration/sss1-flow.ts | 11 | Full SSS-1 lifecycle |
| tests/integration/sss2-flow.ts | 11 | Full SSS-2 compliance flow |

## SDK Exports

```typescript
// Core client
SolanaStablecoin.create()    // Deploy new stablecoin
SolanaStablecoin.load()      // Load existing stablecoin
.mint()                       // Mint tokens
.burn()                       // Burn tokens
.freeze() / .thaw()          // Account freeze control
.pause() / .unpause()        // Global pause
.updateMinter()              // Assign minter role
.revokeMinter()              // Revoke minter role
.getSupply()                 // Query supply info
.getConfig()                 // Query on-chain config
.getMinters()                // Query all minters
.initiateTransferAuthority() // Start authority transfer
.acceptTransferAuthority()   // Accept after timelock
.cancelTransferAuthority()   // Cancel pending transfer

// Events
.onMint()                    // Subscribe to mint events
.onFreeze()                  // Subscribe to freeze/thaw events
.onBlacklist()               // Subscribe to blacklist events

// Compliance (SSS-2 only)
.compliance.blacklistAdd()   // Add to blacklist
.compliance.blacklistRemove()// Remove from blacklist
.compliance.isBlacklisted()  // Check blacklist status
.compliance.seize()          // Seize funds
```

## Backend Services

| Service | Port | Status |
|---------|------|--------|
| Mint Service | 3001 | ✅ Ready |
| Compliance API | 3002 | ✅ Ready |
| Indexer | — | ✅ Ready |
| PostgreSQL | 5432 | ✅ Schema ready |

## Frontend

- React + Vite dashboard at `localhost:5173`
- Pages: Create, Manage, Compliance
- Real-time event subscription via WebSocket

## Security Features

- ✅ Checked arithmetic throughout (no overflow)
- ✅ 24-hour timelock on authority transfers
- ✅ On-chain minter quotas with daily period reset
- ✅ Transfer hook enforces blacklist (PDA existence check)
- ✅ Permanent delegate is program-controlled PDA
- ✅ Global pause mechanism
- ✅ Role-based access control (5 role types)
