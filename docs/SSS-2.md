# SSS-2 Specification — Compliant Stablecoin

## Overview

SSS-2 is the full compliance stablecoin preset. It extends SSS-1 with institutional controls: blacklisting, fund seizure, and transfer-time enforcement via the Transfer Hook program.

## Token-2022 Extensions

| Extension | Enabled | Purpose |
|-----------|---------|---------|
| MetadataPointer | ✅ | On-chain token metadata |
| MintCloseAuthority | ✅ | Allow closing the mint |
| PermanentDelegate | ✅ | Enable fund seizure via PDA-controlled delegate |
| TransferHook | ✅ | Blacklist enforcement on every transfer |

## Additional Instructions (beyond SSS-1)

| Instruction | Program | Description |
|------------|---------|-------------|
| `blacklist_add` | sss-token | Add address to blacklist (Blacklister role) |
| `blacklist_remove` | sss-token | Remove address from blacklist |
| `seize` | sss-token | Seize funds via permanent delegate (Seizer role) |
| `execute` | transfer-hook | Transfer-time blacklist check |
| `initialize_extra_account_meta_list` | transfer-hook | Register extra accounts for hook |

## Additional Roles

| Role | Capabilities |
|------|-------------|
| Blacklister | Add/remove addresses from blacklist |
| Seizer | Seize funds from blacklisted accounts |

## Blacklist Mechanism

### On-Chain (PDA existence check)
```
BlacklistEntry PDA: ["blacklist", mint, target]
```

- Adding to blacklist = create the PDA (with reason, max 128 chars)
- Removing from blacklist = close the PDA
- Transfer Hook checks if PDA exists (lamports > 0)

### Off-Chain (DB mirror)
- Indexer automatically mirrors on-chain blacklist changes to PostgreSQL
- Compliance API provides REST endpoints for querying
- Audit trail exported as CSV/JSON

## Seize Mechanism

1. Verify `enable_permanent_delegate == true`
2. Verify caller has `Seizer` role
3. Derive Permanent Delegate PDA
4. CPI into `spl_token_2022::TransferChecked` using PDA as delegate signer
5. Transfer specified amount (or full balance) to destination
6. Emit `FundsSeized` event

### Security: PDA-Controlled Delegate

The permanent delegate is a PDA derived from the program. No human holds its private key. The program signs on its behalf only when a valid `Seizer` calls the `seize` instruction.

## Transfer Hook Flow

Every SPL transfer for an SSS-2 token triggers the Transfer Hook:

```
1. Token-2022 initiates transfer
2. Invokes transfer-hook::execute()
3. Hook reads StablecoinConfig (cross-program PDA)
   → Check: is_paused? → Error: GlobalPause
4. Hook checks source BlacklistEntry PDA
   → lamports > 0? → Error: SourceBlacklisted  
5. Hook checks destination BlacklistEntry PDA
   → lamports > 0? → Error: DestinationBlacklisted
6. All checks pass → Transfer completes
```

## Audit Trail

All compliance events are captured:

| Event | Emitted When |
|-------|-------------|
| `AddedToBlacklist` | Address blacklisted |
| `RemovedFromBlacklist` | Address removed |
| `FundsSeized` | Funds seized from account |

These events are:
1. Emitted on-chain via Anchor `emit!()`
2. Captured by the Indexer service
3. Stored in PostgreSQL `events` table
4. Available via Compliance API (`GET /api/audit`)
5. Exportable as CSV for regulatory reporting
