# Solana Stablecoin Standard (SSS)

A production-grade framework for issuing regulated stablecoins on Solana using Token-2022 extensions.

## Overview

SSS provides two compliance presets:

| Preset | Extensions Used | Use Case |
|--------|----------------|----------|
| **SSS-1** | MetadataPointer, MintCloseAuthority | Minimal stablecoin — mint, burn, freeze, pause |
| **SSS-2** | All of SSS-1 + PermanentDelegate + TransferHook | Full compliance — blacklist, seize, transfer blocking |

## Program IDs

| Program | Devnet |
|---------|--------|
| sss-token (Core) | `2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no` |
| transfer-hook | `8q1UWafjPK3JuYwiqFcQcfVYzns8zAxsEzT33kokceJ` |
| oracle-module | `Hx8AXzQd8eh5Z7VFTE6uRrk5Zm3WMTYLrMAFu61hbWj5` |
| sss-private | `2tDW4FHJhSe1Pm3qsReDDDd228dzcGKpkuEkc7yJFxLv` |

## Repository Structure

```
├── programs/
│   ├── sss-token/          # Core Anchor program
│   ├── transfer-hook/      # SPL Transfer Hook program
│   ├── oracle-module/      # Switchboard oracle price feeds
│   └── sss-private/        # Confidential transfer module (experimental)
├── sdk/typescript/         # TypeScript SDK
├── cli/                    # Command-line interface
├── tui/                    # Terminal UI dashboard (ink)
├── frontend/               # Web dashboard (React + Vite)
├── backend/
│   ├── shared/             # Database schema, client, logger
│   ├── indexer/            # On-chain event listener + webhooks
│   ├── mint-service/       # Fiat-to-stablecoin REST API
│   └── compliance/         # Compliance verification API
├── tests/
│   ├── integration/        # SSS-1 and SSS-2 flow tests
│   └── fuzz/               # Trident fuzz tests
├── scripts/                # Deploy and demo scripts
├── deployments/            # Network deployment artifacts
└── docs/                   # Documentation
```

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Build Rust programs
anchor build --no-idl

# 3. Deploy to devnet
solana program deploy target/deploy/sss_token.so --program-id target/deploy/sss_token-keypair.json --url devnet
solana program deploy target/deploy/transfer_hook.so --program-id target/deploy/transfer_hook-keypair.json --url devnet
solana program deploy target/deploy/oracle_module.so --program-id target/deploy/oracle_module-keypair.json --url devnet
solana program deploy target/deploy/sss_private.so --program-id target/deploy/sss_private-keypair.json --url devnet

# 4. Run demos
npx ts-node scripts/demo-sss2.ts
```

## SDK Usage

```typescript
import { SolanaStablecoin } from '@stbr/sss-token';

// Create a new SSS-2 compliant stablecoin
const stable = await SolanaStablecoin.create(connection, provider, program, {
    preset: 'SSS_2',
    name: 'Test USD',
    symbol: 'TUSD',
    decimals: 6,
    authority: authorityKeypair,
});

// Mint tokens
await stable.mint({
    recipient: userPublicKey,
    amount: BigInt(1_000_000_000), // 1000 tokens
    minter: minterKeypair,
});

// Query supply
const supply = await stable.getSupply();
console.log(`Circulating: ${supply.circulating}`);

// Compliance: Blacklist
await stable.compliance.blacklistAdd(badActor, 'OFAC match', authority);

// Compliance: Seize
await stable.compliance.seize(badActor, treasury, authority);

// Authority transfer (24h timelock)
await stable.initiateTransferAuthority(newAuthority, currentAuthority);
// ... 24 hours later ...
await stable.acceptTransferAuthority(newAuthorityKeypair);
```

## Backend Services

Start all services with Docker:

```bash
docker compose up -d
```

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Shared database |
| Mint Service | 3001 | `POST /api/mint` |
| Compliance | 3002 | `GET /api/blacklist`, `GET /api/audit` |

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — System design, PDA maps, data flow
- [Parameter Flows](./docs/PARAMETER_FLOWS.md) — Complete instruction/account/API parameter specification
- [SDK Reference](./docs/SDK.md) — TypeScript SDK API
- [Operations Guide](./docs/OPERATIONS.md) — Step-by-step operator procedures
- [SSS-1 Specification](./docs/SSS-1.md) — Minimal stablecoin preset
- [SSS-2 Specification](./docs/SSS-2.md) — Compliant stablecoin preset
- [Compliance Guide](./docs/COMPLIANCE.md) — Blacklist, seize, audit procedures
- [API Reference](./docs/API.md) — REST API endpoints

## Security

- All arithmetic uses `checked_add`/`checked_sub` — no overflow possible
- Authority transfers use 24-hour timelock
- Minter quotas enforced on-chain with daily period reset
- Transfer Hook validates blacklist PDA existence (not off-chain data)
- Permanent Delegate PDA is program-controlled — no human holds the key
- Webhook payloads signed with HMAC-SHA256

## License

MIT
