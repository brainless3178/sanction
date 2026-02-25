# Sanction SDK (`@sanction/sss-sdk`)

The **Sanction SDK** is a fully-typed, robust TypeScript library for interacting with Solana Stablecoin Standard (SSS) smart contracts. It abstracts away the complexity of Anchor, PDA derivation, and Token-2022 extensions into a streamlined, developer-friendly interface.

## Installation

If you are using this inside the monorepo, it is linked via workspace. For external usage:

```bash
npm install @sanction/sss-sdk
# or
pnpm add @sanction/sss-sdk
```

## Peer Dependencies

Ensure your project also has these installed:

```bash
pnpm add @solana/web3.js @coral-xyz/anchor @solana/spl-token
```

## Core Abstractions

The SDK centers around the `SolanaStablecoin` class, which acts as the primary controller for a specific mint.

### Instantiating the Client

```typescript
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { SolanaStablecoin } from '@sanction/sss-sdk';

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const authorityWallet = new Wallet(Keypair.fromSecretKey(...));
const provider = new AnchorProvider(connection, authorityWallet, {});

// Load an existing stablecoin
const mintAddress = new PublicKey("...");
const stablecoin = await SolanaStablecoin.load(connection, provider, program, mintAddress);
```

## Standard Operations

### Deploying a New Stablecoin
Deploy a fully compliant SSS-2 stablecoin with Permanent Delegate and Transfer Hook active:

```typescript
const newStablecoin = await SolanaStablecoin.create(connection, provider, program, {
    preset: 'SSS_2',
    name: 'Sanction USD',
    symbol: 'SUSD',
    decimals: 6,
    authority: authorityWallet.payer,
});

console.log(`Deployed Mint at: ${newStablecoin.mintAddress.toBase58()}`);
```

### Minting and Burning
Note: The signer must hold the `Minter` or `Burner` role on-chain.

```typescript
// Mint 100 SUSD (assuming 6 decimals)
await stablecoin.mint({
    recipient: userPublicKey,
    amount: BigInt(100_000_000), 
    minter: authorityWallet.payer, // Requires Minter role
});

// Burn 50 SUSD
await stablecoin.burn({
    amount: BigInt(50_000_000),
    burner: authorityWallet.payer, // Requires Burner role
});
```

## Compliance & Enforcement (SSS-2)

The `.compliance` namespace houses tools specifically required by SSS-2 deployments for regulatory enforcement.

```typescript
// Add strictly sanctioned entity to blacklist preventing all transfers
await stablecoin.compliance.blacklistAdd(
    badActorPublicKey, 
    "OFAC Match ID #12345", 
    complianceOfficer // Requires Blacklister role
);

// Seize illicit funds and route them to treasury
await stablecoin.compliance.seize(
    badActorPublicKey, 
    treasuryPublicKey, 
    complianceOfficer // Requires Seizer/Master Authority role
);
```

## Querying State

Read on-chain states effortlessly without compiling manual PDA bounds:

```typescript
// Fetch circulating, minted, and burned metrics
const supply = await stablecoin.getSupply();

// Retrieve all assigned minters and their quotas
const minters = await stablecoin.getMinters();

// Grab the raw config PDA data
const config = await stablecoin.getConfig();
```

## Event Streaming

Listen to on-chain changes in real-time. Use the returned function to unsubscribe.

```typescript
const unsubscribe = stablecoin.onBlacklist((event) => {
    console.log(`Address ${event.account.toBase58()} was ${event.action} by ${event.by.toBase58()}`);
});

// Later...
unsubscribe();
```

## Error Handling

The SDK maps standard Anchor errors (`Unauthorized`, `StalePriceFeed`, `QuotaExceeded`, etc.) directly into Javascript errors, ensuring you can `try/catch` and gracefully handle on-chain restrictions.
