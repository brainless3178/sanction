# Sanction — Solana Stablecoin Standard

> An open-source, production-grade framework for deploying compliant stablecoins on Solana using **Token-2022 extensions**.

![License](https://img.shields.io/badge/license-MIT-blue)
![Solana](https://img.shields.io/badge/Solana-Token--2022-9945FF)
![Anchor](https://img.shields.io/badge/Anchor-0.30.1-blueviolet)

---

## Overview

**Sanction** (also known as **SSS — Solana Stablecoin Standard**) is a modular framework that allows issuers to deploy stablecoins with institutional-grade controls on the Solana blockchain. It ships with two battle-tested presets (**SSS-1** and **SSS-2**) and a fully customizable extension system, so you can launch anything from a minimal DeFi stablecoin to a fully compliant, regulator-friendly digital dollar.

### Key Features

| Feature | Description |
|---|---|
| **Dual Presets** | SSS-1 (minimal) and SSS-2 (compliant) out of the box |
| **Role-Based Access** | Minter, Burner, Blacklister, Pauser, Seizer roles with quotas |
| **Freeze & Seize** | Individual account freeze, global pause, and fund seizure (SSS-2) |
| **Transfer Hook** | On-chain blacklist enforcement via Token-2022 Transfer Hook (SSS-2) |
| **Permanent Delegate** | Fund recovery / seizure using Token-2022 Permanent Delegate (SSS-2) |
| **Oracle Integration** | Switchboard price feeds for fiat-to-token calculations (bonus module) |
| **24h Authority Timelock** | Two-step master authority transfer with 24-hour delay |
| **Full Audit Trail** | On-chain events + off-chain PostgreSQL indexer for complete audit history |
| **TypeScript SDK** | `@stbr/sss-token` — ergonomic client library with preset support |
| **CLI** | `sss` command-line tool for all token operations |
| **Backend Services** | Mint Service API (port 3001), Compliance Service API (port 3002), Indexer |
| **React Dashboard** | Web UI for creating, managing, and monitoring stablecoins |
| **TUI Dashboard** | Terminal-based monitoring interface |
| **Privacy Module** | Experimental confidential transfers (bonus) |

---

## Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Rust | 1.75+ |
| Solana CLI | 1.18.17+ |
| Anchor | 0.30.1 |
| Node.js | 18+ |
| pnpm | 8+ |
| Docker | 24+ (for backend services) |
| PostgreSQL | 16+ (or use Docker) |

### 1. Clone & Install

```bash
git clone https://github.com/brainless3178/sanction.git
cd sanction
pnpm install
```

### 2. Build the Solana Programs

```bash
anchor build
```

This compiles four programs:

| Program | ID |
|---|---|
| `sss-token` | `2rERwq2PwRJf38WUrbgkr8qHK1gxbCFmL6vz2jJKs9no` |
| `transfer-hook` | `8q1UWafjPK3JuYwiqFcQcfVYzns8zAxsEzT33kokceJ` |
| `oracle-module` | `Hx8AXzQd8eh5Z7VFTE6uRrk5Zm3WMTYLrMAFu61hbWj5` |
| `sss-private` | `2tDW4FHJhSe1Pm3qsReDDDd228dzcGKpkuEkc7yJFxLv` |

### 3. Start Local Validator + Deploy

```bash
# Start local Solana validator
solana-test-validator

# Deploy to localnet
anchor deploy
```

### 4. Run the Backend Services

```bash
# Start PostgreSQL, Indexer, Mint Service, and Compliance Service
docker compose up -d
```

Services will be available at:
- **Mint Service API**: `http://localhost:3001`
- **Compliance Service API**: `http://localhost:3002`
- **PostgreSQL**: `localhost:5432`

### 5. Run the Demo Scripts

```bash
# SSS-1 minimal demo
bash scripts/demo-sss1.sh

# SSS-2 compliant demo (with blacklist, freeze, seize)
bash scripts/demo-sss2.sh
```

### 6. Launch the Frontend

```bash
cd frontend
pnpm dev
```

### 7. Run Tests

```bash
# Unit tests (no validator needed)
cd tests && npm run test:unit

# Integration tests (requires local validator)
anchor test

# Fuzz tests
cd tests/fuzz/sss-token && cargo run
```

---

## Preset Comparison

| Capability | SSS-1 (Minimal) | SSS-2 (Compliant) | Custom |
|---|:---:|:---:|:---:|
| Mint / Burn | ✅ | ✅ | ✅ |
| Role-Based Access (Minter, Burner, Pauser) | ✅ | ✅ | ✅ |
| Minter Quotas (24h rolling) | ✅ | ✅ | ✅ |
| Global Pause | ✅ | ✅ | ✅ |
| Individual Account Freeze | ✅ | ✅ | ✅ |
| Authority Timelock (24h) | ✅ | ✅ | ✅ |
| On-chain Blacklist | ❌ | ✅ | Configurable |
| Transfer Hook Enforcement | ❌ | ✅ | Configurable |
| Permanent Delegate (Seize) | ❌ | ✅ | Configurable |
| Default Frozen Accounts | ❌ | ❌ | Configurable |

### When to Use Which?

- **SSS-1**: DeFi-native stablecoins, community tokens, or any use case where simplicity and permissionlessness are priorities.
- **SSS-2**: Institutional, regulated stablecoins (e.g., USD-backed) where compliance, blacklisting, and fund recovery are legally required.
- **Custom**: Mix-and-match features for specialized use cases.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          SOLANA BLOCKCHAIN                               │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │   sss-token      │  │  transfer-hook   │  │   oracle-module        │  │
│  │   (Core Program) │←─│  (Blacklist      │  │   (Switchboard Price   │  │
│  │                  │  │   Enforcement)   │  │    Feeds)              │  │
│  │  • Initialize    │  └──────────────────┘  └────────────────────────┘  │
│  │  • Mint / Burn   │                                                    │
│  │  • Freeze / Thaw │  ┌──────────────────┐                              │
│  │  • Pause         │  │  sss-private     │                              │
│  │  • Roles         │  │  (Confidential   │                              │
│  │  • Blacklist     │  │   Transfers)     │                              │
│  │  • Seize         │  └──────────────────┘                              │
│  │  • Authority Xfe │                                                    │
│  └──────────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────────┘
         ▲                          ▲                         ▲
         │  RPC / WebSocket         │                         │
         │                          │                         │
┌────────┴──────────┐   ┌──────────┴──────────┐   ┌─────────┴────────────┐
│   TypeScript SDK  │   │     CLI (sss)       │   │    React Frontend    │
│  @stbr/sss-token  │   │  init, mint, burn,  │   │  Create / Manage /   │
│                   │   │  freeze, pause,     │   │  Compliance Pages    │
│                   │   │  status, supply,    │   │                      │
│                   │   │  minters, blacklist │   │                      │
└───────────────────┘   └─────────────────────┘   └──────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          BACKEND SERVICES                                │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐   ┌──────────────────────────┐ │
│  │   Indexer       │  │Mint Service     │   │   Compliance Service     │ │
│  │  (Event Listener│  │  API (:3001)    │   │   API (:3002)            │ │
│  │    + Parser)    │  │  POST /api/mint │   │   /api/blacklist/*       │ │
│  └────────┬────────┘  └────────┬────────┘   │   /api/audit             │ │
│           │                    │            │   /api/blacklist/screen  │ │
│           ▼                    ▼            └──────────┬───────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     PostgreSQL (sss_token DB)                       │ │
│  │  • mint_requests  • events  • blacklist  • webhooks  • processed_   │ │
│  │                                                         slots       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
sanction/
├── programs/
│   ├── sss-token/          # Core stablecoin Anchor program
│   ├── transfer-hook/      # Token-2022 Transfer Hook (blacklist enforcement)
│   ├── oracle-module/      # Switchboard price feed integration
│   └── sss-private/        # Confidential transfers (experimental)
├── sdk/
│   └── typescript/         # @stbr/sss-token TypeScript SDK
├── cli/                    # CLI tool (sss command)
├── backend/
│   ├── shared/             # Shared DB client, logger, schema
│   ├── indexer/            # On-chain event indexer
│   ├── mint-service/       # Mint request API (Fastify)
│   └── compliance/         # Blacklist + audit API (Fastify)
├── frontend/               # React + Vite dashboard
├── tui/                    # Terminal UI dashboard
├── tests/                  # Unit + integration + fuzz tests
├── scripts/                # Deploy and demo scripts
├── deployments/            # Devnet deployment metadata
├── md files/               # Phase-by-phase build instructions
├── Anchor.toml             # Anchor workspace config
├── Cargo.toml              # Rust workspace manifest
├── docker-compose.yml      # Backend service orchestration
└── pnpm-workspace.yaml     # pnpm monorepo config
```

---

## Documentation Index

| Document | Contents |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layer model, data flows, security model |
| [SDK.md](./SDK.md) | Presets, custom configs, TypeScript examples |
| [OPERATIONS.md](./OPERATIONS.md) | Operator runbook (mint, freeze, seize, etc.) |
| [SSS-1.md](./SSS-1.md) | Minimal stablecoin standard specification |
| [SSS-2.md](./SSS-2.md) | Compliant stablecoin standard specification |
| [COMPLIANCE.md](./COMPLIANCE.md) | Regulatory considerations, audit trail format |
| [API.md](./API.md) | Backend API reference |

---

## License

MIT
