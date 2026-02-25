# Phase 4: Core Token Operations (sss-token)

**Objective:** Provide essential functional abilities to Mint, Burn, Freeze, Pause, and configure roles.

## Tasks To Complete
1. **`instructions/mint.rs`:** Verify `is_paused` false flags globally. Trigger `RoleAssignment` quota checks against mathematical daily limit bounds. Append changes using integer collision guards `checked_add()`.
2. **`instructions/burn.rs`:** Remove configurations securely checking `checked_sub` and decrement circulating counters on the master tracker.
3. **`instructions/freeze.rs` & `instructions/thaw.rs`:** Implement freezing routines to govern standard SPL account behaviors.
4. **`instructions/pause.rs`:** Formulate system-wide pauses modifying `StablecoinConfig.is_paused`.
5. **`instructions/roles.rs`:** Build creation and invalidation endpoints providing administration bounds over Minter quotas.

## Technical Details
- Must not contain `unwrap()` calls. 
- Must drop typed events across all structural mutations (e.g., `TokensMinted`, `RoleAssigned`).
