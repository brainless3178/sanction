# Operations Guide

Step-by-step procedures for stablecoin operators.

## Prerequisites

- Solana CLI installed and configured
- Authority keypair with SOL balance
- Node.js 20+ installed

## 1. Initial Deployment

### 1.1 Build Programs

```bash
anchor build
```

### 1.2 Deploy to Devnet

```bash
bash scripts/deploy-devnet.sh
```

### 1.3 Verify Deployment

```bash
solana program show <program-id>
```

## 2. Initialize a Stablecoin

### SSS-1 (Minimal)

```bash
sss init --name "USD Coin" --symbol "USDC" --decimals 6 --preset SSS_1 \
    --keypair ~/.config/solana/id.json --rpc https://api.devnet.solana.com
```

### SSS-2 (Compliant)

```bash
sss init --name "Test USD" --symbol "TUSD" --decimals 6 --preset SSS_2 \
    --keypair ~/.config/solana/id.json --rpc https://api.devnet.solana.com
```

## 3. Manage Minters

### Add a Minter

```bash
sss minter-add <MINTER_PUBKEY> --quota 1000000000000
```

### Revoke a Minter

```bash
sss minter-revoke <MINTER_PUBKEY>
```

## 4. Token Operations

### Mint Tokens

```bash
sss mint --to <RECIPIENT> --amount 1000000000
```

### Freeze an Account

```bash
sss freeze --account <TOKEN_ACCOUNT>
```

### Thaw an Account

```bash
sss thaw --account <TOKEN_ACCOUNT>
```

## 5. Compliance Operations (SSS-2)

### Blacklist an Address

```bash
sss blacklist-add <ADDRESS> --reason "OFAC match"
```

### Remove from Blacklist

```bash
sss blacklist-remove <ADDRESS>
```

### Seize Funds

```bash
sss seize --source <ADDRESS> --destination <TREASURY>
```

## 6. Backend Services

### Start All Services

```bash
docker compose up -d
```

### Check Service Health

```bash
curl http://localhost:3001/health  # Mint Service
curl http://localhost:3002/health  # Compliance Service
```

### View Logs

```bash
docker compose logs -f indexer
docker compose logs -f mint-service
docker compose logs -f compliance
```

## 7. Monitoring

### Check Mint Request Status

```bash
curl http://localhost:3001/api/mint/<request-id>
```

### Export Audit Trail (CSV)

```bash
curl "http://localhost:3002/api/audit?mintAddress=<ADDR>&format=csv" > audit.csv
```

### Export Audit Trail (JSON)

```bash
curl "http://localhost:3002/api/audit?mintAddress=<ADDR>&format=json"
```

## 8. Emergency Procedures

### Global Pause

```bash
sss pause
```

All transfers, mints, and burns are immediately halted.

### Unpause

```bash
sss unpause
```

### Seize Funds from Compromised Account

```bash
sss seize --source <COMPROMISED> --destination <TREASURY>
```

## 9. Authority Transfer

Authority transfers enforce a 24-hour timelock:

1. Initiate transfer: `sss authority-transfer --new-authority <PUBKEY>`
2. Wait 24 hours
3. New authority completes: `sss authority-accept`
