# TypeScript SDK Reference

## Installation

```bash
npm install @stbr/sss-token @coral-xyz/anchor @solana/web3.js @solana/spl-token
```

## Quick Start

```typescript
import { SolanaStablecoin, resolvePreset } from '@stbr/sss-token';
import { Connection, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const wallet = new Wallet(authorityKeypair);
const provider = new AnchorProvider(connection, wallet, {});
```

## Core API

### `SolanaStablecoin.create(connection, provider, program, params)`

Create a new stablecoin.

```typescript
const stable = await SolanaStablecoin.create(connection, provider, program, {
    preset: 'SSS_2',       // 'SSS_1' | 'SSS_2'
    name: 'Test USD',       // max 32 chars
    symbol: 'TUSD',         // max 10 chars
    decimals: 6,            // max 9
    authority: authorityKeypair,
});
```

### `SolanaStablecoin.load(connection, provider, program, mintAddress)`

Load an existing stablecoin.

```typescript
const stable = await SolanaStablecoin.load(connection, provider, program, mintAddress);
```

### `stable.mint(params)`

Mint tokens to a recipient.

```typescript
const txSig = await stable.mint({
    recipient: recipientPublicKey,  // PublicKey
    amount: BigInt(1_000_000),      // bigint (raw units)
    minter: minterKeypair,          // Keypair
});
```

### `stable.burn(params)`

Burn tokens from the authority's account.

```typescript
const txSig = await stable.burn({
    amount: BigInt(500_000),
    burner: authorityKeypair,
});
```

### `stable.freeze(tokenAccount, authority)`

Freeze a token account.

```typescript
const txSig = await stable.freeze(tokenAccountAddress, authorityKeypair);
```

### `stable.thaw(tokenAccount, authority)`

Unfreeze a token account.

```typescript
const txSig = await stable.thaw(tokenAccountAddress, authorityKeypair);
```

### `stable.pause(authority)` / `stable.unpause(authority)`

Toggle global pause.

```typescript
await stable.pause(authorityKeypair);
await stable.unpause(authorityKeypair);
```

### `stable.updateMinter(minter, quota, authority)`

Add or update a minter with a daily quota.

```typescript
await stable.updateMinter(
    minterPublicKey,
    BigInt(1_000_000_000_000), // quota in raw units
    authorityKeypair,
);
```

### `stable.revokeMinter(minter, authority)`

Remove a minter's role.

```typescript
await stable.revokeMinter(minterPublicKey, authorityKeypair);
```

## Compliance API (SSS-2 only)

Available via `stable.compliance` when `enableTransferHook` is true.

### `stable.compliance.blacklistAdd(address, reason, authority)`

```typescript
await stable.compliance.blacklistAdd(
    targetPublicKey,
    'OFAC match',
    authorityKeypair,
);
```

### `stable.compliance.blacklistRemove(address, authority)`

```typescript
await stable.compliance.blacklistRemove(targetPublicKey, authorityKeypair);
```

### `stable.compliance.isBlacklisted(address)`

```typescript
const isBanned: boolean = await stable.compliance.isBlacklisted(targetPublicKey);
```

### `stable.compliance.getBlacklist()`

```typescript
const entries: BlacklistEntry[] = await stable.compliance.getBlacklist();
```

### `stable.compliance.seize(source, destination, authority, amount?)`

```typescript
// Seize all funds
await stable.compliance.seize(source, treasury, authority);

// Seize specific amount
await stable.compliance.seize(source, treasury, authority, BigInt(500_000));
```

## Event Subscriptions

### `stable.onMint(callback)`

```typescript
const unsub = stable.onMint((event) => {
    console.log('Minted:', event.amount, 'to', event.recipient);
});
// Later: unsub();
```

### `stable.onFreeze(callback)`

```typescript
const unsub = stable.onFreeze((event) => {
    console.log('Frozen:', event.account);
});
```

### `stable.onBlacklist(callback)`

```typescript
const unsub = stable.onBlacklist((event) => {
    console.log('Blacklisted:', event.target, 'reason:', event.reason);
});
```

## Presets

```typescript
import { SSS1_PRESET, SSS2_PRESET, resolvePreset } from '@stbr/sss-token';

// SSS1_PRESET = { enablePermanentDelegate: false, enableTransferHook: false }
// SSS2_PRESET = { enablePermanentDelegate: true,  enableTransferHook: true  }

const config = resolvePreset('SSS_2');
```

## Types

All types are exported from the main entry point:

```typescript
import type {
    CreateParams,
    MintParams,
    BurnParams,
    SupplyInfo,
    BlacklistEntry,
    StablecoinEvent,
} from '@stbr/sss-token';
```
