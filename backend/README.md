# Sanction Backend Services

The **Sanction Backend Services** form the off-chain infrastructure required to support high-throughput minting, indexing, and compliance auditing for Solana Stablecoin Standard (SSS) tokens. 

While SSS tokens can operate entirely client-to-chain without these services, this backend stack provides the caching, API abstraction, and enterprise-grade auditing necessary for institutional deployments.

## Architecture Overview

The backend is composed of several microservices, all sharing a common database and core logging libraries.

### 1. `indexer/`
Listens to the Solana blockchain via WebSockets (`onLogs` and `onAccountChange`). 
- Validates and parses Anchorage events (e.g., `TokensMinted`, `AddedToBlacklist`).
- Persists historical event data to the database, ensuring that frontends can query audit trails without making expensive or rate-limited RPC calls.
- Triggers webhooks for off-chain enterprise integrations.

### 2. `mint-service/`
A REST API designed to bridge fiat deposits with on-chain stablecoin minting.
- Provides an endpoint (`POST /api/mint`) that accepts secure requests.
- Wraps the Anchor `mint_tokens` instruction, signing transactions using a designated backend `Minter` Keypair.
- Writes lifecycle updates (Pending -> Executing -> Success/Failed) to the database to ensure idempotency.

### 3. `compliance/`
A REST API strictly tailored for regulatory and auditing functions.
- Provides endpoints like `GET /api/blacklist` and `GET /api/audit`.
- Serves aggregated historical data parsed by the indexer.
- Crucial for serving data seamlessly to the frontend dashboard.

### 4. `shared/`
Contains common libraries used by all backend services:
- **Prisma/PostgreSQL schema configuration**.
- Standardized Pino JSON loggers.
- Reusable database connection utilities.

## Setup & Deployment

Dependencies are managed at the root, but to set up the backend specifically:

### 1. Database Initialization

Ensure you have a PostgreSQL database running (e.g., via Docker):

```bash
cd backend
# Create a .env file containing DATABASE_URL
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/sanction" > .env
```

Apply the database schema (from the shared module):

```bash
cd shared
pnpm exec prisma db push
```

### 2. Running Services Locally

You can run the services individually for debugging:

**Start the Indexer:**
```bash
cd indexer
pnpm dev
```

**Start the Mint Service (Port 3001):**
```bash
cd mint-service
export AUTHORITY_KEYPAIR_PATH="~/.config/solana/id.json"
pnpm dev
```

**Start the Compliance API (Port 3002):**
```bash
cd compliance
pnpm dev
```

## Security Considerations

- The **Mint Service** requires access to a highly sensitive hot wallet (holding the `Minter` role). In a production environment, this should be isolated utilizing Hardware Security Modules (HSMs) or secure cloud KMS solutions instead of raw filesystem JSON keypairs.
- All internal API communications should be locked down inside a VPC.
