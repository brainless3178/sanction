# Phase 2: Core State and PDAs (sss-token)

**Objective:** Define the strict on-chain structures required to operate the stablecoin.

## Tasks To Complete
1. **`state/config.rs`:** 
   - Implement the `StablecoinConfig` PDA structure holding token properties and flags (`enable_permanent_delegate`, `enable_transfer_hook`, global `is_paused`).
   - Hardcode PDA derivation parameters: `[b"config", mint.key().as_ref()]`.
2. **`state/roles.rs`:**
   - Define the `RoleType` enumeration (Minter, Burner, Blacklister, Pauser, Seizer).
   - Implement `RoleAssignment` structure for PDA storage. Map the daily quota logic properties (`minted_this_period`, `period_start`).
   - Setup PDA derivation: `[b"role", mint.key().as_ref(), account.key().as_ref(), role_discriminator]`.
3. **`state/blacklist.rs`:**
   - Create the `BlacklistEntry` struct enforcing maximum string reasoning (128 chars).
   - Maintain existence validation logic for the PDA `[b"blacklist", mint.key().as_ref(), target.key().as_ref()]`.
4. **`errors.rs`:**
   - Explicitly list all `SssError` codes matching the architectural expectations over authority, validation, and transfer hook boundaries.
5. **`events.rs`:**
   - Map out all 13 necessary Anchor `#[event]` macros so the Indexer service will function correctly. 
