# Phase 9: TypeScript Compliance & WebSockets Wrapper

**Objective:** Wrap advanced SSS-2 institutional behavior logic.

## Tasks To Complete
1. **`compliance/client.ts`:** Build the robust secondary `ComplianceClient`.
2. Construct APIs controlling:
   - `blacklistAdd(address, reason, authority)`: Sending the mapped transaction execution via PDA derivatives.
   - `blacklistRemove()`: Resolving mapping validations. 
   - `seize(source, dest, authority, amount)`: Supporting partial vs absolute seizes tracking the permanent delegation protocols correctly.
   - `isBlacklisted(address)`: Performing simple RPC lookup checking boolean conditions if the Lamport state exists on-chain.
   - `getBlacklist()`: Resolving Get Program Accounts lookup schemas returning full datasets.
3. Subscribe logic building websockets mappings utilizing on-chain events returning native mapping streams `onMint`, `onFreeze`, `onBlacklist`.
