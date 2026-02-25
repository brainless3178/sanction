# SSS-1 Specification — Minimal Stablecoin

## Overview

SSS-1 is the minimal stablecoin preset. It provides the core functionality needed to issue and manage a stablecoin on Solana without compliance-specific features.

## Token-2022 Extensions

| Extension | Enabled | Purpose |
|-----------|---------|---------|
| MetadataPointer | ✅ | On-chain token metadata (name, symbol, URI) |
| MintCloseAuthority | ✅ | Allow closing the mint when supply is zero |
| PermanentDelegate | ❌ | Not needed — no fund seizure |
| TransferHook | ❌ | Not needed — no blacklist enforcement |

## Available Instructions

| Instruction | Description |
|------------|-------------|
| `initialize` | Create the mint with SSS-1 extensions |
| `mint` | Mint tokens to a recipient (minter role required) |
| `burn` | Burn tokens (burner role required) |
| `freeze` | Freeze a token account |
| `thaw` | Unfreeze a token account |
| `pause` / `unpause` | Toggle global pause (pauser role required) |
| `assign_role` | Grant a role (Minter, Burner, Pauser) |
| `revoke_role` | Remove a role |

## Roles

| Role | Capabilities |
|------|-------------|
| Master | All operations, assign/revoke any role |
| Minter | Mint tokens (subject to daily quota) |
| Burner | Burn tokens |
| Pauser | Toggle global pause |

## Quota System

- Each minter has a daily quota (`limit` field on `RoleAssignment` PDA)
- Tracked via `minted_this_period` + `period_start` fields
- Period resets automatically after 24 hours
- Setting quota to `0` means unlimited

## PDA Layout

```
StablecoinConfig: ["config", mint]
RoleAssignment:   ["role", mint, account, role_type]
```

## Limitations

- No blacklist support
- No fund seizure
- No transfer-time validation
- Suitable for internal/test stablecoins, not regulated markets
