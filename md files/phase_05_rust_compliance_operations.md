# Phase 5: SSS-2 Compliance Operations (sss-token)

**Objective:** Inject robust institutional bounds for regulated use cases over Blacklists and Seizing.

## Tasks To Complete
1. **`instructions/blacklist.rs`:** 
   - Define operations enabling addresses to be mapped directly onto the `BlacklistEntry` space on-chain.
   - Restrict instructions uniquely to wallets possessing the `Blacklister` role validation trait.
   - Enforce reasons mapping into strictly capped byte constraints. Add removals.
2. **`instructions/seize.rs`:**
   - Confirm program states have `enable_permanent_delegate` flagged to strictly valid true responses.
   - Validate executor authority possesses `Seizer` permissions actively.
   - Using PDA signing mechanics mapped onto the permanent delegate, perform instantaneous transfers seizing resources back to the master configuration address.
   - Emit `FundsSeized` for the audit stream logs.
