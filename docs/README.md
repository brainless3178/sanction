# Solana Stablecoin Standard (SSS)

A production-grade framework for issuing regulated stablecoins on Solana using Token-2022 extensions.

## Overview

SSS provides two compliance presets:

| Preset | Extensions Used | Use Case |
|--------|----------------|----------|
| **SSS-1** | MetadataPointer, MintCloseAuthority | Minimal stablecoin — mint, burn, freeze, pause |
| **SSS-2** | All of SSS-1 + PermanentDelegate + TransferHook | Full compliance — blacklist, seize, transfer blocking |

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
anchor build

# 3. Deploy to devnet
bash scripts/deploy-devnet.sh

# 4. Run demos
bash scripts/demo-sss1.sh
bash scripts/demo-sss2.sh
```

## SDK Usage

```typescript
import { SolanaStablecoin, SSS2_PRESET } from '@stbr/sss-token';

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

// Compliance: Blacklist
await stable.compliance.blacklistAdd(badActor, 'OFAC match', authority);

// Compliance: Seize
await stable.compliance.seize(badActor, treasury, authority);
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

- [Architecture](./ARCHITECTURE.md) — System design, PDA maps, data flow
- [Parameter Flows](./PARAMETER_FLOWS.md) — Complete instruction/account/API parameter specification
- [SDK Reference](./SDK.md) — TypeScript SDK API
- [Operations Guide](./OPERATIONS.md) — Step-by-step operator procedures
- [SSS-1 Specification](./SSS-1.md) — Minimal stablecoin preset
- [SSS-2 Specification](./SSS-2.md) — Compliant stablecoin preset
- [Compliance Guide](./COMPLIANCE.md) — Blacklist, seize, audit procedures
- [API Reference](./API.md) — REST API endpoints

## Security

- All arithmetic uses `checked_add`/`checked_sub` — no overflow possible
- Authority transfers use 24-hour timelock
- Minter quotas enforced on-chain with daily period reset
- Transfer Hook validates blacklist PDA existence (not off-chain data)
- Permanent Delegate PDA is program-controlled — no human holds the key
- Webhook payloads signed with HMAC-SHA256

## License

MIT
